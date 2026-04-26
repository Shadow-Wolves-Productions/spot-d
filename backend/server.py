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
import hmac
import hashlib
import base64
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Any
from pathlib import Path

import jwt
from fastapi import FastAPI, HTTPException, Request, Response, Depends, Query, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
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

# CORS — wildcard in dev, allowlist in production. The production list is the
# Spot'd domain plus its API subdomain plus localhost for QA tooling.
_PROD_ORIGINS = [
    "https://getspotd.app",
    "https://www.getspotd.app",
    "https://api.getspotd.app",
    "http://localhost:3000",
]
_IS_PROD = os.environ.get("ENV", "development").lower() == "production"
app.add_middleware(
    CORSMiddleware,
    allow_origins=_PROD_ORIGINS if _IS_PROD else ["*"],
    allow_credentials=_IS_PROD,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTTPS-only enforcement. Active only when ENV=production. Lets dev servers
# (http://localhost) keep working without redirect loops.
if os.environ.get("ENV", "development").lower() == "production":
    @app.middleware("http")
    async def force_https(request: Request, call_next):
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        if proto == "http":
            url = request.url.replace(scheme="https")
            return JSONResponse(status_code=301, content={"detail": "HTTPS required"}, headers={"Location": str(url)})
        return await call_next(request)

# Static file hosting for uploads
UPLOAD_ROOT = Path(__file__).parent / "static" / "uploads"
for sub in ("profiles", "headshots", "company-logos", "company-covers"):
    (UPLOAD_ROOT / sub).mkdir(parents=True, exist_ok=True)
app.mount("/api/static", StaticFiles(directory=str(Path(__file__).parent / "static")), name="static")

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
    "SpotScoreHistory": "spot_score_history",
}

# Public entities that anonymous users can list/read.
PUBLIC_READ = {"Profile", "CompanyProfile", "CastingCall", "Spot", "Endorsement",
               "SpottedWith", "SavedProfile", "ContactReveal", "ProfileView",
               "PortfolioClick", "SearchAppearance", "Notification",
               "Subscription", "SpotRequest", "RoleAlert", "User",
               "CastingApplication", "SpotScoreHistory"}

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
async def _on_casting_application_created(application: dict):
    """Side effects for new applications:
       - increment application_count
       - notify casting call creator
       - if applicant is the creator (self-apply): add to credits + SpottedWith
    """
    call_id = application.get("casting_call_id")
    call = await db.casting_calls.find_one({"id": call_id}) if call_id else None
    if not call:
        return
    # Increment count + record applied_at on the application
    await db.casting_calls.update_one({"id": call_id}, {"$inc": {"application_count": 1}})
    # Notify creator (skip if self-applying — no need to alert yourself)
    applicant_uid = application.get("applicant_user_id")
    creator_uid = call.get("creator_user_id")
    is_self_apply = applicant_uid and applicant_uid == creator_uid
    if creator_uid and not is_self_apply:
        await db.notifications.insert_one({
            "id": new_id(),
            "user_id": creator_uid,
            "type": "casting_match",
            "title": f"New application for {call.get('project_title')}",
            "body": f"{application.get('applicant_name', 'Someone')} applied for {application.get('role_applied_for', 'a role')}",
            "link": f"/casting/applications?call={call_id}",
            "action_url": f"/casting/applications?call={call_id}",
            "is_read": False,
            "created_date": now_iso(),
        })

    # Self-apply: add credit to applicant's profile + run SpottedWith matching
    if is_self_apply:
        applicant_profile = await db.profiles.find_one({"user_id": applicant_uid})
        if applicant_profile:
            project_title = call.get("project_title")
            role = application.get("role_applied_for") or "Self"
            year = datetime.now(timezone.utc).year
            credits = applicant_profile.get("credits") or []
            already = any(
                (c.get("project_title") or c.get("title") or "").strip().lower() == (project_title or "").strip().lower()
                for c in credits
            )
            if project_title and not already:
                credits.append({"project_title": project_title, "role_on_project": role, "year": year})
                await db.profiles.update_one(
                    {"id": applicant_profile["id"]},
                    {"$set": {"credits": credits, "updated_date": now_iso()}},
                )
                # Re-run SpottedWith matching to surface the new credit
                try:
                    await _run_spotted_with()
                except Exception as e:
                    log.warning("SpottedWith re-run after self-apply failed: %s", e)


def coll(entity: str):
    if entity not in ENTITIES:
        raise HTTPException(404, f"Unknown entity: {entity}")
    return db[ENTITIES[entity]]


def compute_all_roles(profile: dict) -> list:
    """Union of primary_role + secondary_roles, deduped, preserving order."""
    seen = []
    for r in [profile.get("primary_role")] + (profile.get("secondary_roles") or []):
        if r and r not in seen:
            seen.append(r)
    return seen


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
    # Defense-in-depth: never expose Profile rows that admins have flagged as
    # is_hidden=True from the public Profile listing. Owner can still see their
    # own profile via /entities/Profile/{id}.
    if entity == "Profile":
        items = [p for p in items if not p.get("is_hidden")]
    return items


