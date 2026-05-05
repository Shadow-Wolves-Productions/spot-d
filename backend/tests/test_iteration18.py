"""Iter 18 — GridFS uploads + phone-verification removal + photo carousel field."""
import asyncio
import io
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core import make_token  # noqa: E402

BASE = os.environ.get("BACKEND_BASE", "http://localhost:8001")


def _admin_token():
    from motor.motor_asyncio import AsyncIOMotorClient
    async def _go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        u = await db.users.find_one({"role": "admin"}, {"_id": 0, "id": 1})
        return u["id"]
    return make_token(asyncio.run(_go()))


def _make_png_bytes() -> bytes:
    """Tiny in-memory PNG so the upload endpoint has a real image to chew on."""
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color="blue").save(buf, format="PNG")
    return buf.getvalue()


# --------------------------------------------------------------------------- #
# Profile photo upload now stores in GridFS — the returned URL must be the
# new /api/uploads/file/{id} form, and the file must be downloadable.
# --------------------------------------------------------------------------- #
def test_profile_photo_upload_uses_gridfs_and_persists():
    token = _admin_token()
    h = {"Authorization": f"Bearer {token}"}

    files = {"file": ("test.png", _make_png_bytes(), "image/png")}
    r = requests.post(f"{BASE}/api/upload/profile-photo", headers=h, files=files, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()

    # New URL shape: /api/uploads/file/{ObjectId}
    assert body["url"].startswith("/api/uploads/file/"), body
    assert body["file_url"] == body["url"]
    assert body["size"] > 0
    assert body["id"]

    # File must be retrievable from the public GET endpoint.
    file_id = body["id"]
    r2 = requests.get(f"{BASE}/api/uploads/file/{file_id}", timeout=10)
    assert r2.status_code == 200
    assert r2.headers["content-type"] in ("image/png", "image/jpeg", "image/jpg", "image/webp")
    assert len(r2.content) == body["size"]
    # Cache header should be aggressive (immutable per ID).
    assert "immutable" in r2.headers.get("cache-control", "").lower()


def test_profile_photo_upload_404_for_unknown_file_id():
    r = requests.get(f"{BASE}/api/uploads/file/000000000000000000000000", timeout=10)
    assert r.status_code == 404


# --------------------------------------------------------------------------- #
# Phone verification permanently retired
# --------------------------------------------------------------------------- #
def test_send_verification_code_phone_returns_400():
    token = _admin_token()
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    r = requests.post(
        f"{BASE}/api/functions/sendVerificationCode",
        headers=h,
        json={"type": "phone", "phone": "+15555555555"},
        timeout=10,
    )
    assert r.status_code == 400
    assert "email" in r.json().get("detail", "").lower()


# --------------------------------------------------------------------------- #
# Profile model now accepts ``additional_photos`` for the headshot carousel.
# --------------------------------------------------------------------------- #
def test_profile_accepts_additional_photos():
    from motor.motor_asyncio import AsyncIOMotorClient
    async def _seed_and_check():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        # Find any existing profile we own
        admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "id": 1})
        return admin["id"]
    user_id = asyncio.run(_seed_and_check())
    h = {"Authorization": f"Bearer {make_token(user_id)}", "Content-Type": "application/json"}

    # Find the admin's own profile then PATCH additional_photos
    profiles = requests.get(
        f"{BASE}/api/entities/Profile?filter=%7B%22user_id%22%3A%22" + user_id + "%22%7D",
        headers=h,
        timeout=10,
    ).json()
    if not profiles:
        return  # skip — no profile to update
    pid = profiles[0]["id"]
    r = requests.put(
        f"{BASE}/api/entities/Profile/{pid}",
        headers=h,
        json={"additional_photos": ["/api/uploads/file/aaaa", "/api/uploads/file/bbbb"]},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    fresh = requests.get(f"{BASE}/api/entities/Profile/{pid}", headers=h, timeout=10).json()
    assert fresh.get("additional_photos") == ["/api/uploads/file/aaaa", "/api/uploads/file/bbbb"]
