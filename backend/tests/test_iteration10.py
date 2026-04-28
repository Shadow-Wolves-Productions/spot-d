"""
Iteration 10 backend tests.
Validates:
  - OTP login flow works (request-code -> verify-code) for admin
  - Casting call lifecycle (create, GET by id, poster_image persisted)
  - File upload endpoint (/api/integrations/Core/UploadFile) returns file_url
  - User.update can flip role between admin/user (admin-only)
"""
import os, io, time, requests, pytest
from pymongo import MongoClient

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if "REACT_APP_BACKEND_URL" in os.environ else None
if not BASE:
    # fallback to reading frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.strip().split("=", 1)[1]
                break

ADMIN_EMAIL = "brendan@shadowwolvesproductions.com.au"
MONGO_URL = open("/app/backend/.env").read()
import re
m = re.search(r"MONGO_URL=(.+)", MONGO_URL); MURL = m.group(1).strip()
m = re.search(r"DB_NAME=(.+)", open("/app/backend/.env").read()); DB = m.group(1).strip()


@pytest.fixture(scope="module")
def admin_token():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/request-code", json={"email": ADMIN_EMAIL}, timeout=20)
    assert r.status_code == 200, f"request-code failed: {r.status_code} {r.text}"
    body = r.json()
    code = body.get("dev_code")
    if not code:
        # pull from mongo
        cli = MongoClient(MURL); db = cli[DB]
        doc = db.login_codes.find({"email": ADMIN_EMAIL}).sort("created_at", -1).limit(1)
        doc = list(doc)
        assert doc, "no login_code found in DB"
        code = doc[0]["code"]
    r = s.post(f"{BASE}/api/auth/verify-code", json={"email": ADMIN_EMAIL, "code": code}, timeout=20)
    assert r.status_code == 200, f"verify-code failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in {r.json()}"
    return tok


@pytest.fixture
def auth_session(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}"})
    return s


def test_health_root():
    r = requests.get(f"{BASE}/api/", timeout=15)
    assert r.status_code in (200, 404)


def test_upload_file_returns_url(auth_session):
    # craft a tiny 1x1 PNG
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
        "89000000094944415478da6300010000050001a5d5b6660000000049454e44ae"
        "426082"
    )
    files = {"file": ("test_poster.png", io.BytesIO(png), "image/png")}
    r = auth_session.post(f"{BASE}/api/upload/company-logo", files=files, timeout=30)
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    file_url = body.get("file_url") or body.get("url")
    assert file_url, body
    assert isinstance(file_url, str) and len(file_url) > 0
    return file_url


def test_create_casting_call_with_poster_persists(auth_session):
    # 1. upload poster
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
        "89000000094944415478da6300010000050001a5d5b6660000000049454e44ae"
        "426082"
    )
    files = {"file": ("poster.png", io.BytesIO(png), "image/png")}
    up = auth_session.post(f"{BASE}/api/upload/company-logo", files=files, timeout=30)
    assert up.status_code == 200, up.text
    poster_url = up.json().get("file_url") or up.json().get("url")
    assert poster_url

    # 2. create casting call
    payload = {
        "project_title": f"TEST_iter10_{int(time.time())}",
        "project_type": "Short Film",
        "description": "Iteration 10 poster persistence test.",
        "location": "Sydney, NSW",
        "shoot_dates": "Feb 2026",
        "budget_range": "$10k-$50k",
        "roles_needed": ["Director of Photography"],
        "poster_image": poster_url,
        "is_active": True,
        "application_method": "spot_button",
    }
    cr = auth_session.post(f"{BASE}/api/entities/CastingCall", json=payload, timeout=30)
    assert cr.status_code in (200, 201), f"create casting failed: {cr.status_code} {cr.text[:300]}"
    call = cr.json()
    cid = call.get("id") or call.get("_id")
    assert cid, call

    # 3. GET by id and verify poster persisted
    g = auth_session.get(f"{BASE}/api/entities/CastingCall/{cid}", timeout=15)
    assert g.status_code == 200, g.text
    fetched = g.json()
    assert fetched.get("poster_image") == poster_url, f"poster not persisted: {fetched.get('poster_image')}"
    assert fetched.get("project_title") == payload["project_title"]

    # 4. cleanup
    auth_session.delete(f"{BASE}/api/entities/CastingCall/{cid}", timeout=15)


def test_admin_user_role_toggle(auth_session):
    # Find a non-admin user; flip to admin and back
    r = auth_session.get(f"{BASE}/api/entities/User?limit=50", timeout=15)
    assert r.status_code == 200
    users = r.json()
    if isinstance(users, dict): users = users.get("data") or users.get("items") or []
    target = next((u for u in users if u.get("email") and u["email"] != ADMIN_EMAIL and u.get("role") != "admin"), None)
    if not target:
        pytest.skip("no eligible non-admin user to toggle")
    uid = target["id"]
    original_role = target.get("role", "user")

    p1 = auth_session.put(f"{BASE}/api/entities/User/{uid}", json={"role": "admin"}, timeout=15)
    assert p1.status_code in (200, 204), p1.text

    g = auth_session.get(f"{BASE}/api/entities/User/{uid}", timeout=15)
    assert g.status_code == 200
    assert g.json().get("role") == "admin", g.json()

    # revert
    p2 = auth_session.put(f"{BASE}/api/entities/User/{uid}", json={"role": original_role}, timeout=15)
    assert p2.status_code in (200, 204), p2.text


def test_casting_calls_list_public_or_auth(auth_session):
    # Verify list endpoint works (so directory page can render)
    r = auth_session.get(f"{BASE}/api/entities/CastingCall?is_active=true&limit=5", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    if isinstance(body, dict): body = body.get("data") or body.get("items") or []
    assert isinstance(body, list)
