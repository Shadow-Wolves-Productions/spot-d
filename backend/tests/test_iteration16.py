"""Iter 16 — bulk welcome resend + lens placeholder + PUBLIC_APP_URL fix."""
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core import make_token  # noqa: E402

BASE = os.environ.get("BACKEND_BASE", "http://localhost:8001")


def _admin_token():
    """Mint a JWT for the seeded admin (Brendan)."""
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio
    async def _go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "id": 1})
        return admin["id"] if admin else None
    uid = asyncio.run(_go())
    assert uid, "no admin user found in DB"
    return make_token(uid)


# --------------------------------------------------------------------------- #
# core.PUBLIC_APP_URL is now defined (was a NameError waiting to happen)
# --------------------------------------------------------------------------- #
def test_public_app_url_is_defined_in_core():
    from core import PUBLIC_APP_URL
    assert PUBLIC_APP_URL.startswith("http")
    # No trailing slash so f"{PUBLIC_APP_URL}/login" works cleanly.
    assert not PUBLIC_APP_URL.endswith("/")


# --------------------------------------------------------------------------- #
# /api/admin/send-pending-welcomes — admin only, dry-run reports counts.
# --------------------------------------------------------------------------- #
def test_send_pending_welcomes_requires_admin():
    r = requests.post(f"{BASE}/api/admin/send-pending-welcomes", json={"dry_run": True}, timeout=10)
    assert r.status_code in (401, 403)


def test_send_pending_welcomes_dry_run_returns_count():
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    r = requests.post(f"{BASE}/api/admin/send-pending-welcomes", headers=h, json={"dry_run": True}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["dry_run"] is True
    assert "count" in body
    assert isinstance(body["queued"], list)
    assert len(body["queued"]) == body["count"]


# --------------------------------------------------------------------------- #
# Lens-only placeholder image is reachable
# --------------------------------------------------------------------------- #
def test_lens_only_asset_exists():
    p = Path("/app/frontend/public/brand/lens-only.png")
    assert p.exists()
    assert p.stat().st_size > 1000  # sanity: not an empty file
    # Optimised below 200KB so directory grids stay snappy.
    assert p.stat().st_size < 200_000


def test_profile_card_uses_lens_placeholder():
    src = Path("/app/frontend/src/components/ProfileCard.jsx").read_text()
    assert "/brand/lens-only.png" in src


def test_profile_hero_uses_lens_placeholder():
    src = Path("/app/frontend/src/components/profile/ProfileHero.jsx").read_text()
    assert "/brand/lens-only.png" in src
