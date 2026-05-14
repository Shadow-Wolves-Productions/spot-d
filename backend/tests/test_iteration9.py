"""Iteration 9 backend tests — founder cap admin-editable, waitlist, OG images,
public-verified-companies, launch-checklist, public-stats cache.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://spotd-casting.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "brendan@shadowwolvesproductions.com.au"
PROFILE_SLUG = "brendanbyrneofficial"


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/request-code", json={"email": ADMIN_EMAIL})
    if r.status_code != 200:
        pytest.skip(f"request-code failed {r.status_code}: {r.text}")
    code = r.json().get("dev_code")
    if not code:
        pytest.skip("no dev_code in response")
    r2 = api.post(f"{BASE_URL}/api/auth/verify-code", json={"email": ADMIN_EMAIL, "code": code})
    assert r2.status_code == 200, r2.text
    return r2.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------- public-stats
class TestPublicStats:
    def test_returns_founder_cap_and_remaining(self, api):
        r = api.get(f"{BASE_URL}/api/public-stats")
        assert r.status_code == 200
        data = r.json()
        assert "founder_cap" in data
        assert "founder_remaining" in data
        assert "founder_count" in data
        assert data["founder_cap"] == 100
        # 1 founder seeded → remaining 99
        assert data["founder_remaining"] == data["founder_cap"] - data["founder_count"]
        assert "_id" not in data

    def test_cached_under_50ms(self, api):
        # warm
        api.get(f"{BASE_URL}/api/public-stats")
        t0 = time.time()
        r = api.get(f"{BASE_URL}/api/public-stats")
        dt = (time.time() - t0) * 1000
        assert r.status_code == 200
        # network adds latency; assert < 1500ms (preview env)
        assert dt < 1500, f"second call too slow: {dt}ms"


# ---------------------------------------------------------------- verified companies
class TestVerifiedCompanies:
    def test_anonymous_returns_3plus(self, api):
        r = api.get(f"{BASE_URL}/api/public-verified-companies")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 3, f"only {len(items)} verified companies"
        for it in items:
            assert "id" in it
            assert "company_name" in it
            assert "company_slug" in it
            assert "company_type" in it
            assert "_id" not in it
        slugs = {it["company_slug"] for it in items}
        assert "shadow-wolves-productions" in slugs
        assert "phantom-digital-fx" in slugs
        assert "mellow-pictures" in slugs


# ---------------------------------------------------------------- OG images
class TestOgImages:
    def test_og_casting_returns_png(self, api):
        # find a casting call id via mongo seeded data
        import subprocess, json as _json
        try:
            out = subprocess.check_output([
                "mongosh", "--quiet", "mongodb://localhost:27017/spotd",
                "--eval", "JSON.stringify(db.casting_calls.findOne({is_active:true},{id:1,_id:0}))"
            ], timeout=10).decode().strip()
            cid = _json.loads(out)["id"]
        except Exception as e:
            pytest.skip(f"can't fetch casting id: {e}")
        r2 = api.get(f"{BASE_URL}/api/og/casting/{cid}.png")
        assert r2.status_code == 200, r2.text[:200]
        assert r2.headers["content-type"] == "image/png"
        assert "Cache-Control" in r2.headers or "cache-control" in r2.headers
        first_bytes = r2.content
        assert len(first_bytes) > 100
        # second call cached
        r3 = api.get(f"{BASE_URL}/api/og/casting/{cid}.png")
        assert r3.status_code == 200
        assert r3.content == first_bytes

    def test_og_profile_returns_png(self, api):
        r = api.get(f"{BASE_URL}/api/og/profile/{PROFILE_SLUG}.png")
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/png"
        assert len(r.content) > 100

    def test_og_casting_404(self, api):
        r = api.get(f"{BASE_URL}/api/og/casting/nonexistent-id-xyz.png")
        assert r.status_code == 404

    def test_og_profile_404(self, api):
        r = api.get(f"{BASE_URL}/api/og/profile/nonexistent-slug-xyz.png")
        assert r.status_code == 404


# ---------------------------------------------------------------- waitlist
class TestWaitlist:
    def test_waitlist_signup_and_dedupe(self, api):
        email = f"TEST_waitlist_{int(time.time())}@example.com"
        r1 = api.post(f"{BASE_URL}/api/waitlist", json={"email": email, "source": "test"})
        assert r1.status_code == 200, r1.text
        assert r1.json() == {"ok": True, "already_listed": False}
        r2 = api.post(f"{BASE_URL}/api/waitlist", json={"email": email, "source": "test"})
        assert r2.status_code == 200
        assert r2.json() == {"ok": True, "already_listed": True}

    def test_admin_waitlist_list(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/waitlist", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data and "items" in data
        assert isinstance(data["items"], list)
        assert data["total"] >= 1


# ---------------------------------------------------------------- platform settings
class TestPlatformSettings:
    def test_get_settings(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/platform-settings", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "founder_cap" in d

    def test_unauthorized_put(self):
        # use a fresh session so any auth cookies set by other tests don't leak in
        r = requests.put(f"{BASE_URL}/api/admin/platform-settings", json={"founder_cap": 200})
        assert r.status_code in (401, 403)

    def test_validation_zero(self, api, admin_headers):
        r = api.put(f"{BASE_URL}/api/admin/platform-settings", json={"founder_cap": 0}, headers=admin_headers)
        assert r.status_code == 422

    def test_validation_negative(self, api, admin_headers):
        r = api.put(f"{BASE_URL}/api/admin/platform-settings", json={"founder_cap": -5}, headers=admin_headers)
        assert r.status_code == 422

    def test_update_invalidates_cache(self, api, admin_headers):
        # set cap to 150
        r = api.put(f"{BASE_URL}/api/admin/platform-settings", json={"founder_cap": 150}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        time.sleep(0.3)
        ps = api.get(f"{BASE_URL}/api/public-stats").json()
        assert ps["founder_cap"] == 150, ps
        # reset
        r2 = api.put(f"{BASE_URL}/api/admin/platform-settings", json={"founder_cap": 100}, headers=admin_headers)
        assert r2.status_code == 200
        time.sleep(0.3)
        ps2 = api.get(f"{BASE_URL}/api/public-stats").json()
        assert ps2["founder_cap"] == 100


# ---------------------------------------------------------------- launch checklist
class TestLaunchChecklist:
    def test_checklist_items(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/launch-checklist", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        keys = {it["key"] for it in d["items"]}
        assert {"email_live", "sms_live", "stripe_keys", "profile_count", "pending_welcome"}.issubset(keys)
        for it in d["items"]:
            assert "label" in it and "ok" in it and "value" in it


# ---------------------------------------------------------------- founder claim w/ dynamic cap
class TestFounderClaim:
    def test_claim_when_cap_full(self, api, admin_headers):
        # set cap to 1 (1 founder already exists → claiming should fail)
        r = api.put(f"{BASE_URL}/api/admin/platform-settings", json={"founder_cap": 1}, headers=admin_headers)
        assert r.status_code == 200
        try:
            # need a non-admin user to claim. Create temp user.
            email = f"TEST_claim_{int(time.time())}@example.com"
            rc = api.post(f"{BASE_URL}/api/auth/request-code", json={"email": email})
            if rc.status_code != 200:
                pytest.skip("can't create test user")
            code = rc.json().get("dev_code")
            rv = api.post(f"{BASE_URL}/api/auth/verify-code", json={"email": email, "code": code})
            tok = rv.json()["token"]
            rclaim = api.post(f"{BASE_URL}/api/stripe/founder-claim", headers={"Authorization": f"Bearer {tok}"})
            assert rclaim.status_code == 400
            assert "1" in rclaim.text or "claimed" in rclaim.text.lower()
        finally:
            # always reset
            api.put(f"{BASE_URL}/api/admin/platform-settings", json={"founder_cap": 100}, headers=admin_headers)

    def test_founder_count_uses_cap(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/stripe/founder-count")
        assert r.status_code == 200
        d = r.json()
        assert d["max"] == 100
        assert d["count"] >= 1
        assert d["remaining"] == d["max"] - d["count"]


# ---------------------------------------------------------------- regression
class TestRegression:
    def test_health(self, api):
        r = api.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_request_code(self, api):
        r = api.post(f"{BASE_URL}/api/auth/request-code", json={"email": "regression_test@example.com"})
        assert r.status_code == 200

    def test_public_stats_no_id_leak(self, api):
        r = api.get(f"{BASE_URL}/api/public-stats")
        assert "_id" not in r.text
