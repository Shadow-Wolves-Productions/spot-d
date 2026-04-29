"""
Iteration 12 backend tests — Phase-2 router split (entities/webhooks/admin/scheduled/public).

Validates that all the endpoints listed in the iter-12 review request still work
after server.py was thinned from 2743 → 132 lines and 2611 lines were extracted
into routers/{entities,webhooks,admin,scheduled,public}.py + bootstrap.py.

Covers:
  - GET /api/health (router-mounted)
  - Auth: request-code + verify-code (router-mounted)
  - Entities CRUD: Profile list, CastingCall list+create (relative poster_image),
    User role flip (admin↔user)
  - View counters: profile + casting (rate-limited)
  - Public: /api/public-stats, /api/public-settings, /api/public-verified-companies,
    /api/stripe/founder-count, POST /api/waitlist
  - Admin (auth required): /api/admin/launch-checklist, /api/admin/logs,
    POST /api/admin/profile/{id}/flag
  - Scheduled functions (auth admin): recalculateSpotScore, runSpottedWithMatching,
    processFoundingDeadlines
  - OG images: /api/og/casting/{id}.png, /api/og/profile/indie-film-casting.png
  - Server.py thin app factory ≤ 200 lines
"""
import io
import re
import time
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient

ENV_TEXT = Path("/app/backend/.env").read_text()
MURL = re.search(r"MONGO_URL=(.+)", ENV_TEXT).group(1).strip()
DB = re.search(r"DB_NAME=(.+)", ENV_TEXT).group(1).strip()
BASE = (
    Path("/app/frontend/.env").read_text()
    .split("REACT_APP_BACKEND_URL=")[1]
    .strip()
    .split("\n")[0]
    .rstrip("/")
)
ADMIN_EMAIL = "brendan@shadowwolvesproductions.com.au"


@pytest.fixture(scope="module")
def mongo():
    return MongoClient(MURL)[DB]


@pytest.fixture(scope="module")
def admin_token(mongo):
    s = requests.Session()
    mongo.login_codes.delete_many({"email": ADMIN_EMAIL})
    r = s.post(f"{BASE}/api/auth/request-code", json={"email": ADMIN_EMAIL}, timeout=20)
    assert r.status_code == 200, f"request-code failed: {r.status_code} {r.text}"
    code = r.json().get("dev_code")
    if not code:
        doc = list(mongo.login_codes.find({"email": ADMIN_EMAIL}).sort("created_at", -1).limit(1))
        assert doc, "no login_code in DB"
        code = doc[0]["code"]
    r = s.post(f"{BASE}/api/auth/verify-code", json={"email": ADMIN_EMAIL, "code": code}, timeout=20)
    assert r.status_code == 200, f"verify-code failed: {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture
def auth_session(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}"})
    return s


# ----------------------------- server.py thin-factory ----------------------------- #
def test_server_py_under_200_lines():
    src = Path("/app/backend/server.py").read_text().splitlines()
    assert len(src) <= 200, f"server.py is {len(src)} lines, expected ≤ 200"


# ----------------------------- routers/public.py ----------------------------- #
def test_health():
    r = requests.get(f"{BASE}/api/health", timeout=10)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True


