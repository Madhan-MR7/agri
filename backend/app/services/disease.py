"""Leaf disease detection with a YOLOv8-nano model trained on PlantDoc (30 classes, 13 crops).

The detector finds every leaf in the photo and labels each one, e.g. "Apple rust leaf"
or "Tomato leaf" (healthy). Boxes are returned normalised to 0-1 so the app can draw them.
"""
import io
from collections import defaultdict
from dataclasses import dataclass
from functools import lru_cache

from PIL import Image, ImageOps

from app.config import settings

# PlantDoc classes that are healthy leaves; every other class is a disease
HEALTHY_CLASSES = {
    "Apple leaf", "Bell_pepper leaf", "Blueberry leaf", "Cherry leaf", "Peach leaf", "Potato leaf",
    "Raspberry leaf", "Soyabean leaf", "Soybean leaf", "Strawberry leaf", "Tomato leaf", "grape leaf",
}


@dataclass
class Detection:
    label: str
    confidence: float
    box: tuple[float, float, float, float]  # x1, y1, x2, y2 normalised to 0-1

    @property
    def healthy(self) -> bool:
        return self.label in HEALTHY_CLASSES

    def as_dict(self) -> dict:
        return {
            "label": display_name(self.label),
            "confidence": round(self.confidence, 4),
            "healthy": self.healthy,
            "box": [round(v, 4) for v in self.box],
        }


@dataclass
class Diagnosis:
    detections: list[Detection]

    @property
    def primary(self) -> Detection | None:
        """The condition to explain: the most confident disease, else the most confident leaf."""
        diseased = [d for d in self.detections if not d.healthy]
        pool = diseased or self.detections
        return max(pool, key=lambda d: d.confidence) if pool else None

    def summary(self) -> list[dict]:
        """One row per distinct condition with leaf count and best confidence."""
        groups: dict[str, list[Detection]] = defaultdict(list)
        for d in self.detections:
            groups[d.label].append(d)
        rows = [
            {"label": display_name(k), "count": len(v), "confidence": round(max(d.confidence for d in v), 4),
             "healthy": v[0].healthy}
            for k, v in groups.items()
        ]
        return sorted(rows, key=lambda r: (r["healthy"], -r["confidence"]))


@lru_cache
def _model():
    # Ultralytics/PyTorch are imported lazily so the rest of the API starts without them
    from ultralytics import YOLO

    if not settings.disease_model_path.exists():
        raise FileNotFoundError(
            f"Disease model not found at {settings.disease_model_path}. "
            "Copy the trained PlantDoc YOLO weights (best.pt) there."
        )
    return YOLO(str(settings.disease_model_path))


def plant_fraction(img: Image.Image) -> float:
    """Share of pixels that look like foliage (green, or the yellow/brown of diseased leaves).

    The PlantDoc model labels leafless images (blank walls, soil, plain colours) as
    "Corn rust leaf" with up to ~55% confidence, so we only trust it when the photo
    actually contains plant-coloured pixels.
    """
    import numpy as np

    hsv = np.asarray(img.convert("HSV").resize((160, 160)), dtype=np.int16)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    # PIL hue is 0-255: ~25 (orange/brown) through ~120 (green-cyan) covers healthy and diseased leaves
    foliage = (h >= 20) & (h <= 125) & (s >= 50) & (v >= 40)
    return float(foliage.mean())


def detect(image_bytes: bytes, conf: float | None = None) -> Diagnosis:
    # Respect phone EXIF rotation so boxes line up with what the farmer sees
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(image_bytes))).convert("RGB")
    if plant_fraction(img) < settings.disease_min_plant_fraction:
        return Diagnosis([])
    result = _model().predict(
        img, conf=conf or settings.disease_conf_threshold, imgsz=settings.disease_imgsz, verbose=False
    )[0]
    names = result.names
    detections = [
        Detection(label=names[int(c)], confidence=float(p), box=tuple(float(v) for v in xyxy))
        for xyxy, c, p in zip(result.boxes.xyxyn.tolist(), result.boxes.cls.tolist(), result.boxes.conf.tolist())
    ]
    return Diagnosis(sorted(detections, key=lambda d: d.confidence, reverse=True))


def display_name(label: str) -> str:
    """'Bell_pepper leaf spot' -> 'Bell pepper leaf spot', 'grape leaf' -> 'Grape leaf'."""
    text = label.replace("_", " ")
    return text[:1].upper() + text[1:]


def crop_of(label: str) -> str:
    name = display_name(label)
    return "Bell pepper" if name.startswith("Bell pepper") else name.split()[0]
