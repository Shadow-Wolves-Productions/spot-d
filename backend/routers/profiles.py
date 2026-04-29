"""Profile-specific endpoints — currently just the rate-limited view counter."""
from fastapi import APIRouter, HTTPException, Request

from core import current_user, db, record_view, viewer_id_for

router = APIRouter()


@router.post("/api/profiles/{profile_id}/view")
async def record_profile_view(profile_id: str, request: Request):
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        raise HTTPException(404, "Profile not found")
    me = await current_user(request)
    if me and me.get("id") == profile.get("user_id"):
        return {"view_count": profile.get("view_count", 0), "counted": False}
    viewer = viewer_id_for(request, me)
    counted = await record_view("profile", profile_id, viewer)
    if counted:
        await db.profiles.update_one({"id": profile_id}, {"$inc": {"view_count": 1}})
    fresh = await db.profiles.find_one({"id": profile_id}, {"_id": 0, "view_count": 1})
    return {"view_count": int(fresh.get("view_count", 0)), "counted": counted}
