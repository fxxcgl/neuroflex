from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any
from ..database import get_supabase
from ..auth import verify_token
from datetime import datetime, timedelta

router = APIRouter()

class AssignRequest(BaseModel):
    patientId: str
    clinicianId: str

class PrescriptionUpdate(BaseModel):
    patientId: str
    clinicianId: str
    exercise_type: str
    target_angle: int
    sets: int
    reps: int
    frequency_per_week: int
    notes: Optional[str] = ""

@router.get("/")
def get_clinicians():
    # Public route or protected? Usually public or requires just any logged-in user
    supabase = get_supabase()
    response = supabase.table("profiles").select(
        "id, full_name, email, role, clinician_profiles(credentials, specialty)"
    ).eq("role", "clinician").execute()
    
    if hasattr(response, 'error') and response.error:
        raise HTTPException(status_code=400, detail=str(response.error))
        
    results = []
    for c in response.data:
        cp = c.get("clinician_profiles", [])
        cp = cp[0] if isinstance(cp, list) and len(cp) > 0 else (cp if cp else {})
        
        email = c.get("email") or ""
        name = c.get("full_name") or f"Dr. {email.split('@')[0] if email else 'Clinician'}"
        
        results.append({
            "id": c.get("id"),
            "name": name,
            "credentials": cp.get("credentials", "Licensed Physical Therapist"),
            "specialty": cp.get("specialty", "Neurologic Physical Therapy"),
            "email": email,
        })
        
    return results

@router.post("/assign")
def assign_clinician(req: AssignRequest, user = Depends(verify_token)):
    supabase = get_supabase()
    
    # 1. Upsert patient_profiles
    res1 = supabase.table("patient_profiles").upsert({
        "user_id": req.patientId,
        "assigned_clinician_id": req.clinicianId,
        "condition": "Post-Stroke Motor Rehabilitation"
    }).execute()
    
    if hasattr(res1, 'error') and res1.error:
        raise HTTPException(status_code=400, detail=str(res1.error))
        
    # 2. Ensure default prescription
    rx_check = supabase.table("prescriptions").select("id").eq("patient_id", req.patientId).limit(1).execute()
    
    if not rx_check.data or len(rx_check.data) == 0:
        supabase.table("prescriptions").insert({
            "patient_id": req.patientId,
            "clinician_id": req.clinicianId,
            "exercise_type": "knee_extension",
            "target_angle": 110,
            "sets": 3,
            "reps": 10,
            "frequency_per_week": 5,
            "notes": "Focus on full terminal extension with a 2-second isometric pause. Keep back upright against chair."
        }).execute()
        
    return {"success": True}

@router.get("/{clinician_id}/caseload")
def get_caseload(clinician_id: str, user = Depends(verify_token)):
    # Note: A full port of fetchClinicianCaseload is complex because it fetches sessions, rom angles, adherence etc.
    # We will build a simplified version here, or in a real app, write a Postgres RPC/View or do joins.
    # For now, we fetch assigned patients and prescriptions.
    
    supabase = get_supabase()
    
    pat_res = supabase.table("patient_profiles").select(
        "user_id, condition, condition_category, primary_injury, assigned_clinician_id, profile:profiles!user_id(id, full_name, email)"
    ).eq("assigned_clinician_id", clinician_id).execute()
    
    if hasattr(pat_res, 'error') and pat_res.error:
        raise HTTPException(status_code=400, detail=str(pat_res.error))
        
    caseload = []
    
    for pat in pat_res.data:
        patient_id = pat.get("user_id")
        profile = pat.get("profile", {})
        if isinstance(profile, list):
            profile = profile[0] if len(profile) > 0 else {}
            
        patient_name = profile.get("full_name") or "Patient"
        patient_email = profile.get("email") or "patient@example.com"
        
        # Get prescription
        rx_res = supabase.table("prescriptions").select("*").eq("patient_id", patient_id).order("created_at", desc=True).limit(1).execute()
        prescription = rx_res.data[0] if rx_res.data and len(rx_res.data) > 0 else None
        
        caseload.append({
            "id": patient_id,
            "name": patient_name,
            "email": patient_email,
            "condition": pat.get("condition"),
            "compliance": 0,  # Mocked for now to save complex session parsing in this phase
            "prescription": prescription,
            "romHistory": [],
            "sessionsHistory": [],
            "angleDeviationData": []
        })
        
    return caseload

@router.post("/prescription")
def update_prescription(req: PrescriptionUpdate, user = Depends(verify_token)):
    supabase = get_supabase()
    
    response = supabase.table("prescriptions").insert({
        "patient_id": req.patientId,
        "clinician_id": req.clinicianId,
        "exercise_type": req.exercise_type,
        "target_angle": req.target_angle,
        "sets": req.sets,
        "reps": req.reps,
        "frequency_per_week": req.frequency_per_week,
        "notes": req.notes
    }).execute()
    
    if hasattr(response, 'error') and response.error:
        raise HTTPException(status_code=400, detail=str(response.error))
        
    return {"success": True}
