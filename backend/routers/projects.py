"""Project-specific endpoints — view counter, team attachments, inquiries."""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request

from core import (
    current_user, db, new_id, now_iso, record_view, require_user,
    serialize, viewer_id_for,
)

router = APIRouter()


# ── View counter (rate-limited, skips owner) ─────────────────────────────────

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


# ── Inquiry (contact) ─────────────────────────────────────────────────────────

@router.post("/api/projects/{project_id}/inquiry")
async def submit_inquiry(project_id: str, request: Request):
    """Submit an inquiry to a project. Creates a ProjectInquiry doc and
    pushes a Notification to the project owner."""
    me = await require_user(request)
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    if project.get("creator_user_id") == me["id"]:
        raise HTTPException(400, "Cannot inquire about your own project")

    body = await request.json()
    inquiry_type = (body.get("inquiry_type") or "General").strip()
    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(422, "Message is required")

    sender_profile_id = body.get("sender_profile_id")
    sender_name = body.get("sender_name") or me.get("full_name") or "Someone"
    sender_photo = body.get("sender_photo")

    inquiry_id = new_id()
    inquiry = {
        "id": inquiry_id,
        "project_id": project_id,
        "project_title": project.get("title", ""),
        "sender_user_id": me["id"],
        "sender_profile_id": sender_profile_id,
        "sender_name": sender_name,
        "sender_photo": sender_photo,
        "inquiry_type": inquiry_type,
        "message": message,
        "status": "unread",
        "created_date": now_iso(),
    }
    await db.project_inquiries.insert_one(inquiry)

    # Bump inquiry counter on project
    await db.projects.update_one({"id": project_id}, {"$inc": {"inquiry_count": 1}})

    # Notify project owner
    owner_id = project.get("creator_user_id")
    if owner_id and owner_id != me["id"]:
        notif = {
            "id": new_id(),
            "user_id": owner_id,
            "type": "project_inquiry",
            "title": f"New {inquiry_type} inquiry",
            "body": f"{sender_name} sent an inquiry about \u201c{project.get('title', 'your project')}\u201d.",
            "link": f"/projects/{project_id}/manage",
            "is_read": False,
            "created_date": now_iso(),
        }
        await db.notifications.insert_one(notif)

    return {"id": inquiry_id, "status": "sent"}


# ── Team attachment (request to attach self) ──────────────────────────────────

@router.post("/api/projects/{project_id}/attach")
async def request_attachment(project_id: str, request: Request):
    """Request to attach a profile to a project as a team member.
    Creates a pending ProjectAttachment and notifies the owner."""
    me = await require_user(request)
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")

    body = await request.json()
    profile_id = body.get("profile_id")
    company_profile_id = body.get("company_profile_id")
    role_on_project = (body.get("role_on_project") or "").strip()
    note = (body.get("note") or "").strip() or None
    display_name = (body.get("display_name") or me.get("full_name") or "").strip()
    display_photo = body.get("display_photo")

    if not profile_id and not company_profile_id:
        raise HTTPException(422, "profile_id or company_profile_id is required")

    # Prevent duplicate pending/approved attachment
    existing = await db.project_attachments.find_one({
        "project_id": project_id,
        "profile_id": profile_id,
        "status": {"$in": ["pending", "approved"]},
    })
    if existing:
        raise HTTPException(409, "Already attached or pending")

    is_owner = project.get("creator_user_id") == me["id"]

    attachment_id = new_id()
    attachment = {
        "id": attachment_id,
        "project_id": project_id,
        "project_title": project.get("title", ""),
        "profile_id": profile_id,
        "company_profile_id": company_profile_id,
        "role_on_project": role_on_project,
        "note": note,
        "display_name": display_name,
        "display_photo": display_photo,
        "sender_user_id": me["id"],
        # Owners auto-approve themselves
        "status": "approved" if is_owner else "pending",
        "created_date": now_iso(),
        "approved_date": now_iso() if is_owner else None,
    }
    await db.project_attachments.insert_one(attachment)

    # Notify project owner (only when someone else attaches)
    owner_id = project.get("creator_user_id")
    if owner_id and owner_id != me["id"]:
        notif = {
            "id": new_id(),
            "user_id": owner_id,
            "type": "project_attachment",
            "title": "Team attachment request",
            "body": f"{display_name or 'Someone'} wants to attach as {role_on_project or 'team member'} on \u201c{project.get('title', 'your project')}\u201d.",
            "link": f"/projects/{project_id}/manage",
            "is_read": False,
            "created_date": now_iso(),
        }
        await db.notifications.insert_one(notif)

    return serialize(attachment)


@router.patch("/api/projects/{project_id}/attachment/{attachment_id}")
async def update_attachment(project_id: str, attachment_id: str, request: Request):
    """Owner approves or rejects a pending team attachment."""
    me = await require_user(request)
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    if project.get("creator_user_id") != me["id"] and me.get("role") != "admin":
        raise HTTPException(403, "Only the project owner can manage attachments")

    body = await request.json()
    new_status = body.get("status")
    if new_status not in ("approved", "rejected"):
        raise HTTPException(422, "status must be 'approved' or 'rejected'")

    update = {"status": new_status}
    if new_status == "approved":
        update["approved_date"] = now_iso()

    result = await db.project_attachments.update_one(
        {"id": attachment_id, "project_id": project_id},
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Attachment not found")

    # Notify the requester
    attachment = await db.project_attachments.find_one({"id": attachment_id}, {"_id": 0})
    if attachment and attachment.get("sender_user_id"):
        label = "approved" if new_status == "approved" else "declined"
        notif = {
            "id": new_id(),
            "user_id": attachment["sender_user_id"],
            "type": "project_attachment_response",
            "title": f"Attachment {label}",
            "body": f"Your request to join \u201c{project.get('title', 'a project')}\u201d as {attachment.get('role_on_project', 'team member')} was {label}.",
            "link": f"/projects/{project_id}",
            "is_read": False,
            "created_date": now_iso(),
        }
        await db.notifications.insert_one(notif)

    return {"status": new_status}
