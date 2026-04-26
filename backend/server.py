"""Spot'd backend - FastAPI + MongoDB.

Generic entity CRUD that mirrors Base44 SDK contract used by the React frontend:
- GET    /api/entities/{Entity}              (list/filter via query string)
- POST   /api/entities/{Entity}              (create)
- GET    /api/entities/{Entity}/{id}         (read one)
- PATCH  /api/entities/{Entity}/{id}         (update)
- DELETE /api/entities/{Entity}/{id}         (delete)
- POST   /api/functions/{name}               (named function endpoints)
- /api/auth/*    OTP email-code auth
"""
from dotenv import load_dotenv
load_dotenv()

import os
import re
import json
import uuid
import secrets
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Any

import jwt
from fastapi import FastAPI, HTTPException, Request, Response, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# --------------------------------------------------------------------------- #
# Setup
# --------------------------------------------------------------------------- #
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("spotd")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
APP_URL = os.environ.get("APP_URL", "")
PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "https://getspotd.app")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").lower().strip()
EMAIL_MOCK = os.environ.get("EMAIL_MOCK_MODE", "true").lower() == "true"
SMS_MOCK = os.environ.get("SMS_MOCK_MODE", "true").lower() == "true"

JWT_ALG = "HS256"

mongo = AsyncIOMotorClient(MONGO_URL)
db = mongo[DB_NAME]

app = FastAPI(title="Spot'd API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = AsyncIOScheduler(timezone="UTC")

# --------------------------------------------------------------------------- #
# Entity registry — every entity stored in its own collection, mirroring Base44.
# Entity name -> collection name (lowercase plural-ish).
# Endorsement is aliased to Spot for backwards-compat with the legacy code paths.
# --------------------------------------------------------------------------- #
ENTITIES = {
    "User": "users",
    "Profile": "profiles",
    "Subscription": "subscriptions",
    "CastingCall": "casting_calls",
    "CastingApplication": "casting_applications",
    "Spot": "spots",
    "Endorsement": "spots",  # legacy alias
    "SpotRequest": "spot_requests",
    "SavedProfile": "saved_profiles",
    "ContactReveal": "contact_reveals",
    "RoleAlert": "role_alerts",
    "Notification": "notifications",
    "SpottedWith": "spotted_with",
    "VerificationCode": "verification_codes",
    "ProfileView": "profile_views",
    "PortfolioClick": "portfolio_clicks",
    "SearchAppearance": "search_appearances",
    "CompanyProfile": "company_profiles",
    "PaymentTransaction": "payment_transactions",
}

# Public entities that anonymous users can list/read.
PUBLIC_READ = {"Profile", "CompanyProfile", "CastingCall", "Spot", "Endorsement",
               "SpottedWith", "SavedProfile", "ContactReveal", "ProfileView",
               "PortfolioClick", "SearchAppearance", "Notification",
               "Subscription", "SpotRequest", "RoleAlert", "User",
               "CastingApplication"}

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex[:24]


def slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or new_id()[:8]


def serialize(doc: Optional[dict]) -> Optional[dict]:
    """Strip internal fields (mongo _id) from a document for JSON output."""
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


def make_token(user_id: str, days: int = 30) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=days),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None


async def current_user(request: Request) -> Optional[dict]:
    """Return the user document, or None if not authenticated."""
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        token = request.cookies.get("spotd_token")
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user = await db.users.find_one({"id": payload["sub"]})
    return serialize(user)


async def require_user(request: Request) -> dict:
    user = await current_user(request)
    if not user:
        raise HTTPException(401, "Unauthorized")
    return user


# --------------------------------------------------------------------------- #
# Email & SMS (mockable)
# --------------------------------------------------------------------------- #
async def send_email(to: str, subject: str, html: str, from_name: str = "Spot'd"):
    if EMAIL_MOCK or not os.environ.get("POSTMARK_API_KEY"):
        log.info("[EMAIL MOCK] to=%s subject=%s", to, subject)
        # Persist for inspection during dev / tests
        await db.email_log.insert_one({
            "id": new_id(), "to": to, "subject": subject,
            "html": html, "from_name": from_name,
            "created_at": now_iso(), "mocked": True,
        })
        return True
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.postmarkapp.com/email",
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Postmark-Server-Token": os.environ["POSTMARK_API_KEY"],
                },
                json={
                    "From": f"{from_name} <{os.environ.get('POSTMARK_FROM_EMAIL', 'hello@getspotd.app')}>",
                    "To": to,
                    "Subject": subject,
                    "HtmlBody": html,
                    "MessageStream": "outbound",
                },
            )
            return r.status_code < 400
    except Exception as e:
        log.error("Postmark send failed: %s", e)
        return False


async def send_sms(to: str, body: str):
    if SMS_MOCK or not os.environ.get("TWILIO_ACCOUNT_SID"):
        log.info("[SMS MOCK] to=%s body=%s", to, body)
        await db.sms_log.insert_one({
            "id": new_id(), "to": to, "body": body,
            "created_at": now_iso(), "mocked": True,
        })
        return True
    try:
        import httpx
        sid = os.environ["TWILIO_ACCOUNT_SID"]
        async with httpx.AsyncClient(timeout=10, auth=(sid, os.environ["TWILIO_AUTH_TOKEN"])) as client:
            r = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                data={"From": os.environ["TWILIO_PHONE_NUMBER"], "To": to, "Body": body},
            )
            return r.status_code < 400
    except Exception as e:
        log.error("Twilio send failed: %s", e)
        return False


# --------------------------------------------------------------------------- #
# Auth endpoints
# --------------------------------------------------------------------------- #
class RequestCodeBody(BaseModel):
    email: EmailStr


class VerifyCodeBody(BaseModel):
    email: EmailStr
    code: str