@app.post("/api/entities/{entity}")
async def create_entity(entity: str, request: Request):
    user = await current_user(request)
    # Only telemetry entities (anonymous tracking) may be created without auth.
    # Everything else — including Profile, CompanyProfile, CastingCall,
    # CastingApplication, SpotRequest, SavedProfile, ContactReveal — requires
    # an authenticated user.
    ANONYMOUS_CREATE_OK = {"VerificationCode", "ProfileView", "SearchAppearance", "PortfolioClick"}
    if not user and entity not in ANONYMOUS_CREATE_OK:
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
        # Multi-role: compute all_roles on every save
        doc["all_roles"] = compute_all_roles(doc)
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

    # Auto-link CastingApplication side effects
    if entity == "CastingApplication":
        await _on_casting_application_created(doc)

    # Seed one SpotScoreHistory snapshot for new Profiles so the analytics
    # chart never starts empty.
    if entity == "Profile":
        await db.spot_score_history.insert_one({
            "id": new_id(),
            "profile_id": doc["id"],
            "score": doc.get("spot_score", 0),
            "recorded_at": now_iso(),
            "created_date": now_iso(),
        })

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
    # Recompute all_roles when role fields change on a Profile
    if entity == "Profile" and ("primary_role" in payload or "secondary_roles" in payload):
        existing = await coll(entity).find_one({"id": item_id}, {"_id": 0}) or {}
        merged = {**existing, **payload}
        payload["all_roles"] = compute_all_roles(merged)
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
    prev = profile.get("spot_score", 0)
    await db.profiles.update_one({"id": profile_id}, {"$set": {"spot_score": score}})
    await recalc_percentiles()
    # Snapshot — only when the score actually changes (avoids polluting history
    # with no-op recalcs from unrelated entity mutations)
    if score != prev:
        await db.spot_score_history.insert_one({
            "id": new_id(),
            "profile_id": profile_id,
            "score": score,
            "recorded_at": now_iso(),
            "created_date": now_iso(),
        })
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
    # Accept both shorthand ('accept'/'decline') and long form ('accepted'/'declined').
    if action == "accept":
        action = "accepted"
    elif action == "decline":
        action = "declined"
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
# Signed via X-Postmark-Signature (HMAC-SHA256, base64) using
# POSTMARK_WEBHOOK_SECRET. Reject any request whose signature doesn't match.
# --------------------------------------------------------------------------- #
def verify_postmark_signature(raw_body: bytes, signature_header: str) -> bool:
    secret = os.environ.get("POSTMARK_WEBHOOK_SECRET", "").strip()
    # If no secret configured we deliberately reject so we never accidentally
    # accept unsigned data in production. Set the env var to disable this check
    # (e.g. during local dev) — empty secret means no webhook traffic accepted.
    if not secret:
        return False
    if not signature_header:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    expected_b64 = base64.b64encode(expected).decode("ascii")
    expected_hex = expected.hex()
    # Postmark sends base64; accept hex too in case of alternate config
    candidates = (signature_header.strip(), )
    return any(hmac.compare_digest(c, expected_b64) or hmac.compare_digest(c.lower(), expected_hex) for c in candidates)


@app.post("/api/webhooks/postmark")
async def postmark_webhook(request: Request):
    raw = await request.body()
    sig = request.headers.get("X-Postmark-Signature", "")
    if not verify_postmark_signature(raw, sig):
        raise HTTPException(status_code=403, detail="Invalid signature")
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError:
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
# File uploads — local disk MVP. Single source of truth for upload validation.
# TODO(prod): swap local disk for S3 / Cloudflare R2; currently writes to
# /app/backend/static/uploads/<type>/. Files are served via /static/...
# --------------------------------------------------------------------------- #
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


async def _save_upload(file: UploadFile, subdir: str, public_url_base: str) -> dict:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Only JPEG, PNG and WEBP images are allowed.")
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large. Max 5MB.")
    if not contents:
        raise HTTPException(400, "Empty file.")
    ext = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp"}[file.content_type]
    filename = f"{new_id()}.{ext}"
    path = UPLOAD_ROOT / subdir / filename
    path.write_bytes(contents)
    return {"url": f"{public_url_base}/{filename}", "filename": filename, "size": len(contents)}


@app.post("/api/upload/profile-photo")
async def upload_profile_photo(request: Request, file: UploadFile = File(...)):
    await require_user(request)
    return await _save_upload(file, "profiles", "/api/static/uploads/profiles")


@app.post("/api/upload/headshot")
async def upload_headshot(request: Request, file: UploadFile = File(...)):
    await require_user(request)
    return await _save_upload(file, "headshots", "/api/static/uploads/headshots")


@app.post("/api/upload/company-logo")
async def upload_company_logo(request: Request, file: UploadFile = File(...)):
    await require_user(request)
    return await _save_upload(file, "company-logos", "/api/static/uploads/company-logos")


@app.post("/api/upload/cover-image")
async def upload_cover_image(request: Request, file: UploadFile = File(...)):
    await require_user(request)
    return await _save_upload(file, "company-covers", "/api/static/uploads/company-covers")


# --------------------------------------------------------------------------- #
# Bulk import — admin only
# --------------------------------------------------------------------------- #
@app.post("/api/admin/migrate-all-roles")
async def admin_migrate_all_roles(request: Request):
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    cursor = db.profiles.find({}, {"_id": 0})
    updated = 0
    async for p in cursor:
        roles = compute_all_roles(p)
        await db.profiles.update_one({"id": p["id"]}, {"$set": {"all_roles": roles}})
        updated += 1
    return {"updated": updated}


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
    cap = await get_founder_cap()
    count = await db.subscriptions.count_documents({"tier": "founder", "status": "active"})
    if count >= cap:
        raise HTTPException(400, f"All {cap} founding spots claimed")
    existing = await db.subscriptions.find_one({"user_id": user["id"]})
    sub = {
        "tier": "founder", "status": "active", "started_at": now_iso(),
        "expires_at": None, "contact_reveal_limit": -1, "casting_call_limit": -1,
        "can_boost": True, "updated_date": now_iso(),
    }
    if existing:
        await db.subscriptions.update_one({"id": existing["id"]}, {"$set": sub})
        _invalidate_public_stats_cache()
        return {"success": True, "subscription_id": existing["id"]}
    sub.update({"id": new_id(), "user_id": user["id"], "created_date": now_iso()})
    await db.subscriptions.insert_one(sub)
    _invalidate_public_stats_cache()
    return {"success": True, "subscription_id": sub["id"]}


