from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ..database import get_supabase
from ..auth import verify_token

router = APIRouter()

class AppointmentCreate(BaseModel):
    patientId: str
    clinicianId: str
    scheduledAt: str

class AppointmentUpdate(BaseModel):
    status: str

@router.get("/")
def get_appointments(userId: str, role: str, user = Depends(verify_token)):
    supabase = get_supabase()
    column = 'clinician_id' if role == 'clinician' else 'patient_id'
    
    response = supabase.table("appointments").select("*").eq(column, userId).order("scheduled_at").execute()
    
    if hasattr(response, 'error') and response.error:
        raise HTTPException(status_code=400, detail=str(response.error))
        
    return response.data

@router.post("/")
def create_appointment(req: AppointmentCreate, user = Depends(verify_token)):
    supabase = get_supabase()
    
    response = supabase.table("appointments").insert({
        "patient_id": req.patientId,
        "clinician_id": req.clinicianId,
        "scheduled_at": req.scheduledAt,
        "status": "pending"
    }).execute()
    
    if hasattr(response, 'error') and response.error:
        raise HTTPException(status_code=400, detail=str(response.error))
        
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=400, detail="Failed to create appointment")
        
    return response.data[0]

@router.patch("/{appointment_id}/status")
def update_appointment_status(appointment_id: str, req: AppointmentUpdate, user = Depends(verify_token)):
    supabase = get_supabase()
    
    response = supabase.table("appointments").update({
        "status": req.status
    }).eq("id", appointment_id).execute()
    
    if hasattr(response, 'error') and response.error:
        raise HTTPException(status_code=400, detail=str(response.error))
        
    return {"success": True}