@app.post("/api/auth/request-code")
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
      <h1 style="font-family:'Sora',Arial,sans-serif;color:#E8FC6C;margin:0 0 16px;">Spot'd</h1>
      <p>Your sign-in code is:</p>
      <h2 style="letter-spacing:6px;font-size:36px;color:#E8FC6C;margin:16px 0;">{code}</h2>
      <p style="color:#888">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
    </div>
    """
    await send_email(email, "Your Spot'd sign-in code", html)
    payload = {"success": True}
    if EMAIL_MOCK:
        payload["dev_code"] = code  # surfaced in mock mode for testing
    return payload


@app.post("/api/auth/verify-code")
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

    # Find or create user
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
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {"updated_date": now_iso()}})

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


@app.get("/api/auth/me")
async def me(request: Request):
    user = await current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie("spotd_token", path="/")
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Generic entity CRUD
# --------------------------------------------------------------------------- #
def coll(entity: str):
    if entity not in ENTITIES:
        raise HTTPException(404, f"Unknown entity: {entity}")
    return db[ENTITIES[entity]]


def parse_value(v: str) -> Any:
    if v is None:
        return None
    if v == "true":
        return True
    if v == "false":
        return False
    if v == "null":
        return None
    try:
        if v.isdigit():
            return int(v)
        return float(v) if "." in v else v
    except (ValueError, AttributeError):
        return v


@app.get("/api/entities/{entity}")
async def list_entity(entity: str, request: Request):
    """List with optional ?filter=<json>&sort=<-field|field>&limit=<n>&skip=<n>"""
    if entity not in ENTITIES:
        raise HTTPException(404, "Unknown entity")
    user = await current_user(request)
    if entity not in PUBLIC_READ and not user:
        raise HTTPException(401, "Unauthorized")

    qp = dict(request.query_params)
    filter_raw = qp.pop("filter", None)
    sort_raw = qp.pop("sort", "-created_date")
    limit = int(qp.pop("limit", "100"))
    skip = int(qp.pop("skip", "0"))

    # Build mongo filter
    mongo_filter: dict = {}
    if filter_raw:
        try:
            mongo_filter = json.loads(filter_raw)
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid filter JSON")
    # Any remaining query params become equality filters
    for k, v in qp.items():
        mongo_filter[k] = parse_value(v)

    # Sort
    sort_list = []
    if sort_raw:
        if sort_raw.startswith("-"):
            sort_list.append((sort_raw[1:], -1))
        else:
            sort_list.append((sort_raw, 1))

    cursor = coll(entity).find(mongo_filter, {"_id": 0}).skip(skip).limit(limit)
    if sort_list:
        cursor = cursor.sort(sort_list)
    items = await cursor.to_list(length=limit)
    return items


@app.post("/api/entities/{entity}")
async def create_entity(entity: str, request: Request):
    user = await current_user(request)
    if not user and entity not in {"VerificationCode", "ProfileView", "SearchAppearance"}:
        # allow some passive entities anonymous
        if entity != "Profile":
            raise HTTPException(401, "Unauthorized")

    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(400, "Body must be an object")

    doc = dict(payload)
    doc["id"] = doc.get("id") or new_id()
    doc.setdefault("created_date", now_iso())
    doc["updated_date"] = now_iso()
    if user:
        doc.setdefault("created_by", user["id"])

    # Special handling
    if entity == "Profile":
        if not doc.get("user_id") and user:
            doc["user_id"] = user["id"]
        if not doc.get("profile_slug") and doc.get("full_name"):
            base = slugify(doc["full_name"])
            slug = base
            i = 1
            while await db.profiles.find_one({"profile_slug": slug}):
                i += 1
                slug = f"{base}-{i}"
            doc["profile_slug"] = slug
        # initialise score fields
        doc.setdefault("spot_score", 0)
        doc.setdefault("spot_percentile", 0)
    elif entity == "Subscription":
        # Sensible defaults from tier
        tier = doc.get("tier", "free")
        defaults = {
            "free":    {"contact_reveal_limit": 5,  "casting_call_limit": 1,  "can_boost": False},
            "pro":     {"contact_reveal_limit": -1, "casting_call_limit": 5,  "can_boost": True},
            "elite":   {"contact_reveal_limit": -1, "casting_call_limit": -1, "can_boost": True},
            "founder": {"contact_reveal_limit": -1, "casting_call_limit": -1, "can_boost": True},
        }
        for k, v in defaults.get(tier, {}).items():
            doc.setdefault(k, v)
        doc.setdefault("status", "active")
        doc.setdefault("started_at", now_iso())
    elif entity == "Spot" or entity == "Endorsement":
        # ensure spot fields populated for legacy callers
        doc.setdefault("created_date", now_iso())

    target = coll(entity)
    # uniqueness: profile_slug
    if entity == "Profile":
        if await db.profiles.find_one({"profile_slug": doc["profile_slug"]}):
            base = doc["profile_slug"]
            i = 2
            while await db.profiles.find_one({"profile_slug": f"{base}-{i}"}):
                i += 1
            doc["profile_slug"] = f"{base}-{i}"
    await target.insert_one(doc.copy())
    doc.pop("_id", None)

    # Trigger SpotScore recalc if relevant
    await maybe_recalc_score(entity, doc)
    return doc


@app.get("/api/entities/{entity}/{item_id}")
async def get_entity(entity: str, item_id: str, request: Request):
    user = await current_user(request)
    if entity not in PUBLIC_READ and not user:
        raise HTTPException(401, "Unauthorized")
    item = await coll(entity).find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Not found")
    return item


@app.patch("/api/entities/{entity}/{item_id}")
@app.put("/api/entities/{entity}/{item_id}")
async def update_entity(entity: str, item_id: str, request: Request):
    user = await require_user(request)
    payload = await request.json()
    payload.pop("_id", None)
    payload.pop("id", None)
    payload["updated_date"] = now_iso()
    res = await coll(entity).update_one({"id": item_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    item = await coll(entity).find_one({"id": item_id}, {"_id": 0})
    await maybe_recalc_score(entity, item)
    return item


@app.delete("/api/entities/{entity}/{item_id}")
async def delete_entity(entity: str, item_id: str, request: Request):
    user = await require_user(request)
    item = await coll(entity).find_one({"id": item_id}, {"_id": 0})
    await coll(entity).delete_one({"id": item_id})
    if item:
        await maybe_recalc_score(entity, item)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Spot score
# --------------------------------------------------------------------------- #
async def calculate_spot_score(profile: dict) -> int:
    pid = profile["id"]
    user_id = profile.get("user_id")
    score = 0
    # Completeness (25)
    if profile.get("profile_photo"): score += 5
    if profile.get("bio"): score += 5
    if profile.get("primary_role"): score += 3
    if profile.get("city"): score += 2
    if profile.get("imdb_link"): score += 5
    if profile.get("showreel_link"): score += 5
    # Verified (15)
    if profile.get("email_verified"): score += 7
    if profile.get("phone_verified"): score += 8
    # Spots received (25)
    spots = await db.spots.count_documents({"spotted_profile_id": pid})
    if spots >= 10: score += 25
    elif spots >= 6: score += 20
    elif spots >= 3: score += 14
    elif spots >= 1: score += 8
    # Social credibility (25)
    saved_by = await db.saved_profiles.count_documents({"profile_id": pid})
    if saved_by >= 15: score += 17
    elif saved_by >= 5: score += 12
    elif saved_by >= 1: score += 5
    revealed = await db.contact_reveals.count_documents({"profile_id": pid})
    if revealed >= 3: score += 5
    confirmed_sw = await db.spotted_with.count_documents({
        "$and": [{"$or": [{"profile_id_a": pid}, {"profile_id_b": pid}]}, {"confirmed": True}]
    })
    if confirmed_sw >= 1: score += 3
    # Engagement (10)
    if user_id:
        seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        u = await db.users.find_one({"id": user_id})
        if u and u.get("updated_date", "") > seven_days_ago:
            score += 3
        applied = await db.casting_applications.count_documents({"applicant_user_id": user_id})
        if applied: score += 4
        posted = await db.casting_calls.count_documents({"creator_user_id": user_id})
        if posted: score += 3
    return min(score, 100)


async def recalc_percentiles():
    profiles = await db.profiles.find({}, {"id": 1, "spot_score": 1, "_id": 0}).to_list(length=10000)
    if not profiles:
        return
    scores = [p.get("spot_score", 0) for p in profiles]
    n = len(scores)
    for p in profiles:
        below = sum(1 for s in scores if s < p.get("spot_score", 0))
        pct = round(below / n * 100) if n else 0
        await db.profiles.update_one({"id": p["id"]}, {"$set": {"spot_percentile": pct}})


async def recalculate_spot_score(profile_id: str) -> Optional[int]:
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        return None
    score = await calculate_spot_score(profile)
    await db.profiles.update_one({"id": profile_id}, {"$set": {"spot_score": score}})
    await recalc_percentiles()
    return score


SCORE_TRIGGERS = {
    "Profile": lambda d: d.get("id"),
    "Spot": lambda d: d.get("spotted_profile_id"),
    "Endorsement": lambda d: d.get("spotted_profile_id") or d.get("profile_id"),
    "SavedProfile": lambda d: d.get("profile_id"),
    "ContactReveal": lambda d: d.get("profile_id"),
    "SpottedWith": lambda d: d.get("profile_id_a"),
    "CastingApplication": lambda d: None,  # recalc applicant — see below
    "CastingCall": lambda d: None,
}


async def maybe_recalc_score(entity: str, doc: Optional[dict]):
    if not doc:
        return
    try:
        if entity == "CastingApplication":
            user_id = doc.get("applicant_user_id")
            if user_id:
                p = await db.profiles.find_one({"user_id": user_id}, {"id": 1, "_id": 0})
                if p:
                    await recalculate_spot_score(p["id"])
            return
        if entity == "CastingCall":
            user_id = doc.get("creator_user_id")
            if user_id:
                p = await db.profiles.find_one({"user_id": user_id}, {"id": 1, "_id": 0})
                if p:
                    await recalculate_spot_score(p["id"])
            return
        getter = SCORE_TRIGGERS.get(entity)
        if getter:
            pid = getter(doc)
            if pid:
                await recalculate_spot_score(pid)
    except Exception as e:
        log.exception("score recalc failed: %s", e)


# --------------------------------------------------------------------------- #
# Functions endpoints — POST /api/functions/{name}
# --------------------------------------------------------------------------- #
@app.post("/api/functions/recalculateSpotScore")
async def fn_recalc(request: Request):
    user = await require_user(request)
    body = await request.json()
    pid = body.get("profile_id")
    if not pid:
        if user.get("role") != "admin":
            raise HTTPException(403, "Forbidden")
        profiles = await db.profiles.find({}, {"id": 1, "_id": 0}).to_list(length=10000)
        for p in profiles:
            await recalculate_spot_score(p["id"])
        return {"success": True, "recalculated": len(profiles)}
    score = await recalculate_spot_score(pid)
    return {"success": True, "spot_score": score}


@app.post("/api/functions/triggerSpotScore")
async def fn_trigger(request: Request):
    body = await request.json()
    pid = body.get("profile_id")
    if pid:
        score = await recalculate_spot_score(pid)
        return {"success": True, "spot_score": score}
    return {"success": True}


@app.post("/api/functions/sendVerificationCode")
async def fn_send_verification(request: Request):
    user = await require_user(request)
    body = await request.json()
    code_type = body.get("type")
    if code_type not in ("email", "phone"):
        raise HTTPException(400, "Invalid type")

    ten_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    recent = await db.verification_codes.count_documents({
        "user_id": user["id"], "type": code_type, "created_date": {"$gt": ten_min_ago},
    })
    if recent >= 3:
        raise HTTPException(429, "Too many verification attempts. Please wait 10 minutes.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    # Invalidate prior unused codes
    await db.verification_codes.update_many(
        {"user_id": user["id"], "type": code_type, "used": False},
        {"$set": {"used": True}},
    )
    await db.verification_codes.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "code": code,
        "type": code_type,
        "expires_at": expires,
        "used": False,
        "attempts": 0,
        "created_date": now_iso(),
    })
    if code_type == "email":
        html = f"<p>Your Spot'd verification code is:</p><h2 style='letter-spacing:6px;font-size:32px;'>{code}</h2><p>Valid 10 minutes.</p>"
        await send_email(user["email"], "Spot'd — Your Verification Code", html)
    else:
        phone = body.get("phone") or ""
        if not phone:
            raise HTTPException(400, "Phone required")
        await send_sms(phone, f"Your Spot'd verification code is: {code}. Valid for 10 minutes.")
    out = {"success": True}
    if EMAIL_MOCK and code_type == "email":
        out["dev_code"] = code
    if SMS_MOCK and code_type == "phone":
        out["dev_code"] = code
    return out


@app.post("/api/functions/verifyCode")
async def fn_verify_code(request: Request):
    user = await require_user(request)
    body = await request.json()
    code_type = body.get("type")
    code = body.get("code")
    rec = await db.verification_codes.find_one(
        {"user_id": user["id"], "type": code_type, "used": False},
        sort=[("created_date", -1)],
    )
    if not rec or datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Invalid or expired code")
    attempts = rec.get("attempts", 0) + 1
    if attempts >= 5 and rec["code"] != code:
        await db.verification_codes.update_one({"id": rec["id"]}, {"$set": {"used": True, "attempts": attempts}})
        raise HTTPException(400, "Too many incorrect attempts. Please request a new code.")
    if rec["code"] != code:
        await db.verification_codes.update_one({"id": rec["id"]}, {"$set": {"attempts": attempts}})
        raise HTTPException(400, "Invalid code")
    await db.verification_codes.update_one({"id": rec["id"]}, {"$set": {"used": True, "attempts": attempts}})

    profile = await db.profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if profile:
        update = {"email_verified": True} if code_type == "email" else {"phone_verified": True}
        await db.profiles.update_one({"id": profile["id"]}, {"$set": update})
        await recalculate_spot_score(profile["id"])
    return {"success": True}


@app.post("/api/functions/sendWelcomeEmail")
async def fn_send_welcome(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    profile_id = body.get("profile_id")
    tier = (body.get("tier") or "pro").upper()
    user = await db.users.find_one({"id": user_id})
    profile = await db.profiles.find_one({"id": profile_id})
    if not user or not profile:
        raise HTTPException(404, "User or profile not found")
    first = (profile.get("preferred_name") or profile.get("full_name") or "there").split(" ")[0]
    score = profile.get("spot_score", 0)
    slug = profile.get("profile_slug") or profile_id
    html = f"""
