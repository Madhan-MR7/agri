"""Train the crop recommendation model and precompute global SHAP importance.

Usage (from the backend/ folder):
    python -m ml.train_crop_model                        # uses ml/data/crop_recommendation.csv if present
    python -m ml.train_crop_model --csv path/to/data.csv
    python -m ml.train_crop_model --synthetic            # force the built-in demo dataset

CSV format: one row per sample with a `label` (crop) column plus any of
N, P, K, temperature, humidity, ph, rainfall, soil_moisture, soil_type, water_availability.
The widely used Kaggle "Crop Recommendation" dataset (N, P, K, temperature, humidity, ph,
rainfall, label) works as-is; features missing from the CSV are simply not used by the model.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

from app.config import settings
from app.services.crop_features import ALL_FEATURES, CATEGORICAL_FEATURES, encode_value

DEFAULT_CSV = Path(__file__).parent / "data" / "crop_recommendation.csv"

# Agronomic ranges per crop used only for the synthetic demo dataset:
# N, P, K, temperature, humidity, ph, rainfall, soil_moisture, soil types, water availability
_PROFILES = {
    "rice":        ((60, 99), (35, 60), (35, 45), (20, 27), (80, 85), (5.0, 7.9), (180, 300), (60, 90), ["alluvial", "clayey"], ["high"]),
    "wheat":       ((80, 120), (40, 60), (30, 50), (12, 25), (50, 70), (6.0, 7.5), (50, 100), (35, 55), ["alluvial", "loamy", "black"], ["medium"]),
    "maize":       ((60, 100), (35, 60), (15, 25), (18, 27), (55, 75), (5.5, 7.0), (60, 110), (30, 50), ["alluvial", "loamy", "red"], ["medium"]),
    "sugarcane":   ((100, 150), (40, 70), (40, 80), (21, 35), (65, 85), (6.0, 8.0), (150, 250), (55, 80), ["alluvial", "black", "loamy"], ["high"]),
    "cotton":      ((100, 140), (35, 60), (15, 25), (22, 26), (75, 85), (5.8, 8.0), (60, 100), (30, 50), ["black"], ["medium", "low"]),
    "jute":        ((60, 100), (35, 60), (35, 45), (23, 27), (70, 90), (6.0, 7.5), (150, 200), (60, 85), ["alluvial", "clayey"], ["high"]),
    "chickpea":    ((20, 60), (55, 80), (75, 85), (17, 21), (14, 20), (6.0, 9.0), (65, 95), (15, 30), ["black", "loamy"], ["low"]),
    "kidneybeans": ((0, 40), (55, 80), (15, 25), (15, 25), (18, 25), (5.5, 6.0), (60, 150), (25, 40), ["loamy", "red"], ["medium"]),
    "pigeonpeas":  ((0, 40), (55, 80), (15, 25), (18, 37), (30, 70), (4.5, 7.5), (90, 200), (20, 40), ["red", "black", "laterite"], ["low", "medium"]),
    "mungbean":    ((0, 40), (35, 60), (15, 25), (27, 30), (80, 90), (6.2, 7.2), (36, 60), (25, 40), ["sandy", "loamy"], ["low"]),
    "blackgram":   ((20, 60), (55, 80), (15, 25), (25, 35), (60, 70), (6.5, 7.8), (60, 75), (25, 40), ["black", "clayey"], ["low", "medium"]),
    "lentil":      ((0, 40), (55, 80), (15, 25), (18, 30), (60, 70), (5.9, 6.9), (35, 55), (20, 35), ["loamy", "alluvial"], ["low"]),
    "groundnut":   ((15, 40), (40, 60), (30, 50), (25, 32), (50, 70), (6.0, 7.0), (50, 120), (20, 35), ["sandy", "red"], ["low", "medium"]),
    "banana":      ((80, 120), (70, 95), (45, 55), (25, 30), (75, 85), (5.5, 6.5), (90, 120), (55, 75), ["alluvial", "loamy"], ["high"]),
    "mango":       ((0, 40), (15, 40), (25, 35), (27, 36), (45, 55), (4.5, 7.0), (89, 101), (25, 40), ["laterite", "red", "alluvial"], ["medium"]),
    "coconut":     ((0, 40), (5, 30), (25, 35), (25, 30), (90, 100), (5.5, 6.5), (130, 230), (50, 70), ["laterite", "sandy"], ["high", "medium"]),
    "coffee":      ((80, 120), (15, 40), (25, 35), (23, 28), (50, 70), (6.0, 7.5), (115, 200), (45, 65), ["laterite", "red"], ["medium"]),
    "watermelon":  ((80, 120), (5, 30), (45, 55), (24, 27), (80, 90), (6.0, 7.0), (40, 60), (30, 45), ["sandy"], ["medium"]),
    "grapes":      ((0, 40), (120, 145), (195, 205), (8, 42), (80, 84), (5.5, 6.5), (65, 75), (25, 40), ["black", "loamy"], ["medium"]),
}


def synthetic_dataset(per_crop: int = 150, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    numeric = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall", "soil_moisture"]
    for crop, prof in _PROFILES.items():
        *ranges, soils, waters = prof
        for _ in range(per_crop):
            row = {f: rng.uniform(lo, hi) for f, (lo, hi) in zip(numeric, ranges)}
            # 15% of rows get a random soil / water value so the model isn't purely rule-based
            row["soil_type"] = rng.choice(soils if rng.random() > 0.15 else CATEGORICAL_FEATURES["soil_type"][1])
            row["water_availability"] = rng.choice(
                waters if rng.random() > 0.15 else CATEGORICAL_FEATURES["water_availability"][1]
            )
            row["label"] = crop
            rows.append(row)
    return pd.DataFrame(rows)


def load_dataset(csv: Path | None, force_synthetic: bool) -> tuple[pd.DataFrame, str]:
    if not force_synthetic:
        path = csv or DEFAULT_CSV
        if path.exists():
            df = pd.read_csv(path)
            df.columns = [c.strip() for c in df.columns]
            if "label" not in df.columns:
                raise SystemExit(f"{path} needs a 'label' column with the crop name")
            return df, str(path)
        if csv:
            raise SystemExit(f"CSV not found: {csv}")
    return synthetic_dataset(), "synthetic-demo"


def encode(df: pd.DataFrame, features: list[str]) -> np.ndarray:
    return np.array([[encode_value(f, v) for f, v in zip(features, row)] for row in df[features].itertuples(index=False)])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path)
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--out", type=Path, default=settings.crop_model_path)
    args = ap.parse_args()

    df, source = load_dataset(args.csv, args.synthetic)
    features = [f for f in ALL_FEATURES if f in df.columns]
    df = df.dropna(subset=features + ["label"])
    df["label"] = df["label"].astype(str).str.strip().str.lower()
    print(f"Dataset: {source} | rows={len(df)} | crops={df['label'].nunique()} | features={features}")

    X = encode(df, features)
    y = df["label"].to_numpy()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

    model = RandomForestClassifier(n_estimators=200, min_samples_leaf=2, n_jobs=-1, random_state=42)
    model.fit(X_tr, y_tr)
    pred = model.predict(X_te)
    metrics = {
        "accuracy": round(float(accuracy_score(y_te, pred)), 4),
        "f1_macro": round(float(f1_score(y_te, pred, average="macro")), 4),
    }
    print(f"Test metrics: {metrics}")

    # Global explainability: mean |SHAP| per feature over a test sample, averaged across crops
    sample = X_te[: min(300, len(X_te))]
    sv = shap.TreeExplainer(model).shap_values(sample)
    sv = np.stack(sv, axis=-1) if isinstance(sv, list) else sv  # -> (n, features, classes)
    importance = np.abs(sv).mean(axis=(0, 2))
    importance = importance / importance.sum()
    global_importance = sorted(
        ({"feature": f, "importance": round(float(v), 4)} for f, v in zip(features, importance)),
        key=lambda d: d["importance"],
        reverse=True,
    )
    print("Global SHAP importance:", json.dumps(global_importance, indent=1))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "features": features,
            "classes": list(model.classes_),
            "global_importance": global_importance,
            "metrics": metrics,
            "data_source": source,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        },
        args.out,
        compress=3,
    )
    print(f"Saved model to {args.out}")


if __name__ == "__main__":
    main()