@app.get("/api/stripe/founder-count")
async def founder_count():
    cap = await get_founder_cap()
    count = await db.subscriptions.count_documents({"tier": "founder", "status": "active"})
    return {"count": count, "remaining": max(0, cap - count), "max": cap}


# --------------------------------------------------------------------------- #
# Health + meta
# --------------------------------------------------------------------------- #
@app.get("/api/health")
async def health():
    return {"ok": True, "time": now_iso()}


@app.get("/api/analytics/summary")
async def analytics_summary(request: Request, days: int = 30):
    """Tier-aware analytics rollup for the current user's primary profile."""
    user = await require_user(request)
    profile = await db.profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(404, "No profile yet")
    sub = await db.subscriptions.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    tier = sub.get("tier", "free")

    pid = profile["id"]
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Always-available counts
    views_count = await db.profile_views.count_documents({"profile_id": pid, "created_date": {"$gte": cutoff}})
    saves_count = await db.saved_profiles.count_documents({"profile_id": pid})
    reveals_count = await db.contact_reveals.count_documents({"profile_id": pid})
    search_count = await db.search_appearances.count_documents({"profile_id": pid, "created_date": {"$gte": cutoff}})

    # Score history (last 90 days)
    score_cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    history_cursor = db.spot_score_history.find(
        {"profile_id": pid, "recorded_at": {"$gte": score_cutoff}},
        {"_id": 0},
    ).sort("recorded_at", 1)
    history = await history_cursor.to_list(length=500)

    payload = {
        "tier": tier,
        "profile": {
            "id": pid,
            "spot_score": profile.get("spot_score", 0),
            "spot_percentile": profile.get("spot_percentile", 0),
        },
        "totals": {
            "views": views_count,
            "saves": saves_count,
            "reveals": reveals_count,
            "search_appearances": search_count,
        },
        "spot_score_history": history,
    }

    # PRO+: who saved
    if tier in ("pro", "elite", "founder"):
        savers = await db.saved_profiles.find({"profile_id": pid}, {"_id": 0}).sort("created_date", -1).to_list(length=50)
        saver_user_ids = list({s["user_id"] for s in savers if s.get("user_id")})
        saver_profiles = await db.profiles.find({"user_id": {"$in": saver_user_ids}}, {"_id": 0}).to_list(length=200)
        by_uid = {p["user_id"]: p for p in saver_profiles}
        payload["who_saved_you"] = [
            {
                "saved_at": s.get("created_date"),
                "profile": {
                    "id": by_uid.get(s["user_id"], {}).get("id"),
                    "full_name": by_uid.get(s["user_id"], {}).get("full_name"),
                    "preferred_name": by_uid.get(s["user_id"], {}).get("preferred_name"),
                    "primary_role": by_uid.get(s["user_id"], {}).get("primary_role"),
                    "profile_slug": by_uid.get(s["user_id"], {}).get("profile_slug"),
                    "profile_photo": by_uid.get(s["user_id"], {}).get("profile_photo"),
                } if by_uid.get(s["user_id"]) else None,
            }
            for s in savers if s.get("user_id")
        ]
    else:
        payload["who_saved_you"] = None  # gated

    # Elite only: who revealed your contact
    if tier in ("elite", "founder"):
        reveals = await db.contact_reveals.find({"profile_id": pid}, {"_id": 0}).sort("created_date", -1).to_list(length=50)
        reveal_user_ids = list({r["revealer_user_id"] for r in reveals if r.get("revealer_user_id")})
        reveal_profiles = await db.profiles.find({"user_id": {"$in": reveal_user_ids}}, {"_id": 0}).to_list(length=200)
        by_uid = {p["user_id"]: p for p in reveal_profiles}
        payload["who_revealed_contact"] = [
            {
                "revealed_at": r.get("created_date"),
                "profile": by_uid.get(r["revealer_user_id"]) and {
                    "id": by_uid[r["revealer_user_id"]].get("id"),
                    "full_name": by_uid[r["revealer_user_id"]].get("full_name"),
                    "primary_role": by_uid[r["revealer_user_id"]].get("primary_role"),
                    "profile_slug": by_uid[r["revealer_user_id"]].get("profile_slug"),
                },
            }
            for r in reveals if r.get("revealer_user_id")
        ]
    elif tier == "pro":
        payload["who_revealed_contact"] = {"count_only": reveals_count}
    else:
        payload["who_revealed_contact"] = None

    return payload


