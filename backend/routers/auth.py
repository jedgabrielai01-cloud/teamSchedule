import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.auth import create_token, verify_password
from backend.db import get_db

router = APIRouter(prefix="/auth")


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT password_hash FROM users WHERE username = ?", (body.username,)
    ).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return {"token": create_token(body.username)}
