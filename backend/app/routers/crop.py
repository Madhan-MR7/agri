"""Crop recommendation (with SHAP explanations) and the crop dashboard."""
from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import mongo
from app.db.postgres import CropRecommendation, Farmer, get_db, get_or_create_farmer
from app.schemas import CropInput, CropRecommendIn
from app.services import crop_recommender
from app.services.crop_features import feature_label

router = APIRouter(prefix="/api", tags=["crop"])


def _model_or_503(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except crop_recommender.ModelNotTrained as e:
        raise HTTPException(503, str(e)) from e


@router.get("/crop/model-info")
def model_info():
    return _model_or_503(crop_recommender.model_info)


@router.post("/crop/recommend")
def recommend(body: CropRecommendIn, db: Session = Depends(get_db)):
    inputs = body.model_dump(include=set(CropInput.model_fields))
    result = _model_or_503(
        crop_recommender.recommend, inputs, top_k=body.top_k, language=body.language, use_llm=body.explain_with_llm
    )

    farmer = get_or_create_farmer(db, body.phone)
    rec = CropRecommendation(
        farmer_id=farmer.id if farmer else None,
        inputs=inputs,
        recommended_crop=result["recommended_crop"],
        confidence=result["confidence"],
        top_crops=[{"crop": c["crop"], "probability": c["probability"]} for c in result["candidates"]],
        shap_values=result["candidates"][0]["contributions"],
        explanation=result["explanation"],
    )
    db.add(rec)
    db.commit()
    return {"id": rec.id, "created_at": rec.created_at, **result}


def _serialize(rec: CropRecommendation) -> dict:
    return {
        "id": rec.id,
        "recommended_crop": rec.recommended_crop,
        "confidence": rec.confidence,
        "top_crops": rec.top_crops,
        "inputs": rec.inputs,
        "shap_values": rec.shap_values,
        "explanation": rec.explanation,
        "created_at": rec.created_at,
    }


def _farmer_recs(db: Session, phone: str, limit: int) -> list[CropRecommendation]:
    return (
        db.query(CropRecommendation)
        .join(Farmer)
        .filter(Farmer.phone == phone)
        .order_by(CropRecommendation.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/crop/history/{phone}")
def history(phone: str, limit: int = 20, db: Session = Depends(get_db)):
    return {"items": [_serialize(r) for r in _farmer_recs(db, phone, limit)]}


@router.get("/crop/recommendations/{rec_id}")
def get_recommendation(rec_id: int, db: Session = Depends(get_db)):
    rec = db.get(CropRecommendation, rec_id)
    if rec is None:
        raise HTTPException(404, "Recommendation not found")
    return _serialize(rec)


@router.get("/dashboard/{phone}")
def dashboard(phone: str, db: Session = Depends(get_db)):
    farmer = db.query(Farmer).filter_by(phone=phone).one_or_none()
    recs = _farmer_recs(db, phone, 200)

    # Personal explainability: which factors drove *this farmer's* recommendations
    impact: dict[str, list[float]] = defaultdict(list)
    for r in recs:
        for c in r.shap_values:
            impact[c["feature"]].append(abs(c["shap"]))
    feature_impact = sorted(
        ({"feature": f, "label": feature_label(f), "impact": round(sum(v) / len(v), 4)} for f, v in impact.items()),
        key=lambda d: d["impact"],
        reverse=True,
    )

    soil_trend = [
        {"date": r.created_at, **{k: r.inputs.get(k) for k in ("N", "P", "K", "ph", "soil_moisture")}}
        for r in reversed(recs[:12])
    ]

    reports = mongo.recent(mongo.disease_reports, phone, 5)
    try:
        model = crop_recommender.model_info()
        global_importance, model_meta = model["global_importance"], {
            k: model[k] for k in ("metrics", "data_source", "trained_at")
        }
    except crop_recommender.ModelNotTrained:
        global_importance, model_meta = [], None

    return {
        "farmer": {"phone": phone, "name": farmer.name, "language": farmer.language, "location": farmer.location}
        if farmer
        else {"phone": phone},
        "stats": {
            "recommendations": len(recs),
            "disease_detections": mongo.count(mongo.disease_reports, phone),
            "chats": mongo.count(mongo.chats, phone),
            "avg_confidence": round(sum(r.confidence for r in recs) / len(recs), 4) if recs else None,
        },
        "latest": _serialize(recs[0]) if recs else None,
        "recent_recommendations": [_serialize(r) for r in recs[:5]],
        "crop_distribution": [{"crop": c, "count": n} for c, n in Counter(r.recommended_crop for r in recs).most_common()],
        "soil_trend": soil_trend,
        "feature_impact": feature_impact,
        "global_importance": global_importance,
        "recent_disease_reports": reports,
        "model": model_meta,
    }