@app.get("/api/auto-claim/check")
async def auto_claim_check(request: Request):
    """Returns auto-claim payload if the current user has a pre-built profile
    (welcome_email_sent=false) that they haven't yet completed."""
    user = await require_user(request)
    profile = await db.profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if not profile:
        return {"eligible": False}
    # Eligibility: profile created via import (welcome_email_sent never sent
    # AND they haven't dismissed the auto-claim banner yet)
    welcome_sent = profile.get("welcome_email_sent", False)
    auto_claim_dismissed = profile.get("auto_claim_dismissed", False)
    if welcome_sent or auto_claim_dismissed:
        return {"eligible": False}

    # Compute top 3 missing items by SpotScore impact
    suggestions = []
    if not profile.get("profile_photo"):
        suggestions.append({"key": "profile_photo", "label": "Add a profile photo", "points": 5})
    if not profile.get("showreel_link"):
        suggestions.append({"key": "showreel_link", "label": "Link your showreel", "points": 5})
    if not profile.get("phone_verified"):
        suggestions.append({"key": "phone_verified", "label": "Verify your phone", "points": 8})
    if not profile.get("email_verified"):
        suggestions.append({"key": "email_verified", "label": "Verify your email", "points": 7})
    if not profile.get("bio"):
        suggestions.append({"key": "bio", "label": "Add a short bio", "points": 5})
    if not profile.get("imdb_link"):
        suggestions.append({"key": "imdb_link", "label": "Add your IMDb link", "points": 5})
    suggestions = sorted(suggestions, key=lambda s: -s["points"])[:3]

    # Profile completion %
    fields = ["profile_photo", "bio", "primary_role", "city", "imdb_link",
              "showreel_link", "phone", "email_verified"]
    completed = sum(1 for f in fields if profile.get(f))
    completion_pct = round(100 * completed / len(fields))

    return {
        "eligible": True,
        "profile": {
            "id": profile["id"],
            "preferred_name": profile.get("preferred_name") or profile.get("full_name") or "there",
            "spot_score": profile.get("spot_score", 0),
            "profile_slug": profile.get("profile_slug"),
        },
        "completion_pct": completion_pct,
        "suggestions": suggestions,
    }


@app.post("/api/auto-claim/dismiss")
async def auto_claim_dismiss(request: Request):
    user = await require_user(request)
    profile = await db.profiles.find_one({"user_id": user["id"]})
    if not profile:
        raise HTTPException(404, "No profile")
    await db.profiles.update_one(
        {"id": profile["id"]},
        {"$set": {"auto_claim_dismissed": True, "welcome_email_sent": True, "updated_date": now_iso()}},
    )
    return {"ok": True}


@app.get("/api/public-settings")
async def public_settings():
    cap = await get_founder_cap()
    return {
        "founder_remaining": max(0, cap - await db.subscriptions.count_documents({"tier": "founder", "status": "active"})),
        "founder_cap": cap,
        "email_mock": EMAIL_MOCK,
        "sms_mock": SMS_MOCK,
    }


# In-memory cache for /api/public-stats — refreshes every 5 minutes.
# Means signups update the homepage automatically with at most 5 min lag.
_PUBLIC_STATS_CACHE: dict = {"data": None, "expires": 0.0}


async def get_founder_cap() -> int:
    """Founder cap is editable from the admin Platform tab. Defaults to 100."""
    s = await db.platform_settings.find_one({"id": "global"}, {"_id": 0})
    if s and isinstance(s.get("founder_cap"), int) and s["founder_cap"] > 0:
        return s["founder_cap"]
    return 100


@app.get("/api/public-stats")
async def public_stats():
    """Live counts for the marketing landing page. All public-safe.
    Cached for 5 minutes to spare the database during traffic spikes."""
    import time as _time
    now = _time.time()
    if _PUBLIC_STATS_CACHE["data"] and now < _PUBLIC_STATS_CACHE["expires"]:
        return _PUBLIC_STATS_CACHE["data"]

    profile_filter = {"is_hidden": {"$ne": True}, "is_minor_profile": {"$ne": True}}
    distinct_roles = await db.profiles.distinct("primary_role", profile_filter)
    distinct_roles = [r for r in distinct_roles if r]
    cap = await get_founder_cap()
    founder_count = await db.subscriptions.count_documents({"tier": "founder", "status": "active"})
    payload = {
        "profile_count": await db.profiles.count_documents(profile_filter),
        "role_count": len(distinct_roles),
        "casting_call_count": await db.casting_calls.count_documents({"is_active": True}),
        "founder_count": founder_count,
        "founder_remaining": max(0, cap - founder_count),
        "founder_cap": cap,
    }
    _PUBLIC_STATS_CACHE["data"] = payload
    _PUBLIC_STATS_CACHE["expires"] = now + 300  # 5 minutes
    return payload


def _invalidate_public_stats_cache():
    """Call after any operation that meaningfully changes public counts
    (founder claim, profile create, casting call create) so urgency banners
    refresh without waiting for the 5-minute window."""
    _PUBLIC_STATS_CACHE["data"] = None
    _PUBLIC_STATS_CACHE["expires"] = 0.0