def test_public_stats():
    r = requests.get(f"{BASE}/api/public-stats", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ("profile_count", "founder_count", "founder_remaining"):
        assert k in body, f"missing {k} in {body}"
    assert isinstance(body["profile_count"], int)


def test_public_settings():
    r = requests.get(f"{BASE}/api/public-settings", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ("founder_remaining", "founder_cap", "email_mock", "sms_mock"):
        assert k in body, f"missing {k} in {body}"


def test_public_verified_companies():
    r = requests.get(f"{BASE}/api/public-verified-companies", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list) or isinstance(body.get("items"), list), body


def test_stripe_founder_count():
    r = requests.get(f"{BASE}/api/stripe/founder-count", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "count" in body and "remaining" in body and "max" in body, body


def test_waitlist_post():
    email = f"TEST_iter12_{int(time.time())}@example.com"
    r = requests.post(f"{BASE}/api/waitlist", json={"email": email}, timeout=15)
    assert r.status_code == 200, r.text


def test_og_profile_png(mongo):
    # The review-request used 'indie-film-casting' as a placeholder slug; in the
    # actual DB the admin/Brendan profile slug is 'brendanbyrneofficial'.
    p = mongo.profiles.find_one({"profile_slug": "brendanbyrneofficial"}, {"_id": 0, "profile_slug": 1})
    if not p:
        p = mongo.profiles.find_one({}, {"_id": 0, "profile_slug": 1})
    slug = p["profile_slug"]
    r = requests.get(f"{BASE}/api/og/profile/{slug}.png", timeout=20)
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("image/png")
    assert r.content.startswith(b"\x89PNG"), "not a PNG body"


def test_og_casting_png(mongo):
    c = mongo.casting_calls.find_one({}, {"_id": 0, "id": 1})
    assert c, "no casting call in DB to test OG image"
    r = requests.get(f"{BASE}/api/og/casting/{c['id']}.png", timeout=20)
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("image/png")
    assert r.content.startswith(b"\x89PNG")


# ----------------------------- routers/entities.py ----------------------------- #
def test_entities_profile_list_public_read():
    r = requests.get(f"{BASE}/api/entities/Profile?limit=2", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    items = body if isinstance(body, list) else body.get("items") or body.get("data") or []
    assert isinstance(items, list)
    assert len(items) <= 2


def test_entities_castingcall_list():
    r = requests.get(f"{BASE}/api/entities/CastingCall", timeout=15)
    assert r.status_code == 200, r.text


def test_entities_castingcall_create_relative_poster_persists(auth_session):
    rel = "/api/static/uploads/foo.png"
    payload = {
        "project_title": f"TEST_iter12_rel_{int(time.time())}",
        "project_type": "Short Film",
        "poster_image": rel,
    }
    r = auth_session.post(f"{BASE}/api/entities/CastingCall", json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    cid = r.json().get("id")
    try:
        g = auth_session.get(f"{BASE}/api/entities/CastingCall/{cid}", timeout=10)
        assert g.status_code == 200
        assert g.json().get("poster_image") == rel
    finally:
        if cid:
            auth_session.delete(f"{BASE}/api/entities/CastingCall/{cid}", timeout=10)


def test_entities_user_role_flip(auth_session, mongo):
    """admin → user → admin via PUT /api/entities/User/{id}."""
    # Find a non-admin user (not Brendan) to flip role on. Fall back to creating one.
    target = mongo.users.find_one(
        {"email": {"$ne": ADMIN_EMAIL}},
        {"_id": 0, "id": 1, "role": 1, "email": 1},
    )
    if not target:
        pytest.skip("no non-admin user in DB to flip")
    uid = target["id"]
    original_role = target.get("role", "user")
    new_role = "admin" if original_role != "admin" else "user"
    r = auth_session.put(
        f"{BASE}/api/entities/User/{uid}", json={"role": new_role}, timeout=15
    )
    assert r.status_code in (200, 201), r.text
    # GET to verify
    g = auth_session.get(f"{BASE}/api/entities/User/{uid}", timeout=10)
    assert g.status_code == 200
    assert g.json().get("role") == new_role
    # Restore
    auth_session.put(f"{BASE}/api/entities/User/{uid}", json={"role": original_role}, timeout=15)


# ----------------------------- routers/profiles.py + casting.py — view counter ----------------------------- #
def test_profile_view_rate_limit(mongo):
    p = mongo.profiles.find_one({}, {"_id": 0, "id": 1})
    assert p
    pid = p["id"]
    mongo.view_events.delete_many({"kind": "profile", "target_id": pid})
    r1 = requests.post(f"{BASE}/api/profiles/{pid}/view", timeout=10)
    assert r1.status_code == 200 and r1.json().get("counted") is True
    r2 = requests.post(f"{BASE}/api/profiles/{pid}/view", timeout=10)
    assert r2.status_code == 200 and r2.json().get("counted") is False


def test_casting_view_rate_limit(mongo):
    c = mongo.casting_calls.find_one({}, {"_id": 0, "id": 1})
    assert c
    cid = c["id"]
    mongo.view_events.delete_many({"kind": "casting", "target_id": cid})
    r1 = requests.post(f"{BASE}/api/casting/{cid}/view", timeout=10)
    assert r1.status_code == 200 and r1.json().get("counted") is True
    r2 = requests.post(f"{BASE}/api/casting/{cid}/view", timeout=10)
    assert r2.status_code == 200 and r2.json().get("counted") is False


# ----------------------------- routers/admin.py ----------------------------- #
def test_admin_launch_checklist_unauth():
    r = requests.get(f"{BASE}/api/admin/launch-checklist", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


def test_admin_launch_checklist_auth(auth_session):
    r = auth_session.get(f"{BASE}/api/admin/launch-checklist", timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    # Should be a dict/list with checklist items
    assert body, "empty checklist response"


def test_admin_logs_unauth():
    r = requests.get(f"{BASE}/api/admin/logs", timeout=15)
    assert r.status_code in (401, 403)


def test_admin_logs_auth(auth_session):
    r = auth_session.get(f"{BASE}/api/admin/logs", timeout=15)
    assert r.status_code == 200, r.text


def test_admin_profile_flag(auth_session, mongo):
    """POST /api/admin/profile/{id}/flag with {is_hidden:true} → 200, sets is_hidden=true."""
    p = mongo.profiles.find_one(
        {"email": {"$ne": ADMIN_EMAIL}},
        {"_id": 0, "id": 1, "is_hidden": 1},
    )
    if not p:
        p = mongo.profiles.find_one({}, {"_id": 0, "id": 1, "is_hidden": 1})
    assert p
    pid = p["id"]
    original_hidden = bool(p.get("is_hidden", False))
    try:
        r = auth_session.post(
            f"{BASE}/api/admin/profile/{pid}/flag",
            json={"is_hidden": True},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # verify in db
        check = mongo.profiles.find_one({"id": pid}, {"_id": 0, "is_hidden": 1})
        assert check.get("is_hidden") is True, check
    finally:
        # restore
        auth_session.post(
            f"{BASE}/api/admin/profile/{pid}/flag",
            json={"is_hidden": original_hidden},
            timeout=15,
        )


# ----------------------------- routers/scheduled.py ----------------------------- #
def test_function_recalculate_spot_score(auth_session):
    r = auth_session.post(f"{BASE}/api/functions/recalculateSpotScore", json={}, timeout=60)
    assert r.status_code == 200, r.text


def test_function_run_spotted_with_matching(auth_session):
    r = auth_session.post(f"{BASE}/api/functions/runSpottedWithMatching", json={}, timeout=60)
    assert r.status_code == 200, r.text


def test_function_process_founding_deadlines(auth_session):
    r = auth_session.post(f"{BASE}/api/functions/processFoundingDeadlines", json={}, timeout=60)
    assert r.status_code == 200, r.text