<div style="background:#0D0D0D;color:#fff;font-family:'DM Sans',Arial,sans-serif;padding:40px 24px;">
  <div style="max-width:600px;margin:0 auto;">
    <div style="font-family:'Sora',Arial,sans-serif;font-size:24px;font-weight:700;color:#E8FC6C;margin-bottom:32px;">Spot'd</div>
    <h1 style="font-family:'Sora',Arial,sans-serif;font-size:28px;color:#fff;margin:0 0 12px;">Hey {first},</h1>
    <p style="color:#ccc;font-size:16px;line-height:1.6;">Your Spot'd profile is <strong style="color:#fff;">live in the directory.</strong></p>
    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:24px;margin:28px 0;">
      <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#888;font-weight:600;">Your plan</p>
      <h2 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:22px;color:#E8FC6C;">12 months of {tier} access — on us.</h2>
      <p style="margin:8px 0 0;color:#888;font-size:14px;">No credit card needed. No catch.</p>
    </div>
    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:20px 24px;margin:24px 0;">
      <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#888;">Your SpotScore</p>
      <p style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:32px;font-weight:700;color:#E8FC6C;">{score}<span style="font-size:16px;color:#888;font-weight:400;">/100</span></p>
    </div>
    <p style="color:#ccc;">Sign in: <a href="{PUBLIC_APP_URL}/login" style="color:#E8FC6C;text-decoration:none;font-weight:600;">{PUBLIC_APP_URL}/login</a> — enter your email, get a one-time code. No password.</p>
    <a href="{PUBLIC_APP_URL}/u/{slug}" style="display:inline-block;background:#E8FC6C;color:#0D0D0D;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:8px;margin-top:20px;">View your profile →</a>
    <p style="color:#888;margin-top:32px;">— The Spot'd team</p>
  </div>