# --------------------------------------------------------------------------- #
# Profile completion nudge email — runs daily, sends single Postmark nudge to
# any user who:
#   • completed first login (welcome_email_sent=True OR auto_claim_dismissed=True)
#   • is more than 48h past that first-login moment
#   • has spot_score < 40
#   • has not received the nudge yet (nudge_email_sent != True)
# --------------------------------------------------------------------------- #
async def _send_profile_completion_nudges():
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    cursor = db.profiles.find(
        {
            "spot_score": {"$lt": 40},
            "nudge_email_sent": {"$ne": True},
            "$or": [
                {"auto_claim_dismissed": True, "updated_date": {"$lt": cutoff}},
                {"welcome_email_sent": True, "updated_date": {"$lt": cutoff}},
            ],
        },
        {"_id": 0},
    )
    sent = 0
    async for p in cursor:
        user = await db.users.find_one({"id": p.get("user_id")})
        if not user or not user.get("email"):
            continue
        # Top 3 missing items by SpotScore impact
        suggestions = []
        if not p.get("profile_photo"):
            suggestions.append(("Add a profile photo", 5))
        if not p.get("phone_verified"):
            suggestions.append(("Verify your phone", 8))
        if not p.get("email_verified"):
            suggestions.append(("Verify your email", 7))
        if not p.get("imdb_link"):
            suggestions.append(("Link your IMDb profile", 5))
        if not p.get("showreel_link"):
            suggestions.append(("Add your showreel", 5))
        if not p.get("bio"):
            suggestions.append(("Write a short bio", 5))
        suggestions = sorted(suggestions, key=lambda s: -s[1])[:3]
        items_html = "".join(f"<li><strong>{label}</strong> — +{pts} pts</li>" for label, pts in suggestions)
        edit_url = f"{PUBLIC_APP_URL}/create-profile"
        score = p.get("spot_score", 0)
        html = (
            f"<p>Hi {p.get('preferred_name') or p.get('full_name') or 'there'},</p>"
            f"<p>Your Spot'd profile is almost there — current SpotScore: <strong>{score}/100</strong>.</p>"
            f"<p>Three quick wins to climb the directory:</p>"
            f"<ul>{items_html}</ul>"
            f"<p><a href='{edit_url}'>Complete my profile →</a></p>"
        )
        try:
            await send_email(user["email"], "Your Spot'd profile is almost there", html)
            await db.profiles.update_one(
                {"id": p["id"]},
                {"$set": {"nudge_email_sent": True, "nudge_email_at": now_iso()}},
            )
            sent += 1
        except Exception as e:
            log.warning("Nudge email failed for %s: %s", user.get("email"), e)
    log.info("Sent %d completion-nudge emails", sent)
    return {"success": True, "sent": sent}


@app.post("/api/functions/sendProfileCompletionNudges")
async def fn_send_nudges(request: Request):
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return await _send_profile_completion_nudges()


# --------------------------------------------------------------------------- #
# Admin helpers — used by the 7-tab Admin Dashboard
# --------------------------------------------------------------------------- #
async def _require_admin(request: Request):
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


async def _log_admin_action(actor_id: str, action: str, target: str = "", meta: dict | None = None):
    await db.admin_logs.insert_one({
        "id": new_id(),
        "actor_id": actor_id,
        "action": action,
        "target": target,
        "meta": meta or {},
        "created_date": now_iso(),
    })


@app.get("/api/admin/logs")
async def admin_logs(request: Request, limit: int = 100):
    await _require_admin(request)
    items = await db.admin_logs.find({}, {"_id": 0}).sort("created_date", -1).limit(int(limit)).to_list(length=int(limit))
    return items


@app.get("/api/admin/imports")
async def admin_imports(request: Request):
    """Returns only profiles created via bulk-import (import_source set), with claim status + email."""
    await _require_admin(request)
    profiles = await db.profiles.find(
        {"import_source": {"$exists": True, "$ne": None}},
        {"_id": 0},
    ).sort("created_date", -1).to_list(length=500)
    # Hydrate each item with its user email + user_id for the admin UI.
    user_ids = [p["user_id"] for p in profiles if p.get("user_id")]
    users = await db.users.find(
        {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "email": 1}
    ).to_list(length=500)
    by_id = {u["id"]: u for u in users}
    for p in profiles:
        u = by_id.get(p.get("user_id"))
        if u:
            p.setdefault("email", u.get("email"))
    return {
        "total": len(profiles),
        "claimed": sum(1 for p in profiles if p.get("welcome_email_sent") or p.get("auto_claim_dismissed")),
        "unclaimed": sum(1 for p in profiles if not (p.get("welcome_email_sent") or p.get("auto_claim_dismissed"))),
        "items": profiles,
    }


@app.get("/api/admin/emails")
async def admin_emails(request: Request, limit: int = 100):
    """Recent email log entries (mock or real)."""
    await _require_admin(request)
    items = await db.email_log.find({}, {"_id": 0}).sort("created_date", -1).limit(int(limit)).to_list(length=int(limit))
    return items


@app.get("/api/admin/platform")
async def admin_platform(request: Request):
    await _require_admin(request)
    return {
        "email_mock": EMAIL_MOCK,
        "sms_mock": SMS_MOCK,
        "env": os.environ.get("ENV", "development"),
        "founder_count": await db.subscriptions.count_documents({"tier": "founder", "status": "active"}),
        "user_count": await db.users.count_documents({}),
        "profile_count": await db.profiles.count_documents({}),
        "casting_calls": await db.casting_calls.count_documents({}),
        "applications": await db.casting_applications.count_documents({}),
        "endorsements": await db.spots.count_documents({}),
        "notifications": await db.notifications.count_documents({}),
    }


@app.get("/api/admin/casting-calls")
async def admin_casting_calls(request: Request):
    await _require_admin(request)
    items = await db.casting_calls.find({}, {"_id": 0}).sort("created_date", -1).to_list(length=500)
    # Hydrate creator name for the admin table
    creator_ids = list({c.get("creator_user_id") for c in items if c.get("creator_user_id")})
    creators = await db.users.find({"id": {"$in": creator_ids}}, {"_id": 0, "id": 1, "email": 1, "full_name": 1}).to_list(length=500)
    by_id = {u["id"]: u for u in creators}
    for c in items:
        u = by_id.get(c.get("creator_user_id"))
        if u:
            c["creator_email"] = u.get("email")
            c["creator_name"] = u.get("full_name")
    return items


