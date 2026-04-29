"""
Spot'd backend — shared core module.

This module holds the global state (Mongo client, scheduler, app config) plus
all the cross-cutting helpers (auth, serialisation, email, SMS, slugify, …)
that every router needs. It is *imported* by both ``server.py`` (the entry
point) and every router under ``routers/``.

To avoid the circular-import that the historical 2900-line ``server.py``
suffered from, no module under ``routers/`` ever imports from ``server`` —
they only import from ``core`` and ``models``. ``server.py`` is the only
module that imports both ``core`` and the routers.
"""
from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import jwt
from fastapi import HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# --------------------------------------------------------------------------- #
# Config + logging
# --------------------------------------------------------------------------- #
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("spotd")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET") or "change-me-in-prod"
JWT_ALG = "HS256"

EMAIL_MOCK = os.environ.get("EMAIL_MOCK_MODE", "true").lower() == "true"
SMS_MOCK = os.environ.get("SMS_MOCK_MODE", "true").lower() == "true"
IS_PROD = os.environ.get("ENV", "development").lower() == "production"

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").lower().strip()
EMAIL_LOGO_URL = os.environ.get(
    "EMAIL_LOGO_URL",
    "https://customer-assets.emergentagent.com/job_indie-film-casting/artifacts/2lj4urlc_dark-transparent.png",
)

UPLOAD_ROOT = Path(__file__).parent / "static" / "uploads"
for _sub in ("profiles", "headshots", "company-logos", "company-covers"):
    (UPLOAD_ROOT / _sub).mkdir(parents=True, exist_ok=True)

# --------------------------------------------------------------------------- #
# Database + scheduler — single instances shared by every router.
# --------------------------------------------------------------------------- #
mongo = AsyncIOMotorClient(MONGO_URL)
db = mongo[DB_NAME]

scheduler = AsyncIOScheduler(timezone="UTC")

# --------------------------------------------------------------------------- #
# Entity registry
# --------------------------------------------------------------------------- #
ENTITIES = {
    "User": "users",
    "Profile": "profiles",
    "Subscription": "subscriptions",
    "CastingCall": "casting_calls",
    "CastingApplication": "casting_applications",
    "Spot": "spots",
    "Endorsement": "spots",
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

PUBLIC_READ = {
    "Profile", "CompanyProfile", "CastingCall", "Spot", "Endorsement",
    "SpottedWith", "SavedProfile", "ContactReveal", "ProfileView",
    "PortfolioClick", "SearchAppearance", "Notification", "Subscription",
    "SpotRequest", "RoleAlert", "User", "CastingApplication",
    "SpotScoreHistory",
}


def coll(entity: str):
    if entity not in ENTITIES:
        raise HTTPException(404, f"Unknown entity '{entity}'")
    return db[ENTITIES[entity]]


def compute_all_roles(profile: dict) -> list:
    """Union of primary_role + secondary_roles, deduped, preserving order."""
    seen = []
    for r in [profile.get("primary_role")] + (profile.get("secondary_roles") or []):
        if r and r not in seen:
            seen.append(r)
    return seen


def parse_value(v: str) -> Any:
    """Coerce a query-string value to bool/int/float/None where possible."""
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


# --------------------------------------------------------------------------- #
# Generic helpers
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
    """Strip Mongo internals from a doc before JSON output."""
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
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
# View-event helpers (rate-limited counter for profiles + casting calls).
# Lifted into core so both routers/profiles.py and routers/casting.py can use
# them directly without a cross-router import.
# --------------------------------------------------------------------------- #
async def record_view(target_kind: str, target_id: str, viewer_id: str) -> bool:
    """
    Insert a row into ``view_events`` only if no row for the same triple was
    inserted in the last hour. The collection has a TTL index that auto-purges
    rows after 1h, which means a returning viewer is treated as a new view.
    Returns True iff a fresh row was inserted (i.e. the counter should bump).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    existing = await db.view_events.find_one({
        "kind": target_kind,
        "target_id": target_id,
        "viewer_id": viewer_id,
        "created_at": {"$gte": cutoff},
    })
    if existing:
        return False
    await db.view_events.insert_one({
        "kind": target_kind,
        "target_id": target_id,
        "viewer_id": viewer_id,
        "created_at": datetime.now(timezone.utc),
    })
    return True


def viewer_id_for(request: Request, user: Optional[dict]) -> str:
    """Stable per-(viewer, target) key. Auth users → user_id; anon → IP."""
    if user and user.get("id"):
        return f"u:{user['id']}"
    fwd = request.headers.get("x-forwarded-for", "")
    ip = (fwd.split(",")[0].strip() if fwd else None) or (request.client.host if request.client else "anon")
    return f"ip:{ip}"


# Backwards-compat aliases (some routers still import the underscore-prefixed names).
_record_view = record_view
_viewer_id_for = viewer_id_for


# --------------------------------------------------------------------------- #
# Email + SMS (mockable)
# --------------------------------------------------------------------------- #
async def send_email(to: str, subject: str, html: str, from_name: str = "Spot'd"):
    if EMAIL_MOCK or not os.environ.get("POSTMARK_API_KEY"):
        log.info("[EMAIL MOCK] to=%s subject=%s", to, subject)
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
    """SMS is no-op since Twilio was removed in iter 10. Kept for callers."""
    log.info("[SMS NOOP] to=%s body=%s", to, body[:80])
    return True
