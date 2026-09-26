from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from .database import get_supabase

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    supabase = get_supabase()
    
    # Verify the JWT using Supabase's auth.get_user method
    # Since we are using the supabase-py client, we pass the jwt token
    res = supabase.auth.get_user(token)
    if not res.user:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return res.user
