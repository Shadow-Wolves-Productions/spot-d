"""Server-side scheduled jobs exposed as POST /api/functions/* endpoints."""
import asyncio
import json
import os
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from fastapi.responses import JSONResponse, Response as FastAPIResponse
from pydantic import BaseModel, EmailStr, Field, ValidationError

from core import (
    ADMIN_EMAIL, EMAIL_LOGO_URL, EMAIL_MOCK, IS_PROD, PUBLIC_APP_URL, UPLOAD_ROOT,
    ENTITIES, PUBLIC_READ,
    coll, compute_all_roles, current_user, db, decode_token, email_logo_html,
    log, make_token, new_id, now_iso, parse_value, require_user, scheduler,
    send_email, send_sms, serialize, slugify,
)
from models import ENTITY_MODELS

router = APIRouter()


# --- Cross-router helpers (lazy import to avoid circulars) -------------------
def _lazy(module_name, attr):
    import importlib
    return getattr(importlib.import_module(module_name), attr)

def get_founder_cap(*a, **kw):
    return _lazy("routers.public", "get_founder_cap")(*a, **kw)

def _invalidate_public_stats_cache(*a, **kw):
    return _lazy("routers.public", "_invalidate_public_stats_cache")(*a, **kw)

def _require_admin(*a, **kw):
    return _lazy("routers.admin", "_require_admin")(*a, **kw)

def _send_welcome_internal(*a, **kw):
    return _lazy("routers.admin", "_send_welcome_internal")(*a, **kw)

def recalculate_spot_score(*a, **kw):
    return _lazy("routers.entities", "recalculate_spot_score")(*a, **kw)

# -----------------------------------------------------------------------------


# --------------------------------------------------------------------------- #
# Functions endpoints — POST /api/functions/{name}
# --------------------------------------------------------------------------- #
@router.post("/api/functions/recalculateSpotScore")
async def fn_recalc(request: Request):
    user = await require_user(request)
    body = await request.json()
    pid = body.get("profile_id")
    if not pid:
        if user.get("role") != "admin":
            raise HTTPException(403, "Forbidden")
        profiles = await db.profiles.find({}, {"id": 1, "_id": 0}).to_list(length=10000)
        for p in profiles:
            await recalculate_spot_score(p["id"])
        return {"success": True, "recalculated": len(profiles)}
    score = await recalculate_spot_score(pid)
    return {"success": True, "spot_score": score}


@router.post("/api/functions/triggerSpotScore")
async def fn_trigger(request: Request):
    body = await request.json()
    pid = body.get("profile_id")
    if pid:
        score = await recalculate_spot_score(pid)
        return {"success": True, "spot_score": score}
    return {"success": True}


@router.post("/api/functions/sendVerificationCode")
async def fn_send_verification(request: Request):
    user = await require_user(request)
    body = await request.json()
    code_type = body.get("type")
    # SMS verification permanently retired — Twilio cost not justified.
    # Email is the single source of identity verification on Spot'd.
    if code_type != "email":
        raise HTTPException(400, "Only email verification is supported")

    ten_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    recent = await db.verification_codes.count_documents({
        "user_id": user["id"], "type": code_type, "created_date": {"$gt": ten_min_ago},
    })
    if recent >= 3:
        raise HTTPException(429, "Too many verification attempts. Please wait 10 minutes.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    # Invalidate prior unused codes
    await db.verification_codes.update_many(
        {"user_id": user["id"], "type": code_type, "used": False},
        {"$set": {"used": True}},
    )
    await db.verification_codes.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "code": code,
        "type": code_type,
        "expires_at": expires,
        "used": False,
        "attempts": 0,
        "created_date": now_iso(),
    })
    if code_type == "email":
        html = f"<p>Your Spot'd verification code is:</p><h2 style='letter-spacing:6px;font-size:32px;'>{code}</h2><p>Valid 10 minutes.</p>"
        await send_email(user["email"], "Spot'd — Your Verification Code", html)
    out = {"success": True}
    if EMAIL_MOCK and code_type == "email":
        out["dev_code"] = code
    return out


