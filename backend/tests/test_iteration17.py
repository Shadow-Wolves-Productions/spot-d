"""Iter 17 — Casting call edit/end/delete + founding-claim on verify-code."""
import asyncio
import os
import sys
import time
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


def _create_test_user(suffix="iter17"):
    """Create a fresh test user via admin bulk-import (so we can mint a token
    and act as them). Returns (user_id, profile_id, token)."""
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    email = f"iter17_{suffix}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{BASE}/api/admin/bulk-import",
        headers=h,
        json={
            "members": [{
                "email": email,
                "full_name": f"Iter17 {suffix.title()}",
                "primary_role": "Director",
            }],
            "send_welcome": False,
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["imported"] == 1, body
    item = body["details"]["imported"][0]
    return item["user_id"], item["profile_id"], make_token(item["user_id"]), email


# --------------------------------------------------------------------------- #
# is_closed annotation on list endpoint
# --------------------------------------------------------------------------- #
def test_casting_call_list_includes_is_closed_flag():
    user_id, _, token, _ = _create_test_user("listflag")
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Create one open and one closed call
    r1 = requests.post(f"{BASE}/api/entities/CastingCall", headers=h, json={
        "project_title": "Iter17 Open Call", "creator_user_id": user_id, "is_active": True,
    }, timeout=10)
    assert r1.status_code == 200, r1.text
    open_id = r1.json()["id"]

    r2 = requests.post(f"{BASE}/api/entities/CastingCall", headers=h, json={
        "project_title": "Iter17 Closed Call", "creator_user_id": user_id, "is_active": False,
    }, timeout=10)
    assert r2.status_code == 200
    closed_id = r2.json()["id"]

    # List and verify each call has is_closed annotation
    items = requests.get(f"{BASE}/api/entities/CastingCall?limit=100", headers=h, timeout=10).json()
    by_id = {c["id"]: c for c in items}
    assert by_id[open_id]["is_closed"] is False
    assert by_id[closed_id]["is_closed"] is True


# --------------------------------------------------------------------------- #
# Application blocked when call is closed (manual end + past deadline)
# --------------------------------------------------------------------------- #
def test_application_rejected_when_call_manually_ended():
    user_id, _, token, _ = _create_test_user("ended")
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    r = requests.post(f"{BASE}/api/entities/CastingCall", headers=h, json={
        "project_title": "Iter17 Ended Call", "creator_user_id": user_id, "is_active": False,
    }, timeout=10)
    call_id = r.json()["id"]

    applicant_uid, _, applicant_token, _ = _create_test_user("applicant1")
    ah = {"Authorization": f"Bearer {applicant_token}", "Content-Type": "application/json"}
    r2 = requests.post(f"{BASE}/api/entities/CastingApplication", headers=ah, json={
        "casting_call_id": call_id,
        "applicant_user_id": applicant_uid,
    }, timeout=10)
    assert r2.status_code == 409, r2.text
    assert "closed" in r2.json().get("detail", "").lower()


def test_application_rejected_when_deadline_past():
    user_id, _, token, _ = _create_test_user("past")
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    r = requests.post(f"{BASE}/api/entities/CastingCall", headers=h, json={
        "project_title": "Iter17 Past-Deadline Call",
        "creator_user_id": user_id,
        "is_active": True,
        "deadline": "2020-01-01T00:00:00+00:00",
    }, timeout=10)
    call_id = r.json()["id"]

    applicant_uid, _, applicant_token, _ = _create_test_user("applicant2")
    ah = {"Authorization": f"Bearer {applicant_token}", "Content-Type": "application/json"}
    r2 = requests.post(f"{BASE}/api/entities/CastingApplication", headers=ah, json={
        "casting_call_id": call_id,
        "applicant_user_id": applicant_uid,
    }, timeout=10)
    assert r2.status_code == 409, r2.text


# --------------------------------------------------------------------------- #
# Owner can edit + delete; non-owner cannot
# --------------------------------------------------------------------------- #
def test_owner_can_edit_and_delete_casting_call():
    user_id, _, token, _ = _create_test_user("ownereditdel")
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    r = requests.post(f"{BASE}/api/entities/CastingCall", headers=h, json={
        "project_title": "Iter17 Edit Me", "creator_user_id": user_id, "is_active": True,
    }, timeout=10)
    call_id = r.json()["id"]

    # Owner update
    r2 = requests.put(f"{BASE}/api/entities/CastingCall/{call_id}", headers=h, json={
        "project_title": "Iter17 Edited Title",
    }, timeout=10)
    assert r2.status_code == 200, r2.text
    fresh = requests.get(f"{BASE}/api/entities/CastingCall/{call_id}", headers=h, timeout=10).json()
    assert fresh["project_title"] == "Iter17 Edited Title"

    # Non-owner cannot update
    other_uid, _, other_token, _ = _create_test_user("intruder")
    oh = {"Authorization": f"Bearer {other_token}", "Content-Type": "application/json"}
    r3 = requests.put(f"{BASE}/api/entities/CastingCall/{call_id}", headers=oh, json={
        "project_title": "HIJACKED",
    }, timeout=10)
    assert r3.status_code == 403, r3.text

    # Owner delete
    r4 = requests.delete(f"{BASE}/api/entities/CastingCall/{call_id}", headers=h, timeout=10)
    assert r4.status_code == 200, r4.text
    r5 = requests.get(f"{BASE}/api/entities/CastingCall/{call_id}", headers=h, timeout=10)
    assert r5.status_code == 404


# --------------------------------------------------------------------------- #
# Founder count: User.is_founding_member, not subscriptions.tier=founder
# --------------------------------------------------------------------------- #
def test_public_stats_founder_count_uses_is_founding_member():
    r = requests.get(f"{BASE}/api/public-stats", timeout=10)
    assert r.status_code == 200
    body = r.json()
    # Cache may serve a stale value briefly; re-fetch after a 1s delay if 0.
    if body.get("founder_count") == 0:
        time.sleep(1)
        body = requests.get(f"{BASE}/api/public-stats", timeout=10).json()
    # Brendan is the seeded admin founding member.
    assert body["founder_count"] >= 1
    assert body["founder_remaining"] == body["founder_cap"] - body["founder_count"]
