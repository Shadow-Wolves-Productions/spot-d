"""Project-specific endpoints — rate-limited view counter."""
from fastapi import APIRouter, HTTPException, Request

from core import current_user, db, record_view, viewer_id_for

router = APIRouter()


@router.post("/api/projects/{project_id}/view")
async def record_project_view(project_id: str, request: Request):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    me = await current_user(request)
    if me and me.get("id") == project.get("creator_user_id"):
        return {"view_count": project.get("view_count", 0), "counted": False}
    viewer = viewer_id_for(request, me)
    counted = await record_view("project", project_id, viewer)
    if counted:
        await db.projects.update_one({"id": project_id}, {"$inc": {"view_count": 1}})
    fresh = await db.projects.find_one({"id": project_id}, {"_id": 0, "view_count": 1})
    return {"view_count": int(fresh.get("view_count", 0)), "counted": counted}
