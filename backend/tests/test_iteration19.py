"""Iter 19 — admin email composer + audience counts."""
import asyncio
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


def test_audience_counts_returns_all_keys():
    h = {"Authorization": f"Bearer {_admin_token()}"}
    r = requests.get(f"{BASE}/api/admin/audience-counts", headers=h, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    for key in ("all_users", "founders", "verified", "imported_pending"):
        assert key in body, body
        assert isinstance(body[key], int)
    assert body["founders"] >= 1  # at least Brendan


def test_audience_counts_requires_admin():
    r = requests.get(f"{BASE}/api/admin/audience-counts", timeout=10)
    assert r.status_code in (401, 403)


def test_broadcast_email_dry_run_to_founders():
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    r = requests.post(
        f"{BASE}/api/admin/broadcast-email",
        headers=h,
        json={
            "audience": "founders",
            "subject": "Iter19 test",
            "html": "<p>Hello</p>",
            "dry_run": True,
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["audience"] == "founders"
    assert body["dry_run"] is True
    assert body["count"] >= 1
    assert isinstance(body["sample"], list)


def test_broadcast_email_custom_audience_with_dedupe():
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    r = requests.post(
        f"{BASE}/api/admin/broadcast-email",
        headers=h,
        json={
            "audience": "custom",
            "subject": "Iter19 custom",
            "html": "<p>Hi</p>",
            "custom_emails": ["a@b.com", "A@B.com", "c@d.com"],
            "dry_run": True,
        },
        timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2  # de-duplicated case-insensitively


def test_broadcast_email_400_on_empty_audience():
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    r = requests.post(
        f"{BASE}/api/admin/broadcast-email",
        headers=h,
        json={
            "audience": "custom",
            "subject": "Iter19",
            "html": "<p>Hi</p>",
            "custom_emails": [],
            "dry_run": True,
        },
        timeout=10,
    )
    assert r.status_code == 400


def test_broadcast_email_invalid_audience_rejected():
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    r = requests.post(
        f"{BASE}/api/admin/broadcast-email",
        headers=h,
        json={
            "audience": "everyone",  # not in allowed enum
            "subject": "x",
            "html": "<p>x</p>",
        },
        timeout=10,
    )
    assert r.status_code == 422  # pydantic regex validation