</div>
    """
    await send_email(user["email"], "Your Spot'd profile is live", html)
    await db.profiles.update_one({"id": profile_id}, {"$set": {
        "welcome_email_sent": True,
        "welcome_email_sent_at": now_iso(),
    }})
    return {"success": True, "sent_to": user["email"]}


@app.post("/api/functions/respondToSpotRequest")
async def fn_respond_spot(request: Request):
    user = await require_user(request)
    body = await request.json()
    request_id = body.get("request_id")
    action = body.get("action")
    if action not in ("accepted", "declined") or not request_id:
        raise HTTPException(400, "Invalid params")
    rec = await db.spot_requests.find_one({"id": request_id})
    if not rec:
        raise HTTPException(404, "Not found")
    if rec.get("target_user_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if rec.get("status") != "pending":
        raise HTTPException(400, "Already responded")
    await db.spot_requests.update_one(
        {"id": request_id},
        {"$set": {"status": action, "responded_at": now_iso(), "updated_date": now_iso()}},
    )
    requester_profile = await db.profiles.find_one({"id": rec["requester_profile_id"]})
    requester_user_id = requester_profile.get("user_id") if requester_profile else None

    if action == "accepted":
        spot_doc = {
            "id": new_id(),
            "spotter_user_id": user["id"],
            "spotter_profile_id": (await db.profiles.find_one({"user_id": user["id"]}, {"id": 1}) or {}).get("id"),
            "spotted_profile_id": rec["requester_profile_id"],
            "spotted_user_id": requester_user_id,
            "spot_type": rec.get("spot_type"),
            "created_date": now_iso(),
        }
        await db.spots.insert_one(spot_doc.copy())
        if requester_user_id:
            await db.notifications.insert_one({
                "id": new_id(),
                "user_id": requester_user_id,
                "type": "spot_accepted",
                "title": f"{user.get('full_name', 'Someone')} spotted you!",
                "body": f"as \"{rec.get('spot_type')}\" — your SpotScore has been updated",
                "action_url": f"/u/{requester_profile.get('profile_slug', '')}",
                "link": f"/u/{requester_profile.get('profile_slug', '')}",
                "is_read": False,
                "created_date": now_iso(),
            })
        await recalculate_spot_score(rec["requester_profile_id"])
    else:
        if requester_user_id:
            await db.notifications.insert_one({
                "id": new_id(),
                "user_id": requester_user_id,
                "type": "spot_declined",
                "title": "Spot request update",
                "body": f"{user.get('full_name', 'Someone')} isn't able to Spot you right now",
                "is_read": False,
                "created_date": now_iso(),
            })
    return {"success": True}


@app.post("/api/functions/sendRoleAlertNotifications")
async def fn_role_alert_notifications(request: Request):
    body = await request.json()
    casting_call_id = body.get("casting_call_id")
    call = await db.casting_calls.find_one({"id": casting_call_id})
    if not call or not call.get("is_active", True):
        return {"success": True, "matched": 0}
    deadline = call.get("deadline")
    if deadline and deadline < now_iso():
        return {"success": True, "matched": 0}
    alerts = await db.role_alerts.find({"is_active": True}).to_list(length=1000)
    title = (call.get("project_title") or "").lower()
    desc = (call.get("description") or "").lower()
    location = (call.get("location") or "").lower()
    needed = [r.lower() for r in (call.get("roles_needed") or [])]
    matched = 0
    for a in alerts:
        roles = a.get("roles") or []
        if roles and not any(r.lower() in needed or r.lower() in desc for r in roles):
            continue
        keywords = a.get("keywords") or []
        if keywords and not any(k.lower() in title or k.lower() in desc for k in keywords):
            continue
        locs = a.get("locations") or []
        if locs and not any(l.lower() in location for l in locs):
            continue
        # de-dup
        existing = await db.notifications.find_one({
            "user_id": a["user_id"],
            "type": "role_alert",
            "meta.casting_call_id": casting_call_id,
        })
        if existing:
            continue
        await db.notifications.insert_one({
            "id": new_id(),
            "user_id": a["user_id"],
            "type": "role_alert",
            "title": f"New casting call: {call.get('project_title')}",
            "body": call.get("description", "")[:160],
            "action_url": f"/casting?call={casting_call_id}",
            "link": f"/casting?call={casting_call_id}",
            "is_read": False,
            "meta": {"casting_call_id": casting_call_id},
            "created_date": now_iso(),
        })
        matched += 1
        if a.get("frequency") == "instant" and a.get("email_notifications", True):
            user = await db.users.find_one({"id": a["user_id"]})
            if user:
                html = f"<p>New casting call: <strong>{call.get('project_title')}</strong></p><p>{call.get('description','')[:300]}</p><p><a href='{PUBLIC_APP_URL}/casting'>View on Spot'd</a></p>"
                await send_email(user["email"], f"New role alert — {call.get('project_title')}", html)
    return {"success": True, "matched": matched}


@app.post("/api/functions/runSpottedWithMatching")
async def fn_run_spotted_with(request: Request):
    return await _run_spotted_with()


async def _run_spotted_with():
    profiles = await db.profiles.find({"credits": {"$exists": True, "$ne": []}}, {"_id": 0}).to_list(length=5000)
    new_records = 0
    for i, a in enumerate(profiles):
        a_titles = {(c.get("project_title") or "").strip().lower() for c in (a.get("credits") or []) if c.get("project_title")}
        for b in profiles[i + 1:]:
            b_titles = {(c.get("project_title") or "").strip().lower() for c in (b.get("credits") or []) if c.get("project_title")}
            common = a_titles & b_titles
            if not common:
                continue
            id_a, id_b = sorted([a["id"], b["id"]])
            existing = await db.spotted_with.find_one({"profile_id_a": id_a, "profile_id_b": id_b})
            primary = sorted(common)[0]
            if existing:
                await db.spotted_with.update_one(
                    {"id": existing["id"]},
                    {"$set": {"projects_matched": list(common), "updated_date": now_iso()}},
                )
            else:
                await db.spotted_with.insert_one({
                    "id": new_id(),
                    "profile_id_a": id_a,
                    "profile_id_b": id_b,
                    "project_title": primary,
                    "projects_matched": list(common),
                    "match_confidence": "exact",
                    "confirmed": False,
                    "times_matched": len(common),
                    "created_date": now_iso(),
                })
                new_records += 1
    return {"success": True, "new_matches": new_records}


@app.post("/api/functions/purgeVerificationCodes")
async def fn_purge_codes(request: Request):
    return await _purge_codes()


async def _purge_codes():
    now = now_iso()
    res = await db.verification_codes.delete_many({"$or": [{"used": True}, {"expires_at": {"$lt": now}}]})
    res2 = await db.login_codes.delete_many({"$or": [{"used": True}, {"expires_at": {"$lt": now}}]})
    return {"success": True, "deleted": res.deleted_count + res2.deleted_count}


@app.post("/api/functions/onCastingApplicationChange")
async def fn_casting_app_change(request: Request):
    body = await request.json()
    event = body.get("event", {})
    data = body.get("data", {})
    old = body.get("old_data", {})
    if event.get("type") == "create":
        call = await db.casting_calls.find_one({"id": data.get("casting_call_id")})
        if call:
            await db.notifications.insert_one({
                "id": new_id(),
                "user_id": call["creator_user_id"],
                "type": "casting_match",
                "title": f"New application for {call.get('project_title')}",
                "body": f"{data.get('applicant_name', 'Someone')} applied for {data.get('role_applied_for', 'a role')}",
                "link": f"/casting/applications?call={call['id']}",
                "action_url": f"/casting/applications?call={call['id']}",
                "is_read": False,
                "created_date": now_iso(),
            })
            await db.casting_calls.update_one(
                {"id": call["id"]},
                {"$inc": {"application_count": 1}},
            )
    elif event.get("type") == "update" and old and data.get("status") != old.get("status"):
        field = {
            "viewed": "viewed_at", "shortlisted": "shortlisted_at",
            "rejected": "rejected_at", "booked": "booked_at",
        }.get(data.get("status"))
        if field:
            await db.casting_applications.update_one(
                {"id": data["id"]}, {"$set": {field: now_iso()}}
            )
    return {"ok": True}


@app.post("/api/functions/sendDailyWeeklyAlerts")
async def fn_daily_weekly():
    return await _send_daily_weekly()


async def _send_daily_weekly(frequency: str = "daily"):
    alerts = await db.role_alerts.find({"is_active": True, "frequency": frequency, "email_notifications": True}).to_list(length=10000)
    sent = 0
    one_day_ago = (datetime.now(timezone.utc) - timedelta(days=1 if frequency == "daily" else 7)).isoformat()
    for a in alerts:
        # All notifications for this alert in the window
        notifications = await db.notifications.find({
            "user_id": a["user_id"], "type": "role_alert",
            "created_date": {"$gt": one_day_ago},
        }).to_list(length=50)
        if not notifications:
            continue
        user = await db.users.find_one({"id": a["user_id"]})
        if not user:
            continue
        items_html = "".join(
            f"<li><strong>{n.get('title','')}</strong> — {n.get('body','')}</li>" for n in notifications
        )
        html = f"<p>Your {frequency} role alert digest:</p><ul>{items_html}</ul><p><a href='{PUBLIC_APP_URL}/casting'>View all on Spot'd</a></p>"
        await send_email(user["email"], f"Spot'd {frequency} digest", html)
        sent += 1
    return {"success": True, "sent": sent}


# --------------------------------------------------------------------------- #
# Stripe payments
# --------------------------------------------------------------------------- #
PLANS = {
    "pro_monthly":   {"amount": 9.99,   "currency": "aud", "tier": "pro",   "label": "PRO Monthly",   "billing": "monthly"},
    "pro_annual":    {"amount": 79.00,  "currency": "aud", "tier": "pro",   "label": "PRO Annual",    "billing": "annual"},
    "elite_monthly": {"amount": 14.99,  "currency": "aud", "tier": "elite", "label": "Elite Monthly", "billing": "monthly"},
    "elite_annual":  {"amount": 149.00, "currency": "aud", "tier": "elite", "label": "Elite Annual",  "billing": "annual"},
}


class CheckoutBody(BaseModel):
    plan_id: str
    origin_url: str


@app.post("/api/stripe/checkout")
async def stripe_checkout(body: CheckoutBody, request: Request):
    user = await require_user(request)
    if body.plan_id not in PLANS:
        raise HTTPException(400, "Invalid plan")
    plan = PLANS[body.plan_id]

    try:
        from emergentintegrations.payments.stripe.checkout import (
            StripeCheckout, CheckoutSessionRequest,
        )
    except Exception as e:
        raise HTTPException(500, f"Stripe lib unavailable: {e}")

    api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
    host_url = body.origin_url.rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    success_url = f"{host_url}/welcome?plan={plan['tier']}&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/pricing"
    metadata = {
        "user_id": user["id"], "plan_id": body.plan_id, "tier": plan["tier"], "billing": plan["billing"],
    }
    req = CheckoutSessionRequest(
        amount=plan["amount"], currency=plan["currency"],
        success_url=success_url, cancel_url=cancel_url, metadata=metadata,
    )
    session = await checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "id": new_id(),
        "session_id": session.session_id,
        "user_id": user["id"],
        "plan_id": body.plan_id,
        "tier": plan["tier"],
        "amount": plan["amount"],
        "currency": plan["currency"],
        "metadata": metadata,
        "payment_status": "initiated",
        "status": "pending",
        "created_date": now_iso(),
    })
    return {"url": session.url, "session_id": session.session_id}


@app.get("/api/stripe/status/{session_id}")
async def stripe_status(session_id: str):
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
    except Exception as e:
        raise HTTPException(500, f"Stripe lib unavailable: {e}")
    api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
    checkout = StripeCheckout(api_key=api_key, webhook_url="")
    status = await checkout.get_checkout_status(session_id)
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if txn and txn.get("payment_status") != "paid" and status.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": status.payment_status, "status": status.status, "updated_date": now_iso()}},
        )
        # Activate subscription idempotently
        await activate_subscription_for_session(session_id, status.metadata or txn.get("metadata", {}))
    return {
        "status": status.status, "payment_status": status.payment_status,
        "amount_total": status.amount_total, "currency": status.currency,
        "metadata": status.metadata,
    }


async def activate_subscription_for_session(session_id: str, metadata: dict):
    user_id = metadata.get("user_id")
    tier = metadata.get("tier")
    billing = metadata.get("billing")
    if not user_id or not tier:
        return
    expires = None
    if billing == "monthly":
        expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    elif billing == "annual":
        expires = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    existing = await db.subscriptions.find_one({"user_id": user_id})
    sub = {
        "tier": tier,
        "status": "active",
        "expires_at": expires,
        "started_at": now_iso(),
        "contact_reveal_limit": -1,
        "casting_call_limit": -1 if tier == "elite" else 5,
        "can_boost": True,
        "payment_reference": session_id,
        "updated_date": now_iso(),
    }
    if existing:
        await db.subscriptions.update_one({"id": existing["id"]}, {"$set": sub})
    else:
        sub.update({"id": new_id(), "user_id": user_id, "created_date": now_iso()})
        await db.subscriptions.insert_one(sub)


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        checkout = StripeCheckout(api_key=os.environ.get("STRIPE_API_KEY", "sk_test_emergent"), webhook_url="")
        evt = await checkout.handle_webhook(body, sig)
    except Exception as e:
        log.error("stripe webhook parse err: %s", e)
        return {"received": True}
    if evt.event_type in ("checkout.session.completed",) and evt.payment_status == "paid":
        await activate_subscription_for_session(evt.session_id, evt.metadata or {})
    elif evt.event_type in ("customer.subscription.deleted", "payment_intent.payment_failed"):
        # downgrade to free
        meta = evt.metadata or {}
        if meta.get("user_id"):
            await db.subscriptions.update_one(
                {"user_id": meta["user_id"]},
                {"$set": {"tier": "free", "status": "expired", "updated_date": now_iso()}},
            )
    elif evt.event_type in ("customer.subscription.updated", "invoice.payment_succeeded", "customer.subscription.renewed"):
        # renewal: extend expires_at
        meta = evt.metadata or {}
        if meta.get("user_id"):
            sub = await db.subscriptions.find_one({"user_id": meta["user_id"]})
            if sub:
                billing = meta.get("billing") or "monthly"
                base = datetime.fromisoformat(sub["expires_at"]) if sub.get("expires_at") else datetime.now(timezone.utc)
                base = max(base, datetime.now(timezone.utc))
                extended = base + timedelta(days=365 if billing == "annual" else 30)
                await db.subscriptions.update_one(
                    {"id": sub["id"]},
                    {"$set": {
                        "expires_at": extended.isoformat(),
                        "status": "active",
                        "updated_date": now_iso(),
                    }},
                )
    return {"received": True}


# --------------------------------------------------------------------------- #
# Postmark webhook (delivery / bounce / spam events)
# --------------------------------------------------------------------------- #
@app.post("/api/webhooks/postmark")
async def postmark_webhook(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    record_type = payload.get("RecordType") or payload.get("Type") or "Unknown"
    await db.postmark_events.insert_one({
        "id": new_id(),
        "record_type": record_type,
        "email": payload.get("Recipient") or payload.get("Email"),
        "message_id": payload.get("MessageID"),
        "raw": payload,
        "created_date": now_iso(),
    })
    return {"received": True}


# --------------------------------------------------------------------------- #
# Bulk import — admin only
# --------------------------------------------------------------------------- #
@app.post("/api/admin/bulk-import")
async def bulk_import(request: Request, background: BackgroundTasks):
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    body = await request.json()
    members = body.get("members") or []
    payment_reference = body.get("payment_reference", "cineconnect-import")
    send_welcome = bool(body.get("send_welcome", False))
    months = int(body.get("months", 12))

    seen_emails: set = set()
    imported = []
    skipped = []
    failed = []

    for m in members:
        email = (m.get("email") or "").strip().lower()
        if not email:
            failed.append({"name": m.get("full_name"), "reason": "missing email"})
            continue
        if email in seen_emails:
            skipped.append({"email": email, "reason": "duplicate in batch"})
            continue
        seen_emails.add(email)
        try:
            existing_user = await db.users.find_one({"email": email})
            if existing_user:
                user_doc = existing_user
                user_created = False
            else:
                user_doc = {
                    "id": new_id(),
                    "email": email,
                    "full_name": m.get("full_name"),
                    "role": "user",
                    "created_date": now_iso(),
                    "updated_date": now_iso(),
                }
                await db.users.insert_one(user_doc.copy())
                user_doc.pop("_id", None)
                user_created = True

            user_id = user_doc["id"]

            # Profile
            profile_doc = await db.profiles.find_one({"user_id": user_id})
            slug = (m.get("profile_slug") or slugify(m.get("full_name") or email)).lower()
            # ensure slug uniqueness if profile would be created
            if not profile_doc:
                base_slug = slug
                i = 2
                while await db.profiles.find_one({"profile_slug": slug}):
                    slug = f"{base_slug}-{i}"
                    i += 1
                profile_doc = {
                    "id": new_id(),
                    "user_id": user_id,
                    "full_name": m.get("full_name"),
                    "preferred_name": m.get("preferred_name"),
                    "pronouns": m.get("pronouns") or None,
                    "email": email,
                    "phone": m.get("phone") or None,
                    "city": m.get("city"),
                    "state": m.get("state"),
                    "country": m.get("country"),
                    "primary_role": m.get("primary_role") or "Other",
                    "secondary_roles": m.get("secondary_roles") or [],
                    "experience_level": m.get("experience_level") or "Entry",
                    "union_status": m.get("union_status") or ["Non-Union"],
                    "imdb_link": m.get("imdb_link") or None,
                    "showreel_link": m.get("showreel_link") or None,
                    "bio": m.get("bio") or "",
                    "profile_slug": slug,
                    "availability_status": m.get("availability_status") or "Available Now",
                    "spot_score": 0,
                    "spot_percentile": 0,
                    "import_source": payment_reference,
                    "import_notes": m.get("import_notes"),
                    "created_date": now_iso(),
                    "updated_date": now_iso(),
                }
                await db.profiles.insert_one(profile_doc.copy())
                profile_doc.pop("_id", None)

            # Subscription
            sub_doc = await db.subscriptions.find_one({"user_id": user_id})
            if not sub_doc:
                expires = (datetime.now(timezone.utc) + timedelta(days=30 * months)).isoformat()
                sub_doc = {
                    "id": new_id(),
                    "user_id": user_id,
                    "tier": "pro",
                    "status": "active",
                    "started_at": now_iso(),
                    "expires_at": expires,
                    "contact_reveal_limit": 20,
                    "casting_call_limit": 5,
                    "can_boost": True,
                    "payment_reference": payment_reference,
                    "created_date": now_iso(),
                    "updated_date": now_iso(),
                }
                await db.subscriptions.insert_one(sub_doc.copy())

            # Recalc score
            await recalculate_spot_score(profile_doc["id"])

            # Welcome email (only if explicitly requested — defaults to false)
            if send_welcome:
                try:
                    background.add_task(_send_welcome_internal, user_id, profile_doc["id"], "pro")
                except Exception:
                    pass

            imported.append({
                "email": email,
                "user_id": user_id,
                "profile_id": profile_doc["id"],
                "profile_slug": profile_doc.get("profile_slug"),
                "user_created": user_created,
            })
        except Exception as e:
            failed.append({"email": email, "reason": str(e)})

    return {
        "imported": len(imported),
        "skipped": len(skipped),
        "failed": len(failed),
        "details": {"imported": imported, "skipped": skipped, "failed": failed},
    }


async def _send_welcome_internal(user_id: str, profile_id: str, tier: str = "pro"):
    """Internal version of sendWelcomeEmail that doesn't require auth."""
    user = await db.users.find_one({"id": user_id})
    profile = await db.profiles.find_one({"id": profile_id})
    if not user or not profile:
        return
    first = (profile.get("preferred_name") or profile.get("full_name") or "there").split(" ")[0]
    score = profile.get("spot_score", 0)
    slug = profile.get("profile_slug") or profile_id
    tier_label = (tier or "pro").upper()
    html = f"""
<div style="background:#0D0D0D;color:#fff;font-family:'DM Sans',Arial,sans-serif;padding:40px 24px;">
  <div style="max-width:600px;margin:0 auto;">
    <div style="font-family:'Sora',Arial,sans-serif;font-size:24px;font-weight:700;color:#E8FC6C;margin-bottom:32px;">Spot'd</div>
    <h1 style="font-family:'Sora',Arial,sans-serif;font-size:28px;color:#fff;margin:0 0 12px;">Hey {first},</h1>
    <p style="color:#ccc;font-size:16px;line-height:1.6;">Your Spot'd profile is <strong style="color:#fff;">live in the directory.</strong></p>
    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:24px;margin:28px 0;">
      <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#888;font-weight:600;">Your plan</p>
      <h2 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:22px;color:#E8FC6C;">12 months of {tier_label} access — on us.</h2>
      <p style="margin:8px 0 0;color:#888;font-size:14px;">No credit card needed. No catch.</p>
    </div>
    <p style="color:#ccc;">Sign in: <a href="{PUBLIC_APP_URL}/login" style="color:#E8FC6C;text-decoration:none;font-weight:600;">{PUBLIC_APP_URL}/login</a></p>
    <a href="{PUBLIC_APP_URL}/u/{slug}" style="display:inline-block;background:#E8FC6C;color:#0D0D0D;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:8px;margin-top:20px;">View your profile →</a>
    <p style="color:#888;margin-top:32px;">— The Spot'd team</p>
  </div>
</div>
"""
    await send_email(user["email"], "Your Spot'd profile is live", html)
    await db.profiles.update_one({"id": profile_id}, {"$set": {
        "welcome_email_sent": True,
        "welcome_email_sent_at": now_iso(),
    }})


