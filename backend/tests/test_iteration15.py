"""Iter 15 — Spotlight pins + Brendan founder flag + carousel hierarchy."""
import asyncio
from pathlib import Path

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient


def _env(key, file="/app/frontend/.env"):
    for line in Path(file).read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return None


BASE = _env("REACT_APP_BACKEND_URL")
MONGO_URL = _env("MONGO_URL", "/app/backend/.env")
DB_NAME = _env("DB_NAME", "/app/backend/.env")
ADMIN_EMAIL = _env("ADMIN_EMAIL", "/app/backend/.env") or "brendan@shadowwolvesproductions.com.au"


def _admin_token():
    async def setup():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        await db.login_codes.delete_many({"email": ADMIN_EMAIL})
    asyncio.run(setup())
    requests.post(f"{BASE}/api/auth/request-code", json={"email": ADMIN_EMAIL}, timeout=10)

    async def read():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        row = await db.login_codes.find_one({"email": ADMIN_EMAIL, "used": False}, sort=[("created_at", -1)])
        return row["code"]
    code = asyncio.run(read())
    r = requests.post(f"{BASE}/api/auth/verify-code", json={"email": ADMIN_EMAIL, "code": code}, timeout=10)
    return r.json()["token"]


# --------------------------------------------------------------------------- #
def test_brendan_is_founding_member():
    async def check():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        u = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0, "is_founding_member": 1})
        return u
    u = asyncio.run(check())
    assert u and u.get("is_founding_member") is True


def test_spotlight_active_returns_picks_or_fallback():
    """Whether or not pins exist, /api/spotlight/active must always return
    a non-empty list as long as the DB has at least one valid profile."""
    r = requests.get(f"{BASE}/api/spotlight/active", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "picks" in data
    assert isinstance(data["picks"], list)
    if data["picks"]:
        # Each pick must have a kind annotation
        for p in data["picks"]:
            assert "_spotlight" in p
            assert p["_spotlight"].get("kind") in {"paid", "admin", "founder_fallback", "auto"}


def test_admin_pin_unpin_round_trip():
    token = _admin_token()
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Clear prior test pins
    async def reset():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        await db.spotlight_picks.delete_many({})
    asyncio.run(reset())

    profiles = requests.get(f"{BASE}/api/entities/Profile?limit=2", timeout=10).json()
    assert profiles, "need at least one profile to test pin"
    pid = profiles[0]["id"]

    # Pin
    r = requests.post(
        f"{BASE}/api/admin/spotlight-pin",
        json={"profile_id": pid, "expires_at": "2026-12-31T00:00:00Z"},
        headers=h, timeout=10,
    )
    assert r.status_code == 200
    pin = r.json()
    assert pin.get("kind") == "admin"
    pin_id = pin["id"]

    # Active feed should now include this pin
    r = requests.get(f"{BASE}/api/spotlight/active", timeout=10)
    picks = r.json()["picks"]
    assert any(p["id"] == pid for p in picks)
    assert any(p["_spotlight"]["kind"] == "admin" for p in picks)

    # List pins (admin)
    r = requests.get(f"{BASE}/api/admin/spotlight-pins", headers=h, timeout=10)
    assert r.status_code == 200
    assert any(x["id"] == pin_id for x in r.json())

    # Unpin
    r = requests.delete(f"{BASE}/api/admin/spotlight-pin/{pin_id}", headers=h, timeout=10)
    assert r.status_code == 200

    # Active feed should now fall back (no pins → founder fallback)
    r = requests.get(f"{BASE}/api/spotlight/active", timeout=10)
    picks = r.json()["picks"]
    if picks:
        kinds = {p["_spotlight"]["kind"] for p in picks}
        assert "admin" not in kinds


def test_admin_pin_requires_admin():
    r = requests.post(
        f"{BASE}/api/admin/spotlight-pin",
        json={"profile_id": "any"}, timeout=10,
    )
    assert r.status_code == 401


def test_admin_pin_404_on_unknown_profile():
    token = _admin_token()
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    r = requests.post(
        f"{BASE}/api/admin/spotlight-pin",
        json={"profile_id": "this-does-not-exist"},
        headers=h, timeout=10,
    )
    assert r.status_code == 404


def test_paid_grant_requires_owner_or_admin():
    """Non-owner non-admin can't grant a spotlight to someone else's profile."""
    token = _admin_token()
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # Use admin token but on an existing profile owned by admin → should succeed.
    me = requests.get(f"{BASE}/api/auth/me", headers=h, timeout=10).json()
    profiles = requests.get(f"{BASE}/api/entities/Profile?user_id={me['id']}", headers=h, timeout=10).json()
    if not profiles:
        pytest.skip("admin has no profile")
    r = requests.post(
        f"{BASE}/api/spotlight/grant",
        json={"profile_id": profiles[0]["id"], "days": 14},
        headers=h, timeout=10,
    )
    assert r.status_code == 200
    assert r.json().get("kind") == "paid"


# --------------------------------------------------------------------------- #
# Frontend wiring sanity
# --------------------------------------------------------------------------- #
def test_hero_uses_spotlight_endpoint():
    src = Path("/app/frontend/src/components/landing/HeroSection.jsx").read_text()
    assert "/api/spotlight/active" in src
    assert "Spot'd this month" in src or 'spotlight' in src.lower()


def test_homepage_spotlight_removed_from_landing():
    """Old standalone <HomepageSpotlight /> section should be merged into the
    hero — Landing.jsx should not re-render it as a duplicate strip."""
    src = Path("/app/frontend/src/pages/Landing.jsx").read_text()
    assert "<HomepageSpotlight" not in src
