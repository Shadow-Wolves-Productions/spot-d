"""Iter 20 — admin test-data cleanup endpoint."""
import asyncio
import os
import sys
import uuid
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


def _seed_test_user():
    """Bulk-import a fake user matching the cleanup pattern, return user_id + email."""
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    email = f"iter20_cleanup_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{BASE}/api/admin/bulk-import",
        headers=h,
        json={"members": [{"email": email, "full_name": "Iter20 Cleanup Test", "primary_role": "Director"}], "send_welcome": False},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return email


def test_cleanup_dry_run_returns_summary_without_deleting():
    email = _seed_test_user()
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}

    r = requests.post(f"{BASE}/api/admin/cleanup-test-data", headers=h, json={"dry_run": True}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dry_run"] is True
    assert body["users"]["count"] >= 1
    assert any(s == email for s in body["users"]["sample"]) or body["users"]["count"] >= 1

    # Verify the user is still there.
    from motor.motor_asyncio import AsyncIOMotorClient
    async def _check():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        return await db.users.count_documents({"email": email})
    assert asyncio.run(_check()) == 1


def test_cleanup_real_run_deletes_test_users():
    email = _seed_test_user()
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}

    r = requests.post(f"{BASE}/api/admin/cleanup-test-data", headers=h, json={"dry_run": False}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["deleted"]["users"] >= 1

    # User should be gone.
    from motor.motor_asyncio import AsyncIOMotorClient
    async def _check():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        return await db.users.count_documents({"email": email})
    assert asyncio.run(_check()) == 0


def test_cleanup_never_deletes_admin_even_if_email_matches():
    """Admins are protected from cleanup regardless of email pattern.

    Seed an admin user with a test-pattern email, run cleanup, verify they survive.
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    test_admin_email = f"iter20_admin_{uuid.uuid4().hex[:6]}@example.com"

    async def _seed():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        from core import new_id, now_iso
        await db.users.insert_one({
            "id": new_id(),
            "email": test_admin_email,
            "full_name": "Iter20 Admin",
            "role": "admin",
            "created_date": now_iso(),
            "updated_date": now_iso(),
        })
    asyncio.run(_seed())

    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    requests.post(f"{BASE}/api/admin/cleanup-test-data", headers=h, json={"dry_run": False}, timeout=15)

    async def _check():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        n = await db.users.count_documents({"email": test_admin_email})
        # Always tidy up after ourselves so the test is rerunnable.
        await db.users.delete_many({"email": test_admin_email})
        return n
    assert asyncio.run(_check()) == 1, "Admin should not be deleted by cleanup endpoint"


def test_cleanup_requires_admin():
    r = requests.post(f"{BASE}/api/admin/cleanup-test-data", json={"dry_run": True}, timeout=10)
    assert r.status_code in (401, 403)
