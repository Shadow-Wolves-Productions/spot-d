"""Spot'd backend regression tests.

Covers:
 - Health
 - OTP request/verify, /auth/me, rate limit, attempts lockout
 - Generic entity CRUD (Profile, Subscription, CastingCall) + filter syntax
 - Seeded data (Brendan, profile, subscription, Thunk casting call)
 - Functions: recalculateSpotScore, sendVerificationCode + verifyCode, sendWelcomeEmail
 - Stripe checkout (uses sk_test_emergent), founder-count, founder-claim
"""
import os
import json
import time
import uuid
import urllib.parse
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for in-container testing
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "brendan@shadowwolvesproductions.com.au"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email):
    r = session.post(f"{BASE_URL}/api/auth/request-code", json={"email": email})
    if r.status_code == 429:
        pytest.skip("rate limited from earlier run")
    assert r.status_code == 200, r.text
    body = r.json()
    code = body.get("dev_code")
    assert code, f"No dev_code in mock response: {body}"
    r2 = session.post(f"{BASE_URL}/api/auth/verify-code", json={"email": email, "code": code})
    assert r2.status_code == 200, r2.text
    data = r2.json()
    return data["token"], data["user"], data.get("profile")


@pytest.fixture(scope="session")
def admin_auth(session):
    token, user, profile = _login(session, ADMIN_EMAIL)
    return {"token": token, "user": user, "profile": profile,
            "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


# --- Health ---
class TestHealth:
    def test_health(self, session):
        r = session.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        assert "time" in body


# --- Auth ---
class TestAuth:
    def test_request_code_returns_dev_code(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{BASE_URL}/api/auth/request-code", json={"email": email})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert "dev_code" in body
        assert len(body["dev_code"]) == 6

    def test_verify_code_returns_jwt(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{BASE_URL}/api/auth/request-code", json={"email": email}).json()
        code = r["dev_code"]
        v = session.post(f"{BASE_URL}/api/auth/verify-code", json={"email": email, "code": code})
        assert v.status_code == 200, v.text
        d = v.json()
        assert "token" in d and isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["user"]["email"] == email

    def test_me_with_bearer(self, session, admin_auth):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=admin_auth["headers"])
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "admin"

    def test_me_without_token(self, session):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_rate_limit_4th_request(self, session):
        email = f"ratelimit_{uuid.uuid4().hex[:8]}@example.com"
        statuses = []
        for _ in range(4):
            r = session.post(f"{BASE_URL}/api/auth/request-code", json={"email": email})
            statuses.append(r.status_code)
        assert statuses[:3] == [200, 200, 200], statuses
        assert statuses[3] == 429, f"Expected 429 on 4th, got {statuses}"

    def test_invalid_code_attempts_lockout(self, session):
        email = f"lockout_{uuid.uuid4().hex[:8]}@example.com"
        session.post(f"{BASE_URL}/api/auth/request-code", json={"email": email})
        # 4 wrong attempts -> 400 invalid; 5th wrong -> 400 too many
        for i in range(4):
            r = session.post(f"{BASE_URL}/api/auth/verify-code", json={"email": email, "code": "000000"})
            assert r.status_code == 400
        r = session.post(f"{BASE_URL}/api/auth/verify-code", json={"email": email, "code": "000000"})
        assert r.status_code == 400
        # After 5th, code should be marked used; verifying with anything returns "No active code"
        r2 = session.post(f"{BASE_URL}/api/auth/verify-code", json={"email": email, "code": "111111"})
        assert r2.status_code == 400


# --- Seeded data ---
class TestSeed:
    def test_brendan_user_exists(self, session, admin_auth):
        u = admin_auth["user"]
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "admin"

    def test_brendan_profile_seeded(self, session):
        flt = urllib.parse.quote(json.dumps({"profile_slug": "brendanbyrneofficial"}))
        r = session.get(f"{BASE_URL}/api/entities/Profile?filter={flt}")
        assert r.status_code == 200, r.text
        items = r.json()
        assert len(items) >= 1
        p = items[0]
        assert p["full_name"] == "Brendan Byrne"
        assert p["spot_score"] == 41
        assert p["spot_percentile"] == 99

    def test_founder_subscription_seeded(self, session, admin_auth):
        flt = urllib.parse.quote(json.dumps({"user_id": admin_auth["user"]["id"]}))
        r = session.get(f"{BASE_URL}/api/entities/Subscription?filter={flt}",
                        headers=admin_auth["headers"])
        assert r.status_code == 200
        items = r.json()
        assert any(s["tier"] == "founder" and s["status"] == "active" for s in items)

    def test_thunk_casting_call_seeded(self, session):
        flt = urllib.parse.quote(json.dumps({"project_title": "Thunk"}))
        r = session.get(f"{BASE_URL}/api/entities/CastingCall?filter={flt}")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert items[0]["project_title"] == "Thunk"


# --- Entity CRUD ---
class TestEntityCRUD:
    def test_filter_syntax(self, session, admin_auth):
        flt = urllib.parse.quote(json.dumps({"user_id": admin_auth["user"]["id"]}))
        r = session.get(f"{BASE_URL}/api/entities/Profile?filter={flt}")
        assert r.status_code == 200
        items = r.json()
        assert all(p.get("user_id") == admin_auth["user"]["id"] for p in items)

    def test_create_update_delete_casting_call(self, session, admin_auth):
        # CREATE
        payload = {"project_title": "TEST_Project", "description": "test", "is_active": True}
        r = session.post(f"{BASE_URL}/api/entities/CastingCall", json=payload,
                         headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        item = r.json()
        cid = item["id"]
        assert item["project_title"] == "TEST_Project"

        # GET (verify persisted)
        g = session.get(f"{BASE_URL}/api/entities/CastingCall/{cid}")
        assert g.status_code == 200
        assert g.json()["id"] == cid

        # PATCH
        u = session.patch(f"{BASE_URL}/api/entities/CastingCall/{cid}",
                          json={"project_title": "TEST_Updated"},
                          headers=admin_auth["headers"])
        assert u.status_code == 200
        assert u.json()["project_title"] == "TEST_Updated"

        # DELETE
        d = session.delete(f"{BASE_URL}/api/entities/CastingCall/{cid}",
                           headers=admin_auth["headers"])
        assert d.status_code == 200

        g2 = session.get(f"{BASE_URL}/api/entities/CastingCall/{cid}")
        assert g2.status_code == 404


# --- Functions ---
class TestFunctions:
    def test_recalculate_spotscore(self, session, admin_auth):
        pid = admin_auth["profile"]["id"]
        r = session.post(f"{BASE_URL}/api/functions/recalculateSpotScore",
                         json={"profile_id": pid}, headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert isinstance(body.get("spot_score"), int)

    def test_send_verification_code_email(self, session, admin_auth):
        r = session.post(f"{BASE_URL}/api/functions/sendVerificationCode",
                         json={"type": "email"}, headers=admin_auth["headers"])
        if r.status_code == 429:
            pytest.skip("verification rate limited")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert "dev_code" in body  # mock mode
        code = body["dev_code"]

        v = session.post(f"{BASE_URL}/api/functions/verifyCode",
                         json={"type": "email", "code": code},
                         headers=admin_auth["headers"])
        assert v.status_code == 200, v.text
        assert v.json().get("success") is True

    def test_send_welcome_email(self, session, admin_auth):
        r = session.post(f"{BASE_URL}/api/functions/sendWelcomeEmail",
                         json={"user_id": admin_auth["user"]["id"],
                               "profile_id": admin_auth["profile"]["id"],
                               "tier": "founder"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        # Verify profile updated
        g = session.get(f"{BASE_URL}/api/entities/Profile/{admin_auth['profile']['id']}")
        assert g.json().get("welcome_email_sent") is True


# --- Stripe ---
class TestStripe:
    def test_checkout_creates_session(self, session, admin_auth):
        origin = BASE_URL
        r = session.post(f"{BASE_URL}/api/stripe/checkout",
                         json={"plan_id": "pro_monthly", "origin_url": origin},
                         headers=admin_auth["headers"])
        if r.status_code == 500 and "lib unavailable" in r.text.lower():
            pytest.skip("emergentintegrations not installed")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "url" in d and d["url"].startswith("http")
        assert "session_id" in d

    def test_checkout_invalid_plan(self, session, admin_auth):
        r = session.post(f"{BASE_URL}/api/stripe/checkout",
                         json={"plan_id": "bogus", "origin_url": BASE_URL},
                         headers=admin_auth["headers"])
        assert r.status_code == 400

    def test_checkout_unauthenticated(self, session):
        r = requests.post(f"{BASE_URL}/api/stripe/checkout",
                          json={"plan_id": "pro_monthly", "origin_url": BASE_URL})
        assert r.status_code == 401

    def test_founder_count(self, session):
        r = session.get(f"{BASE_URL}/api/stripe/founder-count")
        assert r.status_code == 200
        body = r.json()
        assert body["max"] == 500
        assert body["count"] >= 1
        assert body["remaining"] == 500 - body["count"]

    def test_founder_claim_idempotent(self, session, admin_auth):
        # Brendan already has founder; claim should succeed with same/updated subscription
        r = session.post(f"{BASE_URL}/api/stripe/founder-claim",
                         json={}, headers=admin_auth["headers"])
        assert r.status_code in (200, 400)
        if r.status_code == 200:
            assert r.json().get("success") is True
