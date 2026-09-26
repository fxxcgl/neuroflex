import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
from ..database import get_supabase
from ..auth import verify_token

router = APIRouter()

class OnboardRequest(BaseModel):
    doctorId: str
    gateway: str

class SubscribeRequest(BaseModel):
    patientId: str
    doctorId: str
    gateway: str
    amount: int

COMMISSION_PERCENT = 15

@router.post("/onboard")
def onboard_doctor(req: OnboardRequest, user = Depends(verify_token)):
    supabase = get_supabase()
    doctor_id = req.doctorId
    gateway = req.gateway

    if gateway == "stripe":
        # In a real app, you would use the stripe-python SDK here:
        # import stripe
        # stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
        # account = stripe.Account.create(type="express")
        # account_link = stripe.AccountLink.create(...)
        
        # We mock this for the local environment
        mock_account_id = f"acct_mock_{os.urandom(4).hex()}"
        
        # Save to DB via Supabase
        supabase.table("doctor_payment_accounts").upsert({
            "doctor_id": doctor_id,
            "gateway": "stripe",
            "connected_account_id": mock_account_id,
            "status": "pending_kyc"
        }, on_conflict="doctor_id, gateway").execute()
        
        public_url = os.environ.get("PUBLIC_URL", "http://localhost:5173")
        return {"url": f"{public_url}/clinician/dashboard?gateway=stripe&status=refresh"}
        
    elif gateway == "razorpay":
        mock_account_id = f"acc_rzp_{os.urandom(4).hex()}"
        supabase.table("doctor_payment_accounts").upsert({
            "doctor_id": doctor_id,
            "gateway": "razorpay",
            "connected_account_id": mock_account_id,
            "status": "active"
        }, on_conflict="doctor_id, gateway").execute()
        
        public_url = os.environ.get("PUBLIC_URL", "http://localhost:5173")
        return {"url": f"{public_url}/clinician/dashboard?gateway=razorpay&status=success"}
        
    elif gateway == "paypal":
        mock_account_id = f"acc_pp_{os.urandom(4).hex()}"
        supabase.table("doctor_payment_accounts").upsert({
            "doctor_id": doctor_id,
            "gateway": "paypal",
            "connected_account_id": mock_account_id,
            "status": "active"
        }, on_conflict="doctor_id, gateway").execute()
        
        public_url = os.environ.get("PUBLIC_URL", "http://localhost:5173")
        return {"url": f"{public_url}/clinician/dashboard?gateway=paypal&status=success"}

    raise HTTPException(status_code=400, detail="Invalid gateway")

@router.post("/subscribe")
def subscribe_patient(req: SubscribeRequest, user = Depends(verify_token)):
    supabase = get_supabase()
    
    # 1. Check if doctor has this gateway active
    response = supabase.table("doctor_payment_accounts").select("*").eq("doctor_id", req.doctorId).eq("gateway", req.gateway).eq("status", "active").execute()
    
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=400, detail="Doctor has not connected this payment gateway.")
        
    doc_account = response.data[0]
    fee_amount = round(req.amount * (COMMISSION_PERCENT / 100))
    public_url = os.environ.get("PUBLIC_URL", "http://localhost:5173")
    return_url = f"{public_url}/patient/dashboard?subscription=success"

    if req.gateway == "stripe":
        # Mock stripe checkout session
        session_id = f"cs_test_{os.urandom(4).hex()}"
        
        supabase.table("subscriptions").insert({
            "patient_id": req.patientId,
            "doctor_id": req.doctorId,
            "gateway": "stripe",
            "gateway_subscription_id": session_id,
            "amount": req.amount / 100.0,
            "commission_percent": COMMISSION_PERCENT,
            "status": "incomplete"
        }).execute()
        
        return {"url": return_url}
        
    if req.gateway == "razorpay":
        sub_id = f"sub_rzp_{os.urandom(4).hex()}"
        supabase.table("subscriptions").insert({
            "patient_id": req.patientId,
            "doctor_id": req.doctorId,
            "gateway": "razorpay",
            "gateway_subscription_id": sub_id,
            "amount": req.amount / 100.0,
            "commission_percent": COMMISSION_PERCENT,
            "status": "active"
        }).execute()
        return {"url": return_url}

    if req.gateway == "paypal":
        sub_id = f"sub_pp_{os.urandom(4).hex()}"
        supabase.table("subscriptions").insert({
            "patient_id": req.patientId,
            "doctor_id": req.doctorId,
            "gateway": "paypal",
            "gateway_subscription_id": sub_id,
            "amount": req.amount / 100.0,
            "commission_percent": COMMISSION_PERCENT,
            "status": "active"
        }).execute()
        return {"url": return_url}

    raise HTTPException(status_code=400, detail="Unsupported gateway")