@app.post("/api/stripe/founder-claim")
async def claim_founder(request: Request):
    user = await require_user(request)
    count = await db.subscriptions.count_documents({"tier": "founder", "status": "active"})
    if count >= 500:
        raise HTTPException(400, "All 500 founding spots claimed")
    existing = await db.subscriptions.find_one({"user_id": user["id"]})
    sub = {
        "tier": "founder", "status": "active", "started_at": now_iso(),
        "expires_at": None, "contact_reveal_limit": -1, "casting_call_limit": -1,
        "can_boost": True, "updated_date": now_iso(),
    }
    if existing:
        await db.subscriptions.update_one({"id": existing["id"]}, {"$set": sub})
        return {"success": True, "subscription_id": existing["id"]}
    sub.update({"id": new_id(), "user_id": user["id"], "created_date": now_iso()})
    await db.subscriptions.insert_one(sub)
    return {"success": True, "subscription_id": sub["id"]}


@app.get("/api/stripe/founder-count")
async def founder_count():
    count = await db.subscriptions.count_documents({"tier": "founder", "status": "active"})
    return {"count": count, "remaining": max(0, 500 - count), "max": 500}


# --------------------------------------------------------------------------- #
# Health + meta
# --------------------------------------------------------------------------- #
@app.get("/api/health")
async def health():
    return {"ok": True, "time": now_iso()}


