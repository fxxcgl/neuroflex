from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import payments, appointments, clinician

app = FastAPI(title="NeuroFlex Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(appointments.router, prefix="/api/appointments", tags=["appointments"])
app.include_router(clinician.router, prefix="/api/clinicians", tags=["clinicians"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the NeuroFlex API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