@router.post("/api/functions/verifyCode")
async def fn_verify_code(request: Request):
    user = await require_user(request)
    body = await request.json()
    code_type = body.get("type")
    code = body.get("code")
    rec = await db.verification_codes.find_one(
        {"user_id": user["id"], "type": code_type, "used": False},
        sort=[("created_date", -1)],
    )
    if not rec or datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Invalid or expired code")
    attempts = rec.get("attempts", 0) + 1
    if attempts >= 5 and rec["code"] != code:
        await db.verification_codes.update_one({"id": rec["id"]}, {"$set": {"used": True, "attempts": attempts}})
        raise HTTPException(400, "Too many incorrect attempts. Please request a new code.")
    if rec["code"] != code:
        await db.verification_codes.update_one({"id": rec["id"]}, {"$set": {"attempts": attempts}})
        raise HTTPException(400, "Invalid code")
    await db.verification_codes.update_one({"id": rec["id"]}, {"$set": {"used": True, "attempts": attempts}})

    profile = await db.profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if profile:
        await db.profiles.update_one({"id": profile["id"]}, {"$set": {"email_verified": True}})
        await recalculate_spot_score(profile["id"])
    # Also stamp User.email_verified — auth.me() reads from there.
    await db.users.update_one({"id": user["id"]}, {"$set": {"email_verified": True}})
    return {"success": True}


