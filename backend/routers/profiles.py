"""Profile-specific endpoints — currently just the rate-limited view counter."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from core import current_user, db

router = APIRouter()


async def _record_view(target_kind: str, target_id: str, viewer_id: str) -> bool:
    """
    Insert a row into ``view_events`` only if no row for the same triple was
    inserted in the last hour. The collection has a TTL index that auto-purges
    rows after 1h, which means a returning viewer is treated as a new view.
    Returns True iff a fresh row was inserted (i.e. the counter should bump).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    existing = await db.view_events.find_one({
        "kind": target_kind,
        "target_id": target_id,
        "viewer_id": viewer_id,
        "created_at": {"$gte": cutoff},
    })
    if existing:
        return False
    await db.view_events.insert_one({
        "kind": target_kind,
        "target_id": target_id,
        "viewer_id": viewer_id,
        "created_at": datetime.now(timezone.utc),
    })
    return True


def _viewer_id_for(request: Request, user: Optional[dict]) -> str:
    """Stable per-(viewer, target) key. Auth users → user_id; anon → IP."""
    if user and user.get("id"):
        return f"u:{user['id']}"
    fwd = request.headers.get("x-forwarded-for", "")
    ip = (fwd.split(",")[0].strip() if fwd else None) or (request.client.host if request.client else "anon")
    return f"ip:{ip}"


@router.post("/api/profiles/{profile_id}/view")
async def record_profile_view(profile_id: str, request: Request):
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        raise HTTPException(404, "Profile not found")
    me = await current_user(request)
    if me and me.get("id") == profile.get("user_id"):
        return {"view_count": profile.get("view_count", 0), "counted": False}
    viewer = _viewer_id_for(request, me)
    counted = await _record_view("profile", profile_id, viewer)
    if counted:
        await db.profiles.update_one({"id": profile_id}, {"$inc": {"view_count": 1}})
    fresh = await db.profiles.find_one({"id": profile_id}, {"_id": 0, "view_count": 1})
    return {"view_count": int(fresh.get("view_count", 0)), "counted": counted}