class AdminProfileFlagBody(BaseModel):
    is_hidden: Optional[bool] = None


@app.post("/api/admin/profile/{profile_id}/flag")
async def admin_profile_flag(profile_id: str, body: AdminProfileFlagBody, request: Request):
    user = await _require_admin(request)
    update = {}
    if body.is_hidden is not None:
        update["is_hidden"] = bool(body.is_hidden)
    if not update:
        raise HTTPException(400, "Nothing to update")
    update["updated_date"] = now_iso()
    res = await db.profiles.update_one({"id": profile_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Profile not found")
    await _log_admin_action(user["id"], "profile.flag", profile_id, update)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# PlatformSettings — admin-editable knobs (founder cap, etc.)
# --------------------------------------------------------------------------- #
class PlatformSettingsBody(BaseModel):
    founder_cap: Optional[int] = Field(None, ge=1, le=10000)


@app.get("/api/admin/platform-settings")
async def admin_get_platform_settings(request: Request):
    await _require_admin(request)
    s = await db.platform_settings.find_one({"id": "global"}, {"_id": 0})
    return s or {"id": "global", "founder_cap": 100}


@app.put("/api/admin/platform-settings")
async def admin_update_platform_settings(body: PlatformSettingsBody, request: Request):
    user = await _require_admin(request)
    update = {k: v for k, v in body.dict(exclude_none=True).items()}
    update["updated_date"] = now_iso()
    await db.platform_settings.update_one(
        {"id": "global"},
        {"$set": update, "$setOnInsert": {"id": "global", "created_date": now_iso()}},
        upsert=True,
    )
    _invalidate_public_stats_cache()
    await _log_admin_action(user["id"], "platform.settings.update", "global", update)
    return {"ok": True, "settings": update}


@app.get("/api/admin/launch-checklist")
async def admin_launch_checklist(request: Request):
    await _require_admin(request)
    profile_count = await db.profiles.count_documents({})
    pending_welcome = await db.profiles.count_documents({"welcome_email_sent": False})
    stripe_keys_set = bool(os.environ.get("STRIPE_PRO_PRICE_ID")) and bool(os.environ.get("STRIPE_ELITE_PRICE_ID"))
    return {
        "items": [
            {"key": "email_live", "label": "Postmark email live", "ok": not EMAIL_MOCK, "value": "MOCK" if EMAIL_MOCK else "LIVE"},
            {"key": "sms_live", "label": "Twilio SMS live", "ok": not SMS_MOCK, "value": "MOCK" if SMS_MOCK else "LIVE"},
            {"key": "stripe_keys", "label": "Stripe price IDs configured", "ok": stripe_keys_set, "value": "SET" if stripe_keys_set else "MISSING"},
            {"key": "profile_count", "label": "Profile count ≥ 10", "ok": profile_count >= 10, "value": str(profile_count)},
            {"key": "pending_welcome", "label": "No pending welcome emails", "ok": pending_welcome == 0, "value": f"{pending_welcome} pending"},
        ]
    }


# --------------------------------------------------------------------------- #
# Waitlist — captured when founder cap is full
# --------------------------------------------------------------------------- #
class WaitlistBody(BaseModel):
    email: EmailStr
    source: str = "landing"


@app.post("/api/waitlist")
async def waitlist_signup(body: WaitlistBody):
    """Anonymous endpoint — captured when founder cap is full."""
    email = body.email.lower().strip()
    existing = await db.waitlist.find_one({"email": email}, {"_id": 0})
    if existing:
        return {"ok": True, "already_listed": True}
    await db.waitlist.insert_one({
        "id": new_id(),
        "email": email,
        "source": body.source,
        "created_date": now_iso(),
    })
    return {"ok": True, "already_listed": False}


@app.get("/api/admin/waitlist")
async def admin_list_waitlist(request: Request):
    await _require_admin(request)
    items = await db.waitlist.find({}, {"_id": 0}).sort("created_date", -1).to_list(length=1000)
    return {"total": len(items), "items": items}


# --------------------------------------------------------------------------- #
# OG image endpoints — Pillow-rendered share cards (1200x630 standard)
# --------------------------------------------------------------------------- #
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from fastapi.responses import Response as _Response

_OG_CACHE: dict = {}  # {key: (expires_ts, bytes)}


def _get_font(size: int, bold: bool = False):
    """Try to load a system font with reasonable defaults; fall back to PIL default."""
    candidates = [
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans-{'Bold' if bold else 'Bold'}.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _draw_pill(draw: ImageDraw.ImageDraw, xy, text, *, bg, fg, font, padding=(18, 10), radius=999):
    x, y = xy
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    rect = (x, y, x + tw + padding[0] * 2, y + th + padding[1] * 2)
    draw.rounded_rectangle(rect, radius=radius, fill=bg)
    draw.text((x + padding[0], y + padding[1] - bbox[1]), text, fill=fg, font=font)
    return rect


def _wrap(text: str, max_chars: int):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= max_chars:
            cur = (cur + " " + w).strip()
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _render_casting_og(call: dict) -> bytes:
    """Render a 1200×630 OG image for a CastingCall."""
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), "#0D0D0D")
    draw = ImageDraw.Draw(img, "RGBA")

    # Subtle yellow glow — radial-ish via concentric ellipses
    for i, alpha in enumerate([8, 14, 20, 28, 38]):
        r = 380 - i * 45
        draw.ellipse((360 - r, 280 - r, 360 + r, 280 + r), fill=(232, 252, 108, alpha))

    # Wordmark
    f_brand = _get_font(56, bold=True)
    draw.text((60, 56), "Spot", fill="#FFFFFF", font=f_brand)
    draw.text((60 + draw.textlength("Spot", font=f_brand), 56), "'d", fill="#E8FC6C", font=f_brand)

    # NOW CASTING chip
    f_chip = _get_font(20, bold=True)
    _draw_pill(draw, (W - 60 - 240, 70), "NOW CASTING", bg="#FF5C35", fg="#FFFFFF", font=f_chip, padding=(22, 12))

    # Project type label
    f_label = _get_font(22)
    project_type = (call.get("project_type") or "PROJECT").upper()
    draw.text((60, 175), project_type, fill="#999999", font=f_label)

    # Title — wrap to 2 lines max
    title = (call.get("project_title") or "Casting call")[:120]
    f_title = _get_font(72, bold=True)
    lines = _wrap(title, 26)[:2]
    if len(_wrap(title, 26)) > 2:
        lines[1] = lines[1].rstrip(",.;:") + "…"
    y = 215
    for line in lines:
        draw.text((60, y), line, fill="#FFFFFF", font=f_title)
        y += 84

    # Roles row
    roles = (call.get("roles_needed") or [])[:4]
    f_pill = _get_font(22)
    rx = 60
    ry = max(y + 24, 410)
    for r in roles:
        rect = _draw_pill(draw, (rx, ry), r, bg="#2A2A2A", fg="#FFFFFF", font=f_pill, padding=(20, 10))
        rx = rect[2] + 12

    # Bottom strip — location + comp
    f_meta = _get_font(22)
    parts = []
    if call.get("location"):
        parts.append("· " + call["location"])
    comp = call.get("compensation") or call.get("budget_range")
    if comp:
        parts.append("· " + str(comp))
    if parts:
        draw.text((60, H - 130), "  ".join(parts), fill="#999999", font=f_meta)

    # CTA
    f_cta = _get_font(28, bold=True)
    draw.text((60, H - 70), "Apply at getspotd.app", fill="#E8FC6C", font=f_cta)
    return _png_bytes(img)


def _render_profile_og(profile: dict) -> bytes:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), "#0D0D0D")
    draw = ImageDraw.Draw(img, "RGBA")
    # Right-side electric warmth
    for i, alpha in enumerate([8, 14, 22, 32]):
        r = 380 - i * 60
        draw.ellipse((900 - r, 320 - r, 900 + r, 320 + r), fill=(232, 252, 108, alpha))

    # Left half — photo placeholder (apostrophe)
    photo_box = (40, 40, 540, H - 40)
    draw.rounded_rectangle(photo_box, radius=24, fill="#1A1A1A")
    f_apos = _get_font(420, bold=True)
    apos_w = draw.textlength("'", font=f_apos)
    draw.text(((photo_box[0] + photo_box[2]) / 2 - apos_w / 2, photo_box[1] + 50), "'", fill=(232, 252, 108, 77), font=f_apos)

    # Right half — text
    f_label = _get_font(22)
    draw.text((600, 90), "SPOT'D · INDIE FILM DIRECTORY", fill="#999999", font=f_label)

    name = (profile.get("preferred_name") or profile.get("full_name") or "Profile")[:30]
    f_name = _get_font(72, bold=True)
    draw.text((600, 140), name, fill="#FFFFFF", font=f_name)

    role = profile.get("primary_role") or "Profile"
    f_role = _get_font(36)
    draw.text((600, 240), role, fill="#E8FC6C", font=f_role)

    # Location
    place_parts = [p for p in [profile.get("city"), profile.get("state"), profile.get("country")] if p]
    if place_parts:
        f_loc = _get_font(26)
        draw.text((600, 305), ", ".join(place_parts), fill="#BBBBBB", font=f_loc)

    # SpotScore badge
    score = int(profile.get("spot_score") or 0)
    f_score_n = _get_font(96, bold=True)
    draw.text((600, 390), str(score), fill="#E8FC6C", font=f_score_n)
    f_score_l = _get_font(20)
    draw.text((600, 506), "SPOTSCORE · /100", fill="#999999", font=f_score_l)

    # Footer CTA
    f_cta = _get_font(24, bold=True)
    draw.text((600, H - 70), "Find cast & crew at getspotd.app", fill="#E8FC6C", font=f_cta)
    return _png_bytes(img)


