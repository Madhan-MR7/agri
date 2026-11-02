"""PostgreSQL: structured data (farmers, crop recommendations)."""
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Farmer(Base):
    __tablename__ = "farmers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    language: Mapped[str] = mapped_column(String(10), default="en")
    location: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    recommendations: Mapped[list["CropRecommendation"]] = relationship(back_populates="farmer")


class CropRecommendation(Base):
    __tablename__ = "crop_recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farmer_id: Mapped[int | None] = mapped_column(ForeignKey("farmers.id"), index=True, nullable=True)
    # Raw soil / climate inputs as submitted by the farmer
    inputs: Mapped[dict] = mapped_column(JSON)
    recommended_crop: Mapped[str] = mapped_column(String(60), index=True)
    confidence: Mapped[float] = mapped_column(Float)
    # [{crop, probability}] for the top-k candidates
    top_crops: Mapped[list] = mapped_column(JSON)
    # [{feature, label, value, shap}] for the recommended crop
    shap_values: Mapped[list] = mapped_column(JSON)
    explanation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)

    farmer: Mapped[Farmer | None] = relationship(back_populates="recommendations")


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_or_create_farmer(db: Session, phone: str | None) -> Farmer | None:
    if not phone:
        return None
    farmer = db.query(Farmer).filter_by(phone=phone).one_or_none()
    if farmer is None:
        farmer = Farmer(phone=phone)
        db.add(farmer)
        db.commit()
    return farmer
