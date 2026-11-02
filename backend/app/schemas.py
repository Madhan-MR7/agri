from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FarmerIn(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    name: str = ""
    language: str = "en"
    location: str = ""


class FarmerOut(FarmerIn):
    id: int
    created_at: datetime


class ChatIn(BaseModel):
    message: str = Field(min_length=1)
    phone: str | None = None
    language: str | None = Field(None, description="Preferred reply language; auto-detected if omitted")


class ChatOut(BaseModel):
    reply_text: str
    language: str
    citations: list[str]
    source_type: str


class CropInput(BaseModel):
    N: float = Field(ge=0, le=200, description="Nitrogen (kg/ha)")
    P: float = Field(ge=0, le=200, description="Phosphorus (kg/ha)")
    K: float = Field(ge=0, le=250, description="Potassium (kg/ha)")
    temperature: float = Field(ge=-5, le=55, description="°C")
    humidity: float = Field(ge=0, le=100, description="%")
    ph: float = Field(ge=3, le=10)
    rainfall: float = Field(ge=0, le=500, description="mm")
    soil_moisture: float = Field(ge=0, le=100, description="%")
    soil_type: Literal["alluvial", "black", "red", "laterite", "sandy", "loamy", "clayey"]
    water_availability: Literal["low", "medium", "high"]


class CropRecommendIn(CropInput):
    phone: str | None = None
    language: str = "en"
    top_k: int = Field(3, ge=1, le=5)
    explain_with_llm: bool = True
