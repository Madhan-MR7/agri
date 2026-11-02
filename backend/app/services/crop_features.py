"""Feature definitions shared by the crop model trainer and the inference service."""

NUMERIC_FEATURES = {
    # name: (label shown to farmers, unit, min, max)
    "N": ("Nitrogen", "kg/ha", 0, 200),
    "P": ("Phosphorus", "kg/ha", 0, 200),
    "K": ("Potassium", "kg/ha", 0, 250),
    "temperature": ("Temperature", "°C", 0, 50),
    "humidity": ("Humidity", "%", 0, 100),
    "ph": ("Soil pH", "", 3, 10),
    "rainfall": ("Rainfall", "mm", 0, 400),
    "soil_moisture": ("Soil moisture", "%", 0, 100),
}

CATEGORICAL_FEATURES = {
    "soil_type": ("Soil / land type", ["alluvial", "black", "red", "laterite", "sandy", "loamy", "clayey"]),
    "water_availability": ("Water availability", ["low", "medium", "high"]),
}

ALL_FEATURES = list(NUMERIC_FEATURES) + list(CATEGORICAL_FEATURES)


def feature_label(name: str) -> str:
    if name in NUMERIC_FEATURES:
        return NUMERIC_FEATURES[name][0]
    return CATEGORICAL_FEATURES[name][0]


def encode_value(name: str, value) -> float:
    if name in CATEGORICAL_FEATURES:
        return float(CATEGORICAL_FEATURES[name][1].index(str(value).lower()))
    return float(value)
