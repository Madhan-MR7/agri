from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.postgres import Farmer, get_db
from app.schemas import FarmerIn, FarmerOut

router = APIRouter(prefix="/api/farmers", tags=["farmers"])


@router.post("", response_model=FarmerOut)
def upsert_farmer(body: FarmerIn, db: Session = Depends(get_db)):
    farmer = db.query(Farmer).filter_by(phone=body.phone).one_or_none()
    if farmer is None:
        farmer = Farmer(phone=body.phone)
        db.add(farmer)
    farmer.name, farmer.language, farmer.location = body.name, body.language, body.location
    db.commit()
    return farmer


@router.get("/{phone}", response_model=FarmerOut)
def get_farmer(phone: str, db: Session = Depends(get_db)):
    farmer = db.query(Farmer).filter_by(phone=phone).one_or_none()
    if farmer is None:
        raise HTTPException(404, "Farmer not found")
    return farmer
