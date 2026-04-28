"""Passwordless OTP login + JWT issuance + /me + logout."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr

from core import (
    ADMIN_EMAIL, EMAIL_LOGO_URL, EMAIL_MOCK,
    current_user, db, make_token, new_id, now_iso, send_email, serialize,
)

router = APIRouter()


class RequestCodeBody(BaseModel):
    email: EmailStr


class VerifyCodeBody(BaseModel):
    email: EmailStr
    code: str


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
      <img src="{EMAIL_LOGO_URL}" alt="Spot&#39;d" width="120" style="display:block;margin-bottom:32px;border:0;outline:none;" />
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


@router.post("/api/auth/verify-code")
async def verify_login_code(body: VerifyCodeBody, response: Response):
    email = body.email.lower().strip()
    code_record = await db.login_codes.find_one(
        {"email": email, "used": False},
        sort=[("created_at", -1)],
    )
    if not code_record:
        raise HTTPException(400, "No active code. Request a new one.")
    if datetime.fromisoformat(code_record["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Code expired.")
    attempts = code_record.get("attempts", 0) + 1
    if attempts >= 5 and code_record["code"] != body.code:
        await db.login_codes.update_one({"id": code_record["id"]}, {"$set": {"used": True, "attempts": attempts}})
        raise HTTPException(400, "Too many attempts. Request a new code.")
    if code_record["code"] != body.code:
        await db.login_codes.update_one({"id": code_record["id"]}, {"$set": {"attempts": attempts}})
        raise HTTPException(400, "Invalid code.")

    await db.login_codes.update_one({"id": code_record["id"]}, {"$set": {"used": True, "attempts": attempts}})

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
        }
        await db.users.insert_one(user)
    else:
        update = {"updated_date": now_iso()}
        if not user.get("first_login_at"):
            update["first_login_at"] = now_iso()
            user["first_login_at"] = update["first_login_at"]
        await db.users.update_one({"id": user["id"]}, {"$set": update})

    token = make_token(user["id"])
    response.set_cookie(
        "spotd_token", token, max_age=60 * 60 * 24 * 30,
        httponly=False, samesite="lax", path="/", secure=False,
    )

    profile = await db.profiles.find_one({"user_id": user["id"]})
    return {
        "token": token,
        "user": serialize(user),
        "profile": serialize(profile),
    }


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
