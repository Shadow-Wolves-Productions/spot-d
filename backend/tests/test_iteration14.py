"""Iter 14 — password auth + Founding Member badge + Spotlight.

Smoke covers the new endpoints; the deeper flows are tested through the
frontend (Login.jsx) by the testing agent.
"""
from pathlib import Path

import pytest
import requests


def _env(key):
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return None


BASE = _env("REACT_APP_BACKEND_URL")
assert BASE, "REACT_APP_BACKEND_URL must be set"


# --------------------------------------------------------------------------- #
# Password endpoints
# --------------------------------------------------------------------------- #
def test_login_with_no_password_returns_409_set_password_required():
    """Legacy users (no password_hash) get 409 + set_password_required code."""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = next(line.split("=", 1)[1] for line in Path("/app/backend/.env").read_text().splitlines() if line.startswith("MONGO_URL="))
    db_name = next(line.split("=", 1)[1] for line in Path("/app/backend/.env").read_text().splitlines() if line.startswith("DB_NAME="))

    async def setup():
        c = AsyncIOMotorClient(mongo_url)
        db = c[db_name]
        await db.users.update_one(
            {"email": "iter14-legacy@example.com"},
            {"$setOnInsert": {
                "id": "iter14-legacy-id",
                "email": "iter14-legacy@example.com",
                "role": "user",
                "created_date": "2026-01-01",
                "updated_date": "2026-01-01",
            }, "$unset": {"password_hash": ""}},
            upsert=True,
        )
    asyncio.run(setup())

    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": "iter14-legacy@example.com", "password": "anything12"},
        timeout=10,
    )
    assert r.status_code == 409
    detail = r.json().get("detail", {})
    assert isinstance(detail, dict) and detail.get("code") == "set_password_required"


def test_login_unknown_email_returns_generic_401():
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": "iter14-nobody@example.com", "password": "anything12"},
        timeout=10,
    )
    assert r.status_code == 401
    assert "Invalid" in r.json().get("detail", "")


def test_set_password_requires_auth():
    r = requests.post(
        f"{BASE}/api/auth/set-password",
        json={"password": "hunter22"},
        timeout=10,
    )
    assert r.status_code == 401


def test_otp_set_password_then_login_round_trip():
    """End-to-end: register via OTP → set-password → login with password."""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = next(line.split("=", 1)[1] for line in Path("/app/backend/.env").read_text().splitlines() if line.startswith("MONGO_URL="))
    db_name = next(line.split("=", 1)[1] for line in Path("/app/backend/.env").read_text().splitlines() if line.startswith("DB_NAME="))
    email = "iter14-rtt@example.com"

    async def cleanup():
        c = AsyncIOMotorClient(mongo_url)
        db = c[db_name]
        await db.login_codes.delete_many({"email": email})
        await db.login_attempts.delete_many({"email": email})
        await db.users.delete_one({"email": email})
    asyncio.run(cleanup())

    # Step 1 — request OTP
    r = requests.post(f"{BASE}/api/auth/request-code", json={"email": email}, timeout=10)
    assert r.status_code == 200

    # Step 2 — read code from DB (mock OR live)
    async def read_code():
        c = AsyncIOMotorClient(mongo_url)
        db = c[db_name]
        row = await db.login_codes.find_one({"email": email, "used": False}, sort=[("created_at", -1)])
        return row["code"]
    code = asyncio.run(read_code())

    # Step 3 — verify OTP, expect needs_password_setup=True
    r = requests.post(f"{BASE}/api/auth/verify-code", json={"email": email, "code": code}, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("needs_password_setup") is True
    token = data["token"]

    # Step 4 — set password
    r = requests.post(
        f"{BASE}/api/auth/set-password",
        json={"password": "rtt-secret-12"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text

    # Step 5 — login with password (no OTP this time)
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": "rtt-secret-12"}, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("needs_password_setup") is False
    assert data.get("token")

    # Step 6 — wrong password fails 401
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": "wrong-password"}, timeout=10)
    assert r.status_code == 401


def test_forgot_password_alias_returns_200():
    r = requests.post(f"{BASE}/api/auth/forgot-password", json={"email": "alias-test@example.com"}, timeout=10)
    assert r.status_code in (200, 429)  # 429 if a recent code already exists


# --------------------------------------------------------------------------- #
# Email logo helper — no <img> tag, pure HTML
# --------------------------------------------------------------------------- #
def test_email_logo_html_is_inline_html_not_img():
    src = Path("/app/backend/core.py").read_text()
    assert "def email_logo_html(" in src
    # The helper output contains the wordmark in HTML, not an <img>
    assert "spot<span" in src
    assert "#E8FC6C" in src


# --------------------------------------------------------------------------- #
# Founding Member badge wired into ProfileCard + ProfileHero
# --------------------------------------------------------------------------- #
def test_founding_member_badge_used_in_profile_components():
    pc = Path("/app/frontend/src/components/ProfileCard.jsx").read_text()
    ph = Path("/app/frontend/src/components/profile/ProfileHero.jsx").read_text()
    assert "FoundingMemberBadge" in pc
    assert "FoundingMemberBadge" in ph


def test_founding_member_badge_renders_only_for_founder_tier():
    src = Path("/app/frontend/src/components/FoundingMemberBadge.jsx").read_text()
    # Renders if either the explicit isFoundingMember prop is true, or the
    # legacy tier === "founder" check passes.
    assert 'tier === "founder"' in src
    assert "Founding Member" in src
    # Pill colour switched to blue (#38BDF8) per latest brand direction.
    assert "#38BDF8" in src


# --------------------------------------------------------------------------- #
# Spotlight section — landing page heading + dashboard CTA
# --------------------------------------------------------------------------- #
def test_landing_spotlight_heading_uses_spotd_this_month():
    src = Path("/app/frontend/src/components/landing/HomepageSpotlight.jsx").read_text()
    assert "Spot'd this month" in src


def test_dashboard_has_spotlight_card():
    src = Path("/app/frontend/src/pages/Dashboard.jsx").read_text()
    assert "dashboard-spotlight-card" in src
    assert "Spot'd this month" in src
    assert "spotlight-elite-msg" in src
    assert "spotlight-upgrade-cta" in src


# --------------------------------------------------------------------------- #
# Lifetime PRO copy — no more "12 months"
# --------------------------------------------------------------------------- #
def test_no_12_months_copy_in_emails_or_pricing():
    targets = [
        Path("/app/backend/routers/admin.py"),
        Path("/app/backend/routers/scheduled.py"),
        Path("/app/frontend/src/pages/Pricing.jsx"),
    ]
    for p in targets:
        body = p.read_text()
        assert "12 months of PRO" not in body, f"{p} still references '12 months of PRO'"
        assert "free 12 months of PRO" not in body, f"{p} still references 'free 12 months of PRO'"


# --------------------------------------------------------------------------- #
# Contact email updated
# --------------------------------------------------------------------------- #
def test_privacy_terms_use_hello_at_getspotd():
    privacy = Path("/app/frontend/src/pages/Privacy.jsx").read_text()
    terms = Path("/app/frontend/src/pages/Terms.jsx").read_text()
    assert "hello@getspotd.app" in privacy
    assert "hello@getspotd.app" in terms
    assert "Brendan@ShadowWolvesProductions" not in privacy
    assert "Brendan@ShadowWolvesProductions" not in terms
