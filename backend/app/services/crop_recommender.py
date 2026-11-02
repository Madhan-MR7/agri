"""Crop recommendation with per-prediction SHAP explanations."""
import logging
from functools import lru_cache

import joblib
import numpy as np

from app.config import settings
from app.services import llm
from app.services.crop_features import CATEGORICAL_FEATURES, NUMERIC_FEATURES, encode_value, feature_label

log = logging.getLogger(__name__)


class ModelNotTrained(RuntimeError):
    pass


@lru_cache
def _bundle() -> dict:
    if not settings.crop_model_path.exists():
        raise ModelNotTrained(
            f"No crop model at {settings.crop_model_path}. Run `python -m ml.train_crop_model` in backend/."
        )
    bundle = joblib.load(settings.crop_model_path)
    import shap

    bundle["explainer"] = shap.TreeExplainer(bundle["model"])
    return bundle


def model_info() -> dict:
    b = _bundle()
    return {
        "features": [
            {
                "name": f,
                "label": feature_label(f),
                **(
                    {"unit": NUMERIC_FEATURES[f][1], "min": NUMERIC_FEATURES[f][2], "max": NUMERIC_FEATURES[f][3]}
                    if f in NUMERIC_FEATURES
                    else {"options": CATEGORICAL_FEATURES[f][1]}
                ),
            }
            for f in b["features"]
        ],
        "crops": b["classes"],
        "global_importance": [{**g, "label": feature_label(g["feature"])} for g in b["global_importance"]],
        "metrics": b["metrics"],
        "data_source": b["data_source"],
        "trained_at": b["trained_at"],
    }


def _class_shap(sv, cls_idx: int) -> np.ndarray:
    """SHAP output shape differs across shap versions; return (n_features,) for one class."""
    if isinstance(sv, list):
        return np.asarray(sv[cls_idx])[0]
    return np.asarray(sv)[0, :, cls_idx]


def _base_value(explainer, cls_idx: int) -> float:
    ev = np.atleast_1d(explainer.expected_value)
    return float(ev[cls_idx] if len(ev) > 1 else ev[0])


def _contributions(features, inputs, shap_row) -> list[dict]:
    items = [
        {"feature": f, "label": feature_label(f), "value": inputs[f], "shap": round(float(s), 4)}
        for f, s in zip(features, shap_row)
    ]
    return sorted(items, key=lambda d: abs(d["shap"]), reverse=True)


def _template_explanation(crop: str, confidence: float, contribs: list[dict]) -> str:
    pos = [c for c in contribs if c["shap"] > 0][:3]
    neg = [c for c in contribs if c["shap"] < 0][:2]
    text = f"{crop.title()} is recommended with {confidence:.0%} confidence."
    if pos:
        text += " Main reasons: " + ", ".join(f"{c['label']} ({c['value']})" for c in pos) + " suit this crop."
    if neg:
        text += " Less favourable: " + ", ".join(f"{c['label']} ({c['value']})" for c in neg) + "."
    return text


def _llm_explanation(crop: str, confidence: float, contribs: list[dict], language: str) -> str:
    lines = "\n".join(f"- {c['label']} = {c['value']}: SHAP {c['shap']:+.3f}" for c in contribs)
    prompt = f"""
A crop recommendation model suggested **{crop}** ({confidence:.0%} confidence) for a farmer.
SHAP contributions (positive = pushed towards {crop}, negative = pushed away):
{lines}

Explain to the farmer in simple words, in {llm.SUPPORTED_LANGUAGES.get(language, 'English')},
in at most 5 short bullet points: why this crop fits their field, which soil/climate factor matters
most, and one practical tip to improve the weakest factor. Do not mention SHAP or machine learning.
"""
    return llm.generate(prompt)


def recommend(inputs: dict, top_k: int = 3, language: str = "en", use_llm: bool = True) -> dict:
    b = _bundle()
    features, classes, model, explainer = b["features"], b["classes"], b["model"], b["explainer"]

    used = {f: inputs[f] for f in features}
    x = np.array([[encode_value(f, used[f]) for f in features]])
    probs = model.predict_proba(x)[0]
    order = np.argsort(probs)[::-1][:top_k]
    sv = explainer.shap_values(x)

    candidates = []
    for idx in order:
        candidates.append({
            "crop": classes[idx],
            "probability": round(float(probs[idx]), 4),
            "base_value": round(_base_value(explainer, idx), 4),
            "contributions": _contributions(features, used, _class_shap(sv, idx)),
        })

    best = candidates[0]
    explanation = _template_explanation(best["crop"], best["probability"], best["contributions"])
    if use_llm:
        try:
            explanation = _llm_explanation(best["crop"], best["probability"], best["contributions"], language)
        except Exception as e:  # noqa: BLE001
            log.warning("LLM explanation failed, using template: %s", e)

    return {
        "recommended_crop": best["crop"],
        "confidence": best["probability"],
        "candidates": candidates,
        "explanation": explanation,
        "ignored_inputs": sorted(set(inputs) - set(features)),
    }
