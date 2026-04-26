"""Iteration 6 backend tests for Spot'd new endpoints.

Covers:
  - GET /api/health
  - GET /api/analytics/summary (tier-aware payload)
  - GET /api/auto-claim/check + POST /api/auto-claim/dismiss
  - Profile listing excludes is_hidden=true profiles
  - Admin endpoints: /api/admin/{logs,imports,emails,platform,casting-calls}
  - POST /api/admin/profile/{id}/flag (writes admin_logs)
  - POST /api/functions/sendProfileCompletionNudges (admin only)
  - CastingCall create with posted_as=company persists company attribution
"""
import os
import json
import uuid
import urllib.parse
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
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
        pytest.skip("rate limited")
    assert r.status_code == 200, r.text
    code = r.json().get("dev_code")
    assert code
    r2 = session.post(f"{BASE_URL}/api/auth/verify-code", json={"email": email, "code": code})
    assert r2.status_code == 200, r2.text
    d = r2.json()
    return d["token"], d["user"], d.get("profile")


@pytest.fixture(scope="session")
def admin_auth(session):
    token, user, profile = _login(session, ADMIN_EMAIL)
    return {
        "token": token,
        "user": user,
        "profile": profile,
        "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    }


@pytest.fixture(scope="session")
def regular_user_auth(session):
    """Create a fresh non-admin user for negative-permission and auto-claim checks."""
    email = f"test_iter6_user_{uuid.uuid4().hex[:8]}@example.com"
    token, user, profile = _login(session, email)
    return {
        "email": email,
        "token": token,
        "user": user,
        "profile": profile,
        "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    }


# ---------- Health ----------
class TestHealth:
    def test_health_ok(self, session):
        r = session.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True


# ---------- Analytics ----------
class TestAnalyticsSummary:
    def test_admin_founder_payload(self, session, admin_auth):
        r = session.get(f"{BASE_URL}/api/analytics/summary", headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        # tier-aware
        assert body.get("tier") == "founder"
        # always-on fields
        assert "totals" in body and isinstance(body["totals"], dict)
        for k in ("views", "saves", "reveals", "search_appearances"):
            assert k in body["totals"]
        assert "spot_score_history" in body and isinstance(body["spot_score_history"], list)
        # Founder = elite-tier visibility
        assert "who_saved_you" in body  # PRO+ list (could be empty list)
        assert isinstance(body["who_saved_you"], list)
        # who_revealed_contact for founder must be a list (Elite/founder)
        assert "who_revealed_contact" in body
        assert isinstance(body["who_revealed_contact"], list)

    def test_unauth_returns_401(self, session):
        r = requests.get(f"{BASE_URL}/api/analytics/summary")
        assert r.status_code == 401

    def test_free_user_gates_payload(self, session, regular_user_auth):
        # Fresh user has no profile; create a minimal profile so endpoint reaches gating logic
        uid = regular_user_auth["user"]["id"]
        slug = f"test-iter6-{uuid.uuid4().hex[:6]}"
        payload = {
            "user_id": uid,
            "full_name": "Iter6 User",
            "primary_role": "Actor",
            "profile_slug": slug,
            "is_hidden": False,
        }
        c = session.post(f"{BASE_URL}/api/entities/Profile", json=payload,
                         headers=regular_user_auth["headers"])
        assert c.status_code == 200, c.text
        try:
            r = session.get(f"{BASE_URL}/api/analytics/summary", headers=regular_user_auth["headers"])
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("tier") == "free"
            # Free tier: who_saved_you None, who_revealed_contact None
            assert body.get("who_saved_you") is None
            assert body.get("who_revealed_contact") is None
        finally:
            # Cleanup the test profile
            pid = c.json()["id"]
            session.delete(f"{BASE_URL}/api/entities/Profile/{pid}", headers=regular_user_auth["headers"])


# ---------- Auto-claim ----------
class TestAutoClaim:
    def test_check_unauth_401(self, session):
        r = requests.get(f"{BASE_URL}/api/auto-claim/check")
        assert r.status_code == 401

    def test_check_authed_returns_eligibility(self, session, admin_auth):
        r = session.get(f"{BASE_URL}/api/auto-claim/check", headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert "eligible" in body and isinstance(body["eligible"], bool)
        # Brendan already has welcome_email_sent=True, expect not eligible
        assert body["eligible"] is False

    def test_dismiss_idempotent(self, session, admin_auth):
        r = session.post(f"{BASE_URL}/api/auto-claim/dismiss", headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True


# ---------- Profile is_hidden filter ----------
class TestProfileHiddenFilter:
    def test_hidden_profile_excluded_from_list(self, session, admin_auth):
        slug = f"test-hidden-{uuid.uuid4().hex[:6]}"
        payload = {
            "user_id": admin_auth["user"]["id"] + "_test",
            "full_name": "TEST_HIDDEN",
            "primary_role": "Actor",
            "profile_slug": slug,
            "is_hidden": True,
        }
        c = session.post(f"{BASE_URL}/api/entities/Profile", json=payload,
                         headers=admin_auth["headers"])
        assert c.status_code == 200, c.text
        pid = c.json()["id"]
        try:
            # GET by id still works (defense-in-depth only filters list)
            g = session.get(f"{BASE_URL}/api/entities/Profile/{pid}")
            assert g.status_code == 200
            # Listing with explicit slug filter should NOT return it
            flt = urllib.parse.quote(json.dumps({"profile_slug": slug}))
            lr = session.get(f"{BASE_URL}/api/entities/Profile?filter={flt}")
            assert lr.status_code == 200
            items = lr.json()
            assert all(p.get("profile_slug") != slug for p in items), \
                f"Hidden profile leaked into list: {items}"
        finally:
            session.delete(f"{BASE_URL}/api/entities/Profile/{pid}",
                           headers=admin_auth["headers"])


# ---------- Admin endpoints ----------
class TestAdminEndpoints:
    def test_logs_admin_only(self, session, admin_auth, regular_user_auth):
        # Admin OK
        r = session.get(f"{BASE_URL}/api/admin/logs", headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        # No _id leaks
        for it in items[:5]:
            assert "_id" not in it
        # Non-admin forbidden
        r2 = session.get(f"{BASE_URL}/api/admin/logs", headers=regular_user_auth["headers"])
        assert r2.status_code == 403
        # Unauth
        r3 = requests.get(f"{BASE_URL}/api/admin/logs")
        assert r3.status_code == 401

    def test_imports(self, session, admin_auth):
        r = session.get(f"{BASE_URL}/api/admin/imports", headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("total", "claimed", "unclaimed", "items"):
            assert k in body
        assert isinstance(body["items"], list)
        for it in body["items"][:5]:
            assert "_id" not in it

    def test_emails(self, session, admin_auth):
        r = session.get(f"{BASE_URL}/api/admin/emails", headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        for it in items[:5]:
            assert "_id" not in it

    def test_platform(self, session, admin_auth):
        r = session.get(f"{BASE_URL}/api/admin/platform", headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("email_mock", "sms_mock", "user_count", "profile_count",
                  "casting_calls", "applications", "founder_count"):
            assert k in body, f"Missing key: {k}"
        assert body["user_count"] >= 1

    def test_casting_calls_admin(self, session, admin_auth):
        r = session.get(f"{BASE_URL}/api/admin/casting-calls", headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        for it in items[:5]:
            assert "_id" not in it

    def test_admin_endpoints_reject_non_admin(self, session, regular_user_auth):
        for path in ("/api/admin/imports", "/api/admin/emails",
                     "/api/admin/platform", "/api/admin/casting-calls"):
            r = session.get(f"{BASE_URL}{path}", headers=regular_user_auth["headers"])
            assert r.status_code == 403, f"{path} should 403 for non-admin, got {r.status_code}"


# ---------- Admin flag profile ----------
class TestAdminFlagProfile:
    def test_flag_profile_writes_log(self, session, admin_auth):
        slug = f"test-flag-{uuid.uuid4().hex[:6]}"
        c = session.post(f"{BASE_URL}/api/entities/Profile",
                         json={
                             "user_id": admin_auth["user"]["id"] + "_flagtest",
                             "full_name": "TEST_FLAG",
                             "primary_role": "Actor",
                             "profile_slug": slug,
                             "is_hidden": False,
                         },
                         headers=admin_auth["headers"])
        assert c.status_code == 200, c.text
        pid = c.json()["id"]
        try:
            # Flag as hidden
            r = session.post(f"{BASE_URL}/api/admin/profile/{pid}/flag",
                             json={"is_hidden": True},
                             headers=admin_auth["headers"])
            assert r.status_code == 200, r.text
            assert r.json().get("ok") is True

            # Verify is_hidden persisted via GET by id
            g = session.get(f"{BASE_URL}/api/entities/Profile/{pid}")
            assert g.status_code == 200
            assert g.json().get("is_hidden") is True

            # Verify admin log was written for this target
            lr = session.get(f"{BASE_URL}/api/admin/logs?limit=50",
                             headers=admin_auth["headers"])
            assert lr.status_code == 200
            logs = lr.json()
            assert any(l.get("action") == "profile.flag" and l.get("target") == pid for l in logs), \
                f"No admin log entry found for profile.flag {pid}"
        finally:
            session.delete(f"{BASE_URL}/api/entities/Profile/{pid}",
                           headers=admin_auth["headers"])


# ---------- Profile completion nudges ----------
class TestCompletionNudges:
    def test_admin_can_run_nudges(self, session, admin_auth):
        r = session.post(f"{BASE_URL}/api/functions/sendProfileCompletionNudges",
                         json={}, headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert "sent" in body
        assert isinstance(body["sent"], int)

    def test_non_admin_forbidden(self, session, regular_user_auth):
        r = session.post(f"{BASE_URL}/api/functions/sendProfileCompletionNudges",
                         json={}, headers=regular_user_auth["headers"])
        assert r.status_code == 403


# ---------- CastingCall posted_as=company attribution ----------
class TestCastingCallCompanyAttribution:
    def test_create_with_company_attribution_persists(self, session, admin_auth):
        payload = {
            "project_title": f"TEST_ITER6_CompanyCall_{uuid.uuid4().hex[:6]}",
            "description": "test",
            "is_active": True,
            "posted_as": "company",
            "posted_as_company_id": "test-company-id-123",
            "posted_as_company_slug": "test-company-slug",
            "posted_as_company_name": "Test Company Pty Ltd",
            "posted_as_company_logo": "https://example.com/logo.png",
        }
        c = session.post(f"{BASE_URL}/api/entities/CastingCall",
                         json=payload, headers=admin_auth["headers"])
        assert c.status_code == 200, c.text
        item = c.json()
        cid = item["id"]
        try:
            # Check fields on create response
            assert item.get("posted_as") == "company"
            assert item.get("posted_as_company_id") == "test-company-id-123"
            assert item.get("posted_as_company_name") == "Test Company Pty Ltd"

            # Verify persisted via GET
            g = session.get(f"{BASE_URL}/api/entities/CastingCall/{cid}")
            assert g.status_code == 200
            fetched = g.json()
            assert fetched.get("posted_as") == "company"
            assert fetched.get("posted_as_company_slug") == "test-company-slug"
            assert fetched.get("posted_as_company_logo") == "https://example.com/logo.png"
        finally:
            session.delete(f"{BASE_URL}/api/entities/CastingCall/{cid}",
                           headers=admin_auth["headers"])