@router.post("/api/functions/sendWelcomeEmail")
async def fn_send_welcome(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    profile_id = body.get("profile_id")
    tier = (body.get("tier") or "pro").lower()
    user = await db.users.find_one({"id": user_id})
    profile = await db.profiles.find_one({"id": profile_id})
    if not user or not profile:
        raise HTTPException(404, "User or profile not found")
    await _send_welcome_internal(user_id, profile_id, tier)
    return {"success": True, "sent_to": user["email"]}


@router.post("/api/functions/respondToSpotRequest")
async def fn_respond_spot(request: Request):
    user = await require_user(request)
    body = await request.json()
    request_id = body.get("request_id")
    action = body.get("action")
    # Accept both shorthand ('accept'/'decline') and long form ('accepted'/'declined').
    if action == "accept":
        action = "accepted"
    elif action == "decline":
        action = "declined"
    if action not in ("accepted", "declined") or not request_id:
        raise HTTPException(400, "Invalid params")
    rec = await db.spot_requests.find_one({"id": request_id})
    if not rec:
        raise HTTPException(404, "Not found")
    if rec.get("target_user_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if rec.get("status") != "pending":
        raise HTTPException(400, "Already responded")
    await db.spot_requests.update_one(
        {"id": request_id},
        {"$set": {"status": action, "responded_at": now_iso(), "updated_date": now_iso()}},
    )
    requester_profile = await db.profiles.find_one({"id": rec["requester_profile_id"]})
    requester_user_id = requester_profile.get("user_id") if requester_profile else None

    if action == "accepted":
        spot_doc = {
            "id": new_id(),
            "spotter_user_id": user["id"],
            "spotter_profile_id": (await db.profiles.find_one({"user_id": user["id"]}, {"id": 1}) or {}).get("id"),
            "spotted_profile_id": rec["requester_profile_id"],
            "spotted_user_id": requester_user_id,
            "spot_type": rec.get("spot_type"),
            "created_date": now_iso(),
        }
        await db.spots.insert_one(spot_doc.copy())
        if requester_user_id:
            await db.notifications.insert_one({
                "id": new_id(),
                "user_id": requester_user_id,
                "type": "spot_accepted",
                "title": f"{user.get('full_name', 'Someone')} spotted you!",
                "body": f"as \"{rec.get('spot_type')}\" — your SpotScore has been updated",
                "action_url": f"/u/{requester_profile.get('profile_slug', '')}",
                "link": f"/u/{requester_profile.get('profile_slug', '')}",
                "is_read": False,
                "created_date": now_iso(),
            })
        await recalculate_spot_score(rec["requester_profile_id"])
    else:
        if requester_user_id:
            await db.notifications.insert_one({
                "id": new_id(),
                "user_id": requester_user_id,
                "type": "spot_declined",
                "title": "Spot request update",
                "body": f"{user.get('full_name', 'Someone')} isn't able to Spot you right now",
                "is_read": False,
                "created_date": now_iso(),
            })
    return {"success": True}


@router.post("/api/functions/sendRoleAlertNotifications")
async def fn_role_alert_notifications(request: Request):
    body = await request.json()
    casting_call_id = body.get("casting_call_id")
    call = await db.casting_calls.find_one({"id": casting_call_id})
    if not call or not call.get("is_active", True):
        return {"success": True, "matched": 0}
    deadline = call.get("deadline")
    if deadline and deadline < now_iso():
        return {"success": True, "matched": 0}
    alerts = await db.role_alerts.find({"is_active": True}).to_list(length=1000)
    title = (call.get("project_title") or "").lower()
    desc = (call.get("description") or "").lower()
    location = (call.get("location") or "").lower()
    needed = [r.lower() for r in (call.get("roles_needed") or [])]
    matched = 0
    for a in alerts:
        roles = a.get("roles") or []
        if roles and not any(r.lower() in needed or r.lower() in desc for r in roles):
            continue
        keywords = a.get("keywords") or []
        if keywords and not any(k.lower() in title or k.lower() in desc for k in keywords):
            continue
        locs = a.get("locations") or []
        if locs and not any(l.lower() in location for l in locs):
            continue
        # de-dup
        existing = await db.notifications.find_one({
            "user_id": a["user_id"],
            "type": "role_alert",
            "meta.casting_call_id": casting_call_id,
        })
        if existing:
            continue
        await db.notifications.insert_one({
            "id": new_id(),
            "user_id": a["user_id"],
            "type": "role_alert",
            "title": f"New casting call: {call.get('project_title')}",
            "body": call.get("description", "")[:160],
            "action_url": f"/casting?call={casting_call_id}",
            "link": f"/casting?call={casting_call_id}",
            "is_read": False,
            "meta": {"casting_call_id": casting_call_id},
            "created_date": now_iso(),
        })
        matched += 1
        if a.get("frequency") == "instant" and a.get("email_notifications", True):
            user = await db.users.find_one({"id": a["user_id"]})
            if user:
                html = f"<p>New casting call: <strong>{call.get('project_title')}</strong></p><p>{call.get('description','')[:300]}</p><p><a href='{PUBLIC_APP_URL}/casting'>View on Spot'd</a></p>"
                await send_email(user["email"], f"New role alert — {call.get('project_title')}", html)
    return {"success": True, "matched": matched}


@router.post("/api/functions/runSpottedWithMatching")
async def fn_run_spotted_with(request: Request):
    return await _run_spotted_with()


async def _run_spotted_with():
    profiles = await db.profiles.find({"credits": {"$exists": True, "$ne": []}}, {"_id": 0}).to_list(length=5000)
    new_records = 0
    for i, a in enumerate(profiles):
        a_titles = {(c.get("project_title") or "").strip().lower() for c in (a.get("credits") or []) if c.get("project_title")}
        for b in profiles[i + 1:]:
            b_titles = {(c.get("project_title") or "").strip().lower() for c in (b.get("credits") or []) if c.get("project_title")}
            common = a_titles & b_titles
            if not common:
                continue
            id_a, id_b = sorted([a["id"], b["id"]])
            existing = await db.spotted_with.find_one({"profile_id_a": id_a, "profile_id_b": id_b})
            primary = sorted(common)[0]
            if existing:
                await db.spotted_with.update_one(
                    {"id": existing["id"]},
                    {"$set": {"projects_matched": list(common), "updated_date": now_iso()}},
                )
            else:
                await db.spotted_with.insert_one({
                    "id": new_id(),
                    "profile_id_a": id_a,
                    "profile_id_b": id_b,
                    "project_title": primary,
                    "projects_matched": list(common),
                    "match_confidence": "exact",
                    "confirmed": False,
                    "times_matched": len(common),
                    "created_date": now_iso(),
                })
                new_records += 1
    return {"success": True, "new_matches": new_records}


@router.post("/api/functions/purgeVerificationCodes")
async def fn_purge_codes(request: Request):
    return await _purge_codes()


async def _purge_codes():
    now = now_iso()
    res = await db.verification_codes.delete_many({"$or": [{"used": True}, {"expires_at": {"$lt": now}}]})
    res2 = await db.login_codes.delete_many({"$or": [{"used": True}, {"expires_at": {"$lt": now}}]})
    return {"success": True, "deleted": res.deleted_count + res2.deleted_count}


@router.post("/api/functions/onCastingApplicationChange")
async def fn_casting_app_change(request: Request):
    body = await request.json()
    event = body.get("event", {})
    data = body.get("data", {})
    old = body.get("old_data", {})
    if event.get("type") == "create":
        call = await db.casting_calls.find_one({"id": data.get("casting_call_id")})
        if call:
            await db.notifications.insert_one({
                "id": new_id(),
                "user_id": call["creator_user_id"],
                "type": "casting_match",
                "title": f"New application for {call.get('project_title')}",
                "body": f"{data.get('applicant_name', 'Someone')} applied for {data.get('role_applied_for', 'a role')}",
                "link": f"/casting/applications?call={call['id']}",
                "action_url": f"/casting/applications?call={call['id']}",
                "is_read": False,
                "created_date": now_iso(),
            })
            await db.casting_calls.update_one(
                {"id": call["id"]},
                {"$inc": {"application_count": 1}},
            )
    elif event.get("type") == "update" and old and data.get("status") != old.get("status"):
        field = {
            "viewed": "viewed_at", "shortlisted": "shortlisted_at",
            "rejected": "rejected_at", "booked": "booked_at",
        }.get(data.get("status"))
        if field:
            await db.casting_applications.update_one(
                {"id": data["id"]}, {"$set": {field: now_iso()}}
            )
    return {"ok": True}


@router.post("/api/functions/sendDailyWeeklyAlerts")
async def fn_daily_weekly():
    return await _send_daily_weekly()


async def _send_daily_weekly(frequency: str = "daily"):
    alerts = await db.role_alerts.find({"is_active": True, "frequency": frequency, "email_notifications": True}).to_list(length=10000)
    sent = 0
    one_day_ago = (datetime.now(timezone.utc) - timedelta(days=1 if frequency == "daily" else 7)).isoformat()
    for a in alerts:
        # All notifications for this alert in the window
        notifications = await db.notifications.find({
            "user_id": a["user_id"], "type": "role_alert",
            "created_date": {"$gt": one_day_ago},
        }).to_list(length=50)
        if not notifications:
            continue
        user = await db.users.find_one({"id": a["user_id"]})
        if not user:
            continue
        items_html = "".join(
            f"<li><strong>{n.get('title','')}</strong> — {n.get('body','')}</li>" for n in notifications
        )
        html = f"<p>Your {frequency} role alert digest:</p><ul>{items_html}</ul><p><a href='{PUBLIC_APP_URL}/casting'>View all on Spot'd</a></p>"
        await send_email(user["email"], f"Spot'd {frequency} digest", html)
        sent += 1
    return {"success": True, "sent": sent}



# ----- Founding deadline sweep -----

# --------------------------------------------------------------------------- #
async def _process_founding_deadlines():
    now = datetime.now(timezone.utc)
    reminder_sent = 0
    expired = 0
    async for profile in db.profiles.find({"founding_claim_deadline": {"$exists": True, "$ne": None}}, {"_id": 0}):
        try:
            deadline = datetime.fromisoformat(profile["founding_claim_deadline"].replace("Z", "+00:00"))
        except Exception:
            continue
        user = await db.users.find_one({"id": profile.get("user_id")})
        if not user or not user.get("email"):
            continue
        first = (profile.get("preferred_name") or profile.get("full_name") or "there").split(" ")[0]
        hours_left = (deadline - now).total_seconds() / 3600

        # Still in window — has the user logged in already?
        has_logged_in = bool(user.get("first_login_at"))

        # Day-5 reminder (24h < hours_left ≤ 72h, so roughly "48 hours left")
        if (not has_logged_in
            and 0 < hours_left <= 72
            and not profile.get("claim_reminder_sent")):
            html = f"""
<div style="background:#0D0D0D;color:#E5E5E5;font-family:'DM Sans',Arial,sans-serif;padding:40px 24px;line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="margin-bottom:32px;">{email_logo_html(40)}</div>
    <p style="margin:0 0 18px;color:#E5E5E5;">Hey {first},</p>
    <p style="margin:0 0 18px;color:#E5E5E5;">Just a heads up &mdash; your <strong style="color:#FFFFFF;">founding member spot</strong> on Spot&rsquo;d expires in <strong style="color:#FF5C35;">48 hours</strong>.</p>
    <p style="margin:0 0 18px;color:#E5E5E5;">After that the spot goes to the public waitlist and your <strong style="color:#FFFFFF;">lifetime free PRO access</strong> will be gone forever.</p>
    <p style="margin:0 0 24px;color:#999;">Takes 2 minutes to claim:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="{PUBLIC_APP_URL}/login" style="display:inline-block;background:#E6FF00;color:#0D0D0D;text-decoration:none;font-weight:800;padding:16px 36px;border-radius:10px;font-family:'Sora',Arial,sans-serif;letter-spacing:0.04em;">CLAIM NOW &rarr;</a>
    </div>
    <p style="margin:32px 0 0;color:#888;font-size:14px;">&mdash; Brendan</p>
  </div>
</div>
"""
            try:
                await send_email(
                    user["email"],
                    "48 hours left to claim your Spot'd founding spot",
                    html,
                    from_name="Brendan Byrne — Spot'd",
                )
                await db.profiles.update_one({"id": profile["id"]}, {"$set": {
                    "claim_reminder_sent": True,
                    "claim_reminder_sent_at": now_iso(),
                }})
                reminder_sent += 1
            except Exception as e:
                log.warning("Claim reminder failed for %s: %s", user.get("email"), e)

        # Expired window + no login — downgrade to free and notify once
        elif (not has_logged_in
              and hours_left <= 0
              and not profile.get("claim_expired_handled")):
            # Downgrade subscription to free
            sub = await db.subscriptions.find_one({"user_id": user["id"]})
            if sub and sub.get("tier") in ("pro", "founder"):
                await db.subscriptions.update_one(
                    {"id": sub["id"]},
                    {"$set": {
                        "tier": "free",
                        "status": "active",
                        "contact_reveal_limit": 5,
                        "casting_call_limit": 1,
                        "can_boost": False,
                        "updated_date": now_iso(),
                    }},
                )
            html = f"""
<div style="background:#0D0D0D;color:#E5E5E5;font-family:'DM Sans',Arial,sans-serif;padding:40px 24px;line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="margin-bottom:32px;">{email_logo_html(40)}</div>
    <p style="margin:0 0 18px;color:#E5E5E5;">Hey {first},</p>
    <p style="margin:0 0 18px;color:#E5E5E5;">Your 7-day window to claim your founding member profile has passed. Your account is still active on our <strong style="color:#FFFFFF;">free plan</strong>.</p>
    <p style="margin:0 0 24px;color:#E5E5E5;">You can upgrade to PRO any time at <a href="{PUBLIC_APP_URL}/pricing" style="color:#E6FF00;text-decoration:none;font-weight:600;">getspotd.app/pricing</a>.</p>
    <p style="margin:32px 0 0;color:#888;font-size:14px;">&mdash; Brendan</p>
  </div>
</div>
"""
            try:
                await send_email(
                    user["email"],
                    "Your Spot'd founding spot has expired",
                    html,
                    from_name="Brendan Byrne — Spot'd",
                )
            except Exception as e:
                log.warning("Claim expiry email failed for %s: %s", user.get("email"), e)
            await db.profiles.update_one({"id": profile["id"]}, {"$set": {
                "claim_expired_handled": True,
                "claim_expired_at": now_iso(),
            }})
            expired += 1
    log.info("Founding-deadline sweep: %d reminders, %d expired", reminder_sent, expired)
    return {"reminder_sent": reminder_sent, "expired": expired}


@router.post("/api/functions/processFoundingDeadlines")
async def fn_process_founding_deadlines(request: Request):
    """Admin-trigger for the founding-deadline sweep (also runs nightly)."""
    await _require_admin(request)
    return await _process_founding_deadlines()



async def claim_founder(request: Request):
    user = await require_user(request)
    cap = await get_founder_cap()
    count = await db.subscriptions.count_documents({"tier": "founder", "status": "active"})
    if count >= cap:
        raise HTTPException(400, f"All {cap} founding spots claimed")
    existing = await db.subscriptions.find_one({"user_id": user["id"]})
    sub = {
        "tier": "founder", "status": "active", "started_at": now_iso(),
        "expires_at": None, "contact_reveal_limit": -1, "casting_call_limit": -1,
        "can_boost": True, "updated_date": now_iso(),
    }
    if existing:
        await db.subscriptions.update_one({"id": existing["id"]}, {"$set": sub})
        sub_id = existing["id"]
    else:
        sub.update({"id": new_id(), "user_id": user["id"], "created_date": now_iso()})
        await db.subscriptions.insert_one(sub)
        sub_id = sub["id"]

    # Short confirmation email — 3 lines, functional.
    html = f"""
<div style="background:#0D0D0D;color:#E5E5E5;font-family:'DM Sans',Arial,sans-serif;padding:40px 24px;line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="margin-bottom:32px;">{email_logo_html(40)}</div>
    <p style="margin:0 0 18px;color:#E5E5E5;font-size:17px;">You&rsquo;re in.</p>
    <p style="margin:0 0 18px;color:#E5E5E5;">Your founding member profile is being set up. Sign in at <a href="{PUBLIC_APP_URL}/login" style="color:#E6FF00;text-decoration:none;font-weight:600;">getspotd.app/login</a> to get started.</p>
    <div style="text-align:center;margin:32px 0 24px;">
      <a href="{PUBLIC_APP_URL}/login" style="display:inline-block;background:#E6FF00;color:#0D0D0D;text-decoration:none;font-weight:800;padding:14px 32px;border-radius:10px;font-family:'Sora',Arial,sans-serif;">Sign in &rarr;</a>
    </div>
    <p style="margin:32px 0 0;color:#888;font-size:14px;">&mdash; Brendan</p>
  </div>
</div>
"""
    try:
        await send_email(
            user["email"],
            "Welcome to Spot'd — you're a founding member",
            html,
            from_name="Brendan Byrne — Spot'd",
        )
    except Exception as e:
        log.warning("Founder claim email failed for %s: %s", user.get("email"), e)

    _invalidate_public_stats_cache()
    return {"success": True, "subscription_id": sub_id}


@router.get("/api/stripe/founder-count")
async def founder_count():
    cap = await get_founder_cap()
    count = await db.subscriptions.count_documents({"tier": "founder", "status": "active"})
    return {"count": count, "remaining": max(0, cap - count), "max": cap}




# ----- Profile completion nudges -----

# --------------------------------------------------------------------------- #
# Profile completion nudge email — runs daily, sends single Postmark nudge to
# any user who:
#   • completed first login (welcome_email_sent=True OR auto_claim_dismissed=True)
#   • is more than 48h past that first-login moment
#   • has spot_score < 40
#   • has not received the nudge yet (nudge_email_sent != True)
# --------------------------------------------------------------------------- #
async def _send_profile_completion_nudges():
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    cursor = db.profiles.find(
        {
            "spot_score": {"$lt": 40},
            "nudge_email_sent": {"$ne": True},
            "$or": [
                {"auto_claim_dismissed": True, "updated_date": {"$lt": cutoff}},
                {"welcome_email_sent": True, "updated_date": {"$lt": cutoff}},
            ],
        },
        {"_id": 0},
    )
    sent = 0
    async for p in cursor:
        user = await db.users.find_one({"id": p.get("user_id")})
        if not user or not user.get("email"):
            continue
        # Top 3 missing items by SpotScore impact
        suggestions = []
        if not p.get("profile_photo"):
            suggestions.append(("Add a profile photo", 5))
        if not p.get("email_verified"):
            suggestions.append(("Verify your email", 15))
        if not p.get("imdb_link"):
            suggestions.append(("Link your IMDb profile", 5))
        if not p.get("showreel_link"):
            suggestions.append(("Add your showreel", 5))
        if not p.get("bio"):
            suggestions.append(("Write a short bio", 5))
        suggestions = sorted(suggestions, key=lambda s: -s[1])[:3]
        items_html = "".join(f"<li><strong>{label}</strong> — +{pts} pts</li>" for label, pts in suggestions)
        edit_url = f"{PUBLIC_APP_URL}/create-profile"
        score = p.get("spot_score", 0)
        html = (
            f"<p>Hi {p.get('preferred_name') or p.get('full_name') or 'there'},</p>"
            f"<p>Your Spot'd profile is almost there — current SpotScore: <strong>{score}/100</strong>.</p>"
            f"<p>Three quick wins to climb the directory:</p>"
            f"<ul>{items_html}</ul>"
            f"<p><a href='{edit_url}'>Complete my profile →</a></p>"
        )
        try:
            await send_email(user["email"], "Your Spot'd profile is almost there", html)
            await db.profiles.update_one(
                {"id": p["id"]},
                {"$set": {"nudge_email_sent": True, "nudge_email_at": now_iso()}},
            )
            sent += 1
        except Exception as e:
            log.warning("Nudge email failed for %s: %s", user.get("email"), e)
    log.info("Sent %d completion-nudge emails", sent)
    return {"success": True, "sent": sent}


@router.post("/api/functions/sendProfileCompletionNudges")
async def fn_send_nudges(request: Request):
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return await _send_profile_completion_nudges()