def _png_bytes(img: "Image.Image") -> bytes:
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _og_cache_get(key: str):
    import time as _time
    item = _OG_CACHE.get(key)
    if item and _time.time() < item[0]:
        return item[1]
    return None


def _og_cache_set(key: str, data: bytes, ttl: int = 3600):
    import time as _time
    _OG_CACHE[key] = (_time.time() + ttl, data)


@app.get("/api/public-verified-companies")
async def public_verified_companies(limit: int = 8):
    """Companies that should appear in the landing 'Trusted by' row.
    Anonymous endpoint, only returns minimal display fields."""
    items = await db.company_profiles.find(
        {"is_verified": True},
        {"_id": 0, "id": 1, "company_name": 1, "company_slug": 1, "logo": 1, "company_type": 1},
    ).limit(int(limit)).to_list(length=int(limit))
    return items


@app.get("/api/og/casting/{casting_call_id}.png")
async def og_casting(casting_call_id: str):
    call = await db.casting_calls.find_one({"id": casting_call_id}, {"_id": 0})
    if not call:
        raise HTTPException(404, "Casting call not found")
    cache_key = f"casting:{casting_call_id}:{call.get('updated_date', call.get('created_date',''))}"
    data = _og_cache_get(cache_key)
    if data is None:
        data = _render_casting_og(call)
        _og_cache_set(cache_key, data)
    return _Response(content=data, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@app.get("/api/og/profile/{slug}.png")
async def og_profile(slug: str):
    profile = await db.profiles.find_one({"profile_slug": slug}, {"_id": 0})
    if not profile:
        profile = await db.profiles.find_one({"id": slug}, {"_id": 0})
    if not profile:
        raise HTTPException(404, "Profile not found")
    cache_key = f"profile:{profile['id']}:{profile.get('updated_date', profile.get('created_date',''))}"
    data = _og_cache_get(cache_key)
    if data is None:
        data = _render_profile_og(profile)
        _og_cache_set(cache_key, data)
    return _Response(content=data, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


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

    # Seed/verify the 3 production companies for the "Trusted by" landing row.
    await _seed_verified_companies(user_id)


async def _seed_verified_companies(default_user_id: str):
    """Ensure 3 verified CompanyProfiles exist so the Trusted-by row renders.

    Each company is keyed by `company_slug` so re-running on startup is idempotent.
    Creates the user account if the contact email isn't already on the platform,
    so the company has a real owner. Marks each company `is_verified=True`.
    """
    seeds = [
        {
            "slug": "shadow-wolves-productions",
            "name": "Shadow Wolves Productions",
            "type": "Production Company",
            "email": ADMIN_EMAIL,
            "owner_user_id": default_user_id,
            "city": "Sydney",
            "state": "NSW",
        },
        {
            "slug": "phantom-digital-fx",
            "name": "Phantom Digital FX",
            "type": "VFX Studio",
            "email": "sam.lewis@phantom-fx.com",
            "city": "Melbourne",
            "state": "VIC",
        },
        {
            "slug": "mellow-pictures",
            "name": "Mellow Pictures",
            "type": "Production Company",
            "email": "joshua@mellowpictures.com.au",
            "city": "Brisbane",
            "state": "QLD",
        },
    ]
    for s in seeds:
        existing = await db.company_profiles.find_one({"company_slug": s["slug"]}, {"_id": 0})
        if existing:
            if not existing.get("is_verified"):
                await db.company_profiles.update_one(
                    {"id": existing["id"]},
                    {"$set": {"is_verified": True, "updated_date": now_iso()}},
                )
            continue
        # Resolve or create the user account that owns this company
        owner_id = s.get("owner_user_id")
        if not owner_id:
            u = await db.users.find_one({"email": s["email"].lower()}, {"_id": 0})
            if u:
                owner_id = u["id"]
            else:
                owner_id = new_id()
                await db.users.insert_one({
                    "id": owner_id,
                    "email": s["email"].lower(),
                    "full_name": s["name"],
                    "role": "user",
                    "created_date": now_iso(),
                    "updated_date": now_iso(),
                })
        await db.company_profiles.insert_one({
            "id": new_id(),
            "user_id": owner_id,
            "company_slug": s["slug"],
            "company_name": s["name"],
            "company_type": s["type"],
            "email": s["email"].lower(),
            "city": s["city"],
            "state": s["state"],
            "country": "Australia",
            "is_verified": True,
            "created_date": now_iso(),
            "updated_date": now_iso(),
        })


async def migrate_all_roles():
    """One-time backfill: ensure every Profile has all_roles set."""
    cursor = db.profiles.find({"$or": [{"all_roles": {"$exists": False}}, {"all_roles": {"$size": 0}}]}, {"_id": 0})
    n = 0
    async for p in cursor:
        roles = compute_all_roles(p)
        if roles:
            await db.profiles.update_one({"id": p["id"]}, {"$set": {"all_roles": roles}})
            n += 1
    if n:
        log.info("Migrated all_roles for %d profiles", n)


async def backfill_spot_score_history():
    """One-time backfill: insert one SpotScoreHistory snapshot per profile that
    has zero history rows so the chart on /analytics is never empty."""
    cursor = db.profiles.find({}, {"_id": 0, "id": 1, "spot_score": 1})
    n = 0
    async for p in cursor:
        existing = await db.spot_score_history.count_documents({"profile_id": p["id"]})
        if existing == 0:
            await db.spot_score_history.insert_one({
                "id": new_id(),
                "profile_id": p["id"],
                "score": p.get("spot_score", 0),
                "recorded_at": now_iso(),
                "created_date": now_iso(),
            })
            n += 1
    if n:
        log.info("Backfilled SpotScoreHistory for %d profiles", n)


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
    await migrate_all_roles()
    await backfill_spot_score_history()
    # Scheduled jobs
    scheduler.add_job(_run_spotted_with, CronTrigger(hour=2, minute=0))
    scheduler.add_job(_purge_codes, CronTrigger(hour=3, minute=0))
    scheduler.add_job(_send_profile_completion_nudges, CronTrigger(hour=15, minute=0))
    scheduler.add_job(lambda: _send_daily_weekly("daily"), CronTrigger(hour=17, minute=0))
    scheduler.add_job(lambda: _send_daily_weekly("weekly"), CronTrigger(day_of_week="sun", hour=17, minute=0))
    scheduler.start()
    log.info("Spot'd backend started")


@app.on_event("shutdown")
async def on_shutdown():
    scheduler.shutdown(wait=False)
    mongo.close()
