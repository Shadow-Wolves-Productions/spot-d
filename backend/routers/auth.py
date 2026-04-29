"""Hybrid auth — email + password (primary) with OTP for email verification
and password reset. Existing OTP-only callers keep working.

Endpoints:
  - POST /api/auth/request-code        send 6-digit OTP to email
  - POST /api/auth/verify-code         verify OTP → returns session JWT
  - POST /api/auth/login               { email, password } → JWT
                                       409 + set_password_required for legacy
                                       users with no password yet
  - POST /api/auth/set-password        (auth required) set/update password
  - POST /api/auth/forgot-password     alias of request-code (UX clarity)
  - POST /api/auth/reset-password      { email, code, new_password } in one call
  - GET  /api/auth/me                  current user
  - POST /api/auth/logout              clear cookie
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

from core import (
    ADMIN_EMAIL, EMAIL_LOGO_URL, EMAIL_MOCK,
    current_user, db, email_logo_html, make_token, new_id, now_iso,
    require_user, send_email, serialize,
)

router = APIRouter()

# bcrypt at cost factor 12 — ~250ms hash on a modern server.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


# --------------------------------------------------------------------------- #
# Request bodies
# --------------------------------------------------------------------------- #
class RequestCodeBody(BaseModel):
    email: EmailStr


class VerifyCodeBody(BaseModel):
    email: EmailStr
    code: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class SetPasswordBody(BaseModel):
    password: str = Field(..., min_length=8, max_length=200)


class ResetPasswordBody(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(..., min_length=8, max_length=200)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
async def _consume_otp(email: str, code: str) -> Optional[dict]:
    """Validate and burn an OTP. Raises on failure, returns the record on success."""
    code_record = await db.login_codes.find_one(
        {"email": email, "used": False},
        sort=[("created_at", -1)],
    )
    if not code_record:
        raise HTTPException(400, "No active code. Request a new one.")
    if datetime.fromisoformat(code_record["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Code expired.")
    attempts = code_record.get("attempts", 0) + 1
    if attempts >= 5 and code_record["code"] != code:
        await db.login_codes.update_one(
            {"id": code_record["id"]}, {"$set": {"used": True, "attempts": attempts}}
        )
        raise HTTPException(400, "Too many attempts. Request a new code.")
    if code_record["code"] != code:
        await db.login_codes.update_one(
            {"id": code_record["id"]}, {"$set": {"attempts": attempts}}
        )
        raise HTTPException(400, "Invalid code.")
    await db.login_codes.update_one(
        {"id": code_record["id"]}, {"$set": {"used": True, "attempts": attempts}}
    )
    return code_record


def _set_session_cookie(response: Response, token: str):
    response.set_cookie(
        "spotd_token", token, max_age=60 * 60 * 24 * 30,
        httponly=False, samesite="lax", path="/", secure=False,
    )


async def _ensure_user(email: str) -> dict:
    """Look up user by email; create a stub row on first sign-in."""
    user = await db.users.find_one({"email": email})
    if not user:
        role = "admin" if email == ADMIN_EMAIL else "user"
        user = {
            "id": new_id(),
            "email": email,
            "full_name": email.split("@")[0],
            "role": role,
            "created_date": now_iso(),
            "updated_date": now_iso(),
            "first_login_at": now_iso(),
            "email_verified": False,
            "password_hash": None,
        }
        await db.users.insert_one(user)
    else:
        update = {"updated_date": now_iso()}
        if not user.get("first_login_at"):
            update["first_login_at"] = now_iso()
            user["first_login_at"] = update["first_login_at"]
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    return user


async def _record_login_attempt(email: str, success: bool):
    """Track failed login attempts for brute-force protection."""
    if success:
        await db.login_attempts.delete_many({"email": email})
        return
    await db.login_attempts.insert_one({
        "email": email,
        "created_at": datetime.now(timezone.utc),
        "success": False,
    })


# --------------------------------------------------------------------------- #
# OTP — request + verify
# --------------------------------------------------------------------------- #
@router.post("/api/auth/request-code")
async def request_login_code(body: RequestCodeBody):
    email = body.email.lower().strip()

    # Rate limit: 3 codes per email per 10 minutes
    ten_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    recent = await db.login_codes.count_documents({
        "email": email, "created_at": {"$gt": ten_min_ago},
    })
    if recent >= 3:
        raise HTTPException(429, "Too many requests. Please wait 10 minutes.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await db.login_codes.insert_one({
        "id": new_id(),
        "email": email,
        "code": code,
        "expires_at": expires,
        "used": False,
        "attempts": 0,
        "created_at": now_iso(),
    })

    html = f"""
    <div style="background:#0D0D0D;color:#fff;font-family:'DM Sans',Arial,sans-serif;padding:32px;">
      <div style="margin-bottom:32px;">{email_logo_html(40)}</div>
      <p>Your sign-in code is:</p>
      <h2 style="letter-spacing:6px;font-size:36px;color:#E6FF00;margin:16px 0;">{code}</h2>
      <p style="color:#888">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
    </div>
    """
    await send_email(email, "Your Spot'd sign-in code", html)
    payload = {"success": True}
    if EMAIL_MOCK:
        payload["dev_code"] = code
    return payload


@router.post("/api/auth/forgot-password")
async def forgot_password(body: RequestCodeBody):
    """UX-friendly alias of request-code, called from the 'Forgot password?' link."""
    return await request_login_code(body)


@router.post("/api/auth/verify-code")
async def verify_login_code(body: VerifyCodeBody, response: Response):
    email = body.email.lower().strip()
    await _consume_otp(email, body.code)

    user = await _ensure_user(email)
    if not user.get("email_verified"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"email_verified": True}})
        user["email_verified"] = True

    token = make_token(user["id"])
    _set_session_cookie(response, token)

    profile = await db.profiles.find_one({"user_id": user["id"]})
    return {
        "token": token,
        "user": serialize(user),
        "profile": serialize(profile),
        # Tells the frontend whether to prompt for a password after OTP login.
        "needs_password_setup": not bool(user.get("password_hash")),
    }


# --------------------------------------------------------------------------- #
# Password — login + set + reset
# --------------------------------------------------------------------------- #
@router.post("/api/auth/login")
async def login_with_password(body: LoginBody, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        # Don't leak account existence — generic 401.
        raise HTTPException(401, "Invalid email or password.")

    # Brute-force gate: 5 failed attempts in 15min → soft-lock.
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    fails = await db.login_attempts.count_documents({
        "email": email, "created_at": {"$gte": cutoff}, "success": False,
    })
    if fails >= 5:
        raise HTTPException(429, "Too many failed attempts. Please wait 15 minutes or reset your password.")

    # Legacy / imported users have no password_hash yet — front-end should
    # branch into the OTP-then-set-password flow.
    if not user.get("password_hash"):
        raise HTTPException(status_code=409, detail={
            "code": "set_password_required",
            "message": "This account doesn't have a password yet. Verify your email with a one-time code, then create a password.",
        })

    if not verify_password(body.password, user["password_hash"]):
        await _record_login_attempt(email, success=False)
        raise HTTPException(401, "Invalid email or password.")

    await _record_login_attempt(email, success=True)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"updated_date": now_iso(), "last_login_at": now_iso()}},
    )

    token = make_token(user["id"])
    _set_session_cookie(response, token)
    profile = await db.profiles.find_one({"user_id": user["id"]})
    return {
        "token": token,
        "user": serialize(user),
        "profile": serialize(profile),
        "needs_password_setup": False,
    }


@router.post("/api/auth/set-password")
async def set_password(body: SetPasswordBody, request: Request):
    """Authenticated endpoint: caller is signed in (typically just verified
    via OTP) and is setting a password for the first time or rotating one.
    """
    user = await require_user(request)
    hashed = hash_password(body.password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": hashed,
            "password_set_at": now_iso(),
            "email_verified": True,
            "updated_date": now_iso(),
        }},
    )
    await db.login_attempts.delete_many({"email": user["email"]})
    return {"ok": True}


@router.post("/api/auth/reset-password")
async def reset_password(body: ResetPasswordBody, response: Response):
    """One-shot reset: email + OTP + new password. Returns a fresh JWT."""
    email = body.email.lower().strip()
    await _consume_otp(email, body.code)

    user = await _ensure_user(email)
    hashed = hash_password(body.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": hashed,
            "password_set_at": now_iso(),
            "email_verified": True,
            "updated_date": now_iso(),
        }},
    )
    await db.login_attempts.delete_many({"email": email})

    token = make_token(user["id"])
    _set_session_cookie(response, token)
    profile = await db.profiles.find_one({"user_id": user["id"]})
    return {
        "token": token,
        "user": serialize(user),
        "profile": serialize(profile),
        "needs_password_setup": False,
    }


# --------------------------------------------------------------------------- #
# Session
# --------------------------------------------------------------------------- #
@router.get("/api/auth/me")
async def me(request: Request):
    user = await current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


@router.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie("spotd_token", path="/")
    return {"ok": True}
