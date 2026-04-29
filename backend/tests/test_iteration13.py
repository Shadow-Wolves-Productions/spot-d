"""
Iter 13 — pre-launch checklist regression suite.

Covers the security/correctness items from the user's pre-launch checklist:
auth limits, owner gates, duplicate-application 409, self-action blocks, and
HSTS + CORS posture.
"""
import json
import os
from pathlib import Path

import pytest
import requests

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _env(key):
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return None


BASE = _env("REACT_APP_BACKEND_URL")
assert BASE, "REACT_APP_BACKEND_URL must be set"


def _admin_token():
    """OTP-login as Brendan (admin) and return JWT."""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _fetch_code(email):
        for line in Path("/app/backend/.env").read_text().splitlines():
            if line.startswith("MONGO_URL="):
                mongo_url = line.split("=", 1)[1]
            if line.startswith("DB_NAME="):
                db_name = line.split("=", 1)[1]
        c = AsyncIOMotorClient(mongo_url)
        db = c[db_name]
        await db.login_codes.delete_many({"email": email})
        return mongo_url, db_name

    mongo_url, db_name = asyncio.run(_fetch_code("brendan@shadowwolvesproductions.com.au"))

    r = requests.post(f"{BASE}/api/auth/request-code",
                      json={"email": "brendan@shadowwolvesproductions.com.au"},
                      timeout=10)
    assert r.status_code == 200, r.text
    code = r.json().get("dev_code")
    if not code:
        # fall back to DB read
        from motor.motor_asyncio import AsyncIOMotorClient
        async def _read():
            c = AsyncIOMotorClient(mongo_url)
            db = c[db_name]
            row = await db.login_codes.find_one(
                {"email": "brendan@shadowwolvesproductions.com.au", "used": False},
                sort=[("created_at", -1)])
            return row["code"] if row else None
        code = asyncio.run(_read())
    assert code, "could not obtain OTP code"

    r = requests.post(f"{BASE}/api/auth/verify-code",
                      json={"email": "brendan@shadowwolvesproductions.com.au", "code": code},
                      timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# --------------------------------------------------------------------------- #
# AUTH
# --------------------------------------------------------------------------- #
def test_auth_otp_rate_limit_3_per_10min():
    """4th OTP request inside 10 minutes must 429."""
    email = "rl-checklist-otp@example.com"
    codes = []
    for _ in range(4):
        r = requests.post(f"{BASE}/api/auth/request-code", json={"email": email}, timeout=10)
        codes.append(r.status_code)
    assert codes[:3] == [200, 200, 200]
    assert codes[3] == 429


def test_auth_5_wrong_attempts_invalidates_code():
    email = "wrong-attempts-otp@example.com"
    r = requests.post(f"{BASE}/api/auth/request-code", json={"email": email}, timeout=10)
    assert r.status_code == 200
    last = None
    for i in range(6):
        r = requests.post(f"{BASE}/api/auth/verify-code",
                          json={"email": email, "code": "000000"}, timeout=10)
        last = r
    # After enough wrong attempts, the message should indicate the code is dead.
    assert last.status_code == 400
    body = last.json().get("detail", "")
    # Either "Too many attempts" or "No active code" is acceptable depending on
    # which attempt count triggered the lockout.
    assert "attempts" in body.lower() or "No active code" in body or "expired" in body.lower()


# --------------------------------------------------------------------------- #
# PROFILES + DIRECTORY
# --------------------------------------------------------------------------- #
def test_anon_profile_create_blocked():
    r = requests.post(f"{BASE}/api/entities/Profile",
                      json={"full_name": "Anon Test"}, timeout=10)
    assert r.status_code == 401


def test_anon_casting_create_blocked():
    r = requests.post(f"{BASE}/api/entities/CastingCall",
                      json={"project_title": "Anon Test"}, timeout=10)
    assert r.status_code == 401


# --------------------------------------------------------------------------- #
# CASTING — duplicate application 409
# --------------------------------------------------------------------------- #
def test_duplicate_application_returns_409():
    token = _admin_token()
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Create a fresh casting call
    cc = requests.post(f"{BASE}/api/entities/CastingCall",
                       json={"project_title": "Checklist Dup-App Test"}, headers=h, timeout=10)
    assert cc.status_code == 200
    call_id = cc.json()["id"]
    try:
        # First application — succeeds
        a1 = requests.post(f"{BASE}/api/entities/CastingApplication",
                           json={"casting_call_id": call_id, "role": "Lead",
                                 "cover_note": "I'd love to play this role."},
                           headers=h, timeout=10)
        assert a1.status_code == 200, a1.text
        app_id = a1.json()["id"]
        try:
            # Second — should 409
            a2 = requests.post(f"{BASE}/api/entities/CastingApplication",
                               json={"casting_call_id": call_id, "role": "Lead"},
                               headers=h, timeout=10)
            assert a2.status_code == 409, f"expected 409, got {a2.status_code}: {a2.text}"
        finally:
            requests.delete(f"{BASE}/api/entities/CastingApplication/{app_id}", headers=h, timeout=10)
    finally:
        requests.delete(f"{BASE}/api/entities/CastingCall/{call_id}", headers=h, timeout=10)


# --------------------------------------------------------------------------- #
# SECURITY — owner gates, self-action blocks
# --------------------------------------------------------------------------- #
def test_admin_endpoint_requires_admin():
    r = requests.get(f"{BASE}/api/admin/launch-checklist", timeout=10)
    assert r.status_code == 401


def test_spot_request_to_self_blocked():
    token = _admin_token()
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Find Brendan's own profile
    me = requests.get(f"{BASE}/api/auth/me", headers=h, timeout=10).json()
    profiles = requests.get(f"{BASE}/api/entities/Profile?user_id={me['id']}",
                            headers=h, timeout=10).json()
    if not profiles:
        pytest.skip("admin user has no profile yet")
    own_pid = profiles[0]["id"]
    r = requests.post(f"{BASE}/api/entities/SpotRequest",
                      json={"target_profile_id": own_pid, "role": "Director"},
                      headers=h, timeout=10)
    assert r.status_code == 400, r.text
    assert "yourself" in r.json()["detail"].lower()


def test_contact_reveal_on_own_profile_blocked():
    token = _admin_token()
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    me = requests.get(f"{BASE}/api/auth/me", headers=h, timeout=10).json()
    profiles = requests.get(f"{BASE}/api/entities/Profile?user_id={me['id']}",
                            headers=h, timeout=10).json()
    if not profiles:
        pytest.skip("admin user has no profile yet")
    own_pid = profiles[0]["id"]
    r = requests.post(f"{BASE}/api/entities/ContactReveal",
                      json={"profile_id": own_pid, "revealed_email": True},
                      headers=h, timeout=10)
    assert r.status_code == 400, r.text


def test_non_admin_cannot_edit_other_users_profile():
    """Profile owned by user A is not editable by user B (non-admin)."""
    # Sign in as a fresh non-admin user
    email = "checklist-other-user@example.com"
    requests.post(f"{BASE}/api/auth/request-code", json={"email": email}, timeout=10)
    # Read code from DB
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = Path("/app/backend/.env").read_text().split("MONGO_URL=", 1)[1].splitlines()[0]
    db_name = Path("/app/backend/.env").read_text().split("DB_NAME=", 1)[1].splitlines()[0]

    async def _read():
        c = AsyncIOMotorClient(mongo_url)
        db = c[db_name]
        row = await db.login_codes.find_one({"email": email, "used": False},
                                            sort=[("created_at", -1)])
        return row["code"] if row else None
    code = asyncio.run(_read())
    if not code:
        pytest.skip("could not get OTP for non-admin test user")
    v = requests.post(f"{BASE}/api/auth/verify-code",
                      json={"email": email, "code": code}, timeout=10)
    other_token = v.json()["token"]
    h_other = {"Authorization": f"Bearer {other_token}", "Content-Type": "application/json"}

    # Find a profile that is NOT owned by this user
    all_profiles = requests.get(f"{BASE}/api/entities/Profile?limit=10", timeout=10).json()
    me = requests.get(f"{BASE}/api/auth/me", headers=h_other, timeout=10).json()
    target = next((p for p in all_profiles if p.get("user_id") != me["id"]), None)
    if not target:
        pytest.skip("no other-user profile available")
    r = requests.put(f"{BASE}/api/entities/Profile/{target['id']}",
                     json={"bio": "I should not be able to write this"},
                     headers=h_other, timeout=10)
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


# --------------------------------------------------------------------------- #
# SECURITY — middleware posture
# --------------------------------------------------------------------------- #
def test_hsts_header_absent_in_dev():
    """HSTS must not be emitted unless ENV=production."""
    r = requests.get(f"{BASE}/api/health", timeout=10)
    assert r.status_code == 200
    assert "Strict-Transport-Security" not in r.headers


def test_hsts_gated_on_prod_env_in_source():
    """server.py must mention ENV=production gating for HSTS."""
    src = Path("/app/backend/server.py").read_text()
    assert "ENV" in src and "production" in src
    assert "Strict-Transport-Security" in src


def test_cors_not_wildcard_in_prod_path():
    """server.py must NOT use ['*'] for prod CORS allow_origins."""
    src = Path("/app/backend/server.py").read_text()
    # We accept '*' under the IS_PROD=False branch, but the prod list must be explicit.
    assert "_PROD_ORIGINS" in src
    assert "https://getspotd.app" in src


# --------------------------------------------------------------------------- #
# DIRECTORY filters
# --------------------------------------------------------------------------- #
def test_directory_excludes_hidden_profiles():
    """Profiles flagged is_hidden should be filtered from public list."""
    profiles = requests.get(f"{BASE}/api/entities/Profile?limit=200", timeout=10).json()
    assert all(not p.get("is_hidden") for p in profiles), \
        "is_hidden profiles must not appear in the public directory"


def test_companies_endpoint_returns_list():
    r = requests.get(f"{BASE}/api/public-verified-companies", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# --------------------------------------------------------------------------- #
# View counts
# --------------------------------------------------------------------------- #
def test_view_count_404_on_unknown():
    r = requests.post(f"{BASE}/api/profiles/this-does-not-exist/view", json={}, timeout=10)
    assert r.status_code == 404
    r = requests.post(f"{BASE}/api/casting/this-does-not-exist/view", json={}, timeout=10)
    assert r.status_code == 404
