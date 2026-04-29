"""Casting-call-specific endpoints — currently just the rate-limited view counter."""
from fastapi import APIRouter, HTTPException, Request

from core import current_user, db, record_view, viewer_id_for

router = APIRouter()


@router.post("/api/casting/{casting_call_id}/view")
async def record_casting_view(casting_call_id: str, request: Request):
    call = await db.casting_calls.find_one({"id": casting_call_id}, {"_id": 0})
    if not call:
        raise HTTPException(404, "Casting call not found")
    me = await current_user(request)
    if me and me.get("id") == call.get("creator_user_id"):
        return {"view_count": call.get("view_count", 0), "counted": False}
    viewer = viewer_id_for(request, me)
    counted = await record_view("casting", casting_call_id, viewer)
    if counted:
        await db.casting_calls.update_one({"id": casting_call_id}, {"$inc": {"view_count": 1}})
    fresh = await db.casting_calls.find_one({"id": casting_call_id}, {"_id": 0, "view_count": 1})
    return {"view_count": int(fresh.get("view_count", 0)), "counted": counted}