@app.get("/api/public-settings")
async def public_settings():
    return {
        "founder_remaining": max(0, 500 - await db.subscriptions.count_documents({"tier": "founder", "status": "active"})),
        "email_mock": EMAIL_MOCK,
        "sms_mock": SMS_MOCK,
    }


# --------------------------------------------------------------------------- #
# Startup: indexes, scheduled jobs, seed
# --------------------------------------------------------------------------- #
async def seed_initial_data():
    if not ADMIN_EMAIL:
        return
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing:
        user = existing
    else:
        user = {
            "id": new_id(),
            "email": ADMIN_EMAIL,
            "full_name": "Brendan Byrne",
            "role": "admin",
            "created_date": now_iso(),
            "updated_date": now_iso(),
        }
        await db.users.insert_one(user.copy())
    user_id = user["id"]
    profile = await db.profiles.find_one({"user_id": user_id})
    if not profile:
        profile_id = new_id()
        await db.profiles.insert_one({
            "id": profile_id,
            "user_id": user_id,
            "full_name": "Brendan Byrne",
            "preferred_name": "Brendan",
            "profile_slug": "brendanbyrneofficial",
            "primary_role": "Producer",
            "city": "Sydney",
            "state": "NSW",
            "country": "Australia",
            "bio": "Founder of Spot'd. Indie filmmaker, producer at Shadow Wolves Productions.",
            "email": ADMIN_EMAIL,
            "email_verified": True,
            "spot_score": 41,
            "spot_percentile": 99,
            "credits": [{"project_title": "Thunk", "role_on_project": "Producer", "year": 2024}],
            "availability_status": "Available Now",
            "created_date": now_iso(),
            "updated_date": now_iso(),
        })
        profile = await db.profiles.find_one({"user_id": user_id})
    sub = await db.subscriptions.find_one({"user_id": user_id})
    if not sub:
        await db.subscriptions.insert_one({
            "id": new_id(),
            "user_id": user_id,
            "tier": "founder",
            "status": "active",
            "started_at": now_iso(),
            "expires_at": None,
            "contact_reveal_limit": -1,
            "casting_call_limit": -1,
            "can_boost": True,
            "created_date": now_iso(),
            "updated_date": now_iso(),
        })
    call = await db.casting_calls.find_one({"project_title": "Thunk"})
    if not call:
        await db.casting_calls.insert_one({
            "id": new_id(),
            "creator_user_id": user_id,
            "creator_profile_id": profile["id"],
            "project_title": "Thunk",
            "project_type": "Short Film",
            "company_name": "Shadow Wolves Productions",
            "description": "Indie short film. Looking for cast and crew across Sydney.",
            "location": "Sydney, NSW",
            "is_active": True,
            "view_count": 0,
            "application_count": 0,
            "deadline": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat(),
            "roles_needed": ["Actor", "Cinematographer"],
            "application_method": "spot_button",
            "created_date": now_iso(),
            "updated_date": now_iso(),
        })


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.profiles.create_index("id", unique=True)
    await db.profiles.create_index("profile_slug", unique=True, sparse=True)
    await db.profiles.create_index("user_id")
    await db.subscriptions.create_index("user_id")
    await db.notifications.create_index([("user_id", 1), ("created_date", -1)])
    await db.spots.create_index("spotted_profile_id")
    await db.saved_profiles.create_index([("user_id", 1), ("profile_id", 1)])
    await db.casting_calls.create_index("creator_user_id")
    await db.casting_applications.create_index("casting_call_id")
    await db.role_alerts.create_index("user_id")
    await db.spotted_with.create_index([("profile_id_a", 1), ("profile_id_b", 1)])
    await db.verification_codes.create_index("user_id")
    await db.login_codes.create_index("email")
    await db.payment_transactions.create_index("session_id")


@app.on_event("startup")
async def on_startup():
    await create_indexes()
    await seed_initial_data()
    # Scheduled jobs
    scheduler.add_job(_run_spotted_with, CronTrigger(hour=2, minute=0))
    scheduler.add_job(_purge_codes, CronTrigger(hour=3, minute=0))
    scheduler.add_job(lambda: _send_daily_weekly("daily"), CronTrigger(hour=17, minute=0))
    scheduler.add_job(lambda: _send_daily_weekly("weekly"), CronTrigger(day_of_week="sun", hour=17, minute=0))
    scheduler.start()
    log.info("Spot'd backend started")


@app.on_event("shutdown")
async def on_shutdown():
    scheduler.shutdown(wait=False)
    mongo.close()
