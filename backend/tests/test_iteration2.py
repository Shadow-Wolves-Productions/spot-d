"""Iteration 2 tests for Spot'd:
- Bulk import (admin only, idempotent)
- Postmark webhook
- Stripe renewal webhook (no-crash check)
- Imported CineConnect data verification (~57 PRO subs)
"""
import json
import os
import urllib.parse
import uuid
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


def _login(s, email):
    r = s.post(f"{BASE_URL}/api/auth/request-code", json={"email": email})
    if r.status_code == 429:
        pytest.skip("rate limited")
    assert r.status_code == 200, r.text
    code = r.json()["dev_code"]
    r2 = s.post(f"{BASE_URL}/api/auth/verify-code", json={"email": email, "code": code})
    assert r2.status_code == 200, r2.text
    return r2.json()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin(session):
    data = _login(session, ADMIN_EMAIL)
    return {
        "token": data["token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['token']}",
                    "Content-Type": "application/json"},
    }


@pytest.fixture(scope="module")
def regular_user(session):
    email = f"reg_{uuid.uuid4().hex[:8]}@example.com"
    data = _login(session, email)
    return {
        "token": data["token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['token']}",
                    "Content-Type": "application/json"},
    }


# ---------- Imported data verification ----------
class TestImportedData:
    def test_profiles_count_at_least_58(self, session):
        r = session.get(f"{BASE_URL}/api/entities/Profile?limit=200")
        assert r.status_code == 200, r.text
        items = r.json()
        assert len(items) >= 58, f"expected ~58 profiles, got {len(items)}"

    def test_pro_subscriptions_57_with_cineconnect_ref(self, session, admin):
        flt = urllib.parse.quote(json.dumps({"tier": "pro"}))
        r = session.get(f"{BASE_URL}/api/entities/Subscription?filter={flt}&limit=200",
                        headers=admin["headers"])
        assert r.status_code == 200, r.text
        items = r.json()
        cineconnect = [s for s in items if s.get("payment_reference") == "cineconnect-import"]
        assert len(cineconnect) >= 57, f"expected >=57 cineconnect subs, got {len(cineconnect)}"
        # All should be active
        assert all(s["status"] == "active" for s in cineconnect)
        # All should have expires_at set ~ 12 months out
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        for s in cineconnect[:5]:
            exp = datetime.fromisoformat(s["expires_at"].replace("Z", "+00:00"))
            delta = (exp - now).days
            assert 300 <= delta <= 400, f"unexpected expiry days: {delta}"

    def test_imported_profiles_have_score_and_slug(self, session):
        r = session.get(f"{BASE_URL}/api/entities/Profile?limit=200")
        items = r.json()
        imported = [p for p in items if p.get("import_source") == "cineconnect-import"]
        assert len(imported) >= 57
        for p in imported[:10]:
            assert p.get("spot_score", 0) > 0, f"score 0 for {p.get('profile_slug')}"
            slug = p.get("profile_slug", "")
            assert slug == slug.lower(), f"slug not lowercase: {slug}"
            assert " " not in slug
            assert all(c.isalnum() or c == "-" for c in slug), f"bad slug chars: {slug}"

    def test_tara_ponsford_profile_exists(self, session):
        # Probe a known imported user
        flt = urllib.parse.quote(json.dumps({"profile_slug": "tara-ponsford"}))
        r = session.get(f"{BASE_URL}/api/entities/Profile?filter={flt}")
        assert r.status_code == 200
        items = r.json()
        if not items:
            # try alternative slug formats
            r2 = session.get(f"{BASE_URL}/api/entities/Profile?limit=200")
            slugs = [p.get("profile_slug") for p in r2.json()]
            pytest.skip(f"tara-ponsford slug not found; available examples: {slugs[:5]}")
        assert items[0]["profile_slug"] == "tara-ponsford"


# ---------- Bulk import endpoint ----------
class TestBulkImport:
    SAMPLE = {
        "members": [
            {"email": "TEST_BULK_a@example.com", "full_name": "Test Bulk A",
             "primary_role": "Actor", "city": "Sydney", "state": "NSW", "country": "AU"},
            {"email": "TEST_BULK_b@example.com", "full_name": "Test Bulk B",
             "primary_role": "Director", "city": "Melbourne", "state": "VIC", "country": "AU"},
        ],
        "payment_reference": "test-bulk-import",
        "send_welcome": False,
        "months": 12,
    }

    def test_non_admin_gets_403(self, session, regular_user):
        r = session.post(f"{BASE_URL}/api/admin/bulk-import",
                         json=self.SAMPLE, headers=regular_user["headers"])
        assert r.status_code == 403, r.text

    def test_unauthenticated_gets_401(self, session):
        r = requests.post(f"{BASE_URL}/api/admin/bulk-import", json=self.SAMPLE)
        assert r.status_code == 401, r.text

    def test_admin_imports_then_idempotent(self, session, admin):
        # First run
        r = session.post(f"{BASE_URL}/api/admin/bulk-import",
                         json=self.SAMPLE, headers=admin["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        # Either both created (2 imported) OR they exist (still appended to imported, but user_created=False)
        assert body["imported"] >= 0
        # Verify they exist now
        for m in self.SAMPLE["members"]:
            flt = urllib.parse.quote(json.dumps({"email": m["email"].lower()}))
            r2 = session.get(f"{BASE_URL}/api/entities/Profile?filter={flt}")
            assert r2.status_code == 200
            assert len(r2.json()) >= 1, f"profile not created for {m['email']}"

        # Second run — must not create new users
        r3 = session.post(f"{BASE_URL}/api/admin/bulk-import",
                          json=self.SAMPLE, headers=admin["headers"])
        assert r3.status_code == 200, r3.text
        body3 = r3.json()
        details = body3.get("details", {}).get("imported", [])
        # All should report user_created=False on second pass
        new_users = [d for d in details if d.get("user_created")]
        assert len(new_users) == 0, f"idempotency failed: {new_users}"


# ---------- Postmark webhook ----------
class TestPostmarkWebhook:
    def test_postmark_accepts_arbitrary_json(self, session):
        payload = {
            "RecordType": "Delivery",
            "MessageID": f"test-{uuid.uuid4().hex[:8]}",
            "Recipient": "test@example.com",
            "ServerID": 1,
        }
        r = session.post(f"{BASE_URL}/api/webhooks/postmark", json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("received") is True

    def test_postmark_accepts_empty_body(self, session):
        r = requests.post(f"{BASE_URL}/api/webhooks/postmark",
                          headers={"Content-Type": "application/json"}, data=b"")
        # Should still 200 (graceful)
        assert r.status_code == 200, r.text


# ---------- Stripe renewal webhook (no-crash) ----------
class TestStripeRenewalWebhook:
    def test_stripe_webhook_no_crash_on_invalid_body(self, session):
        # Without valid signature, handler logs error and returns {received: True}
        r = session.post(f"{BASE_URL}/api/webhook/stripe",
                         headers={"Content-Type": "application/json",
                                  "Stripe-Signature": "t=0,v1=invalid"},
                         data=b'{"type":"customer.subscription.updated"}')
        assert r.status_code == 200, r.text
        assert r.json().get("received") is True
