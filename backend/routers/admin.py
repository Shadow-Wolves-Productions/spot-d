"""Admin dashboard endpoints + bulk import."""
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
    ADMIN_EMAIL, EMAIL_LOGO_URL, EMAIL_MOCK, IS_PROD, PUBLIC_APP_URL, SMS_MOCK, UPLOAD_ROOT,
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

def _invalidate_public_stats_cache(*a, **kw):
    return _lazy("routers.public", "_invalidate_public_stats_cache")(*a, **kw)

def recalculate_spot_score(*a, **kw):
    return _lazy("routers.entities", "recalculate_spot_score")(*a, **kw)

# -----------------------------------------------------------------------------


# --------------------------------------------------------------------------- #
@router.post("/api/admin/migrate-all-roles")
async def admin_migrate_all_roles(request: Request):
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    cursor = db.profiles.find({}, {"_id": 0})
    updated = 0
    async for p in cursor:
        roles = compute_all_roles(p)
        await db.profiles.update_one({"id": p["id"]}, {"$set": {"all_roles": roles}})
        updated += 1
    return {"updated": updated}


@router.post("/api/admin/bulk-import")
async def bulk_import(request: Request, background: BackgroundTasks):
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    body = await request.json()
    members = body.get("members") or []
    payment_reference = body.get("payment_reference", "cineconnect-import")
    send_welcome = bool(body.get("send_welcome", False))
    months = int(body.get("months", 12))

    seen_emails: set = set()
    imported = []
    skipped = []
    failed = []

    for m in members:
        email = (m.get("email") or "").strip().lower()
        if not email:
            failed.append({"name": m.get("full_name"), "reason": "missing email"})
            continue
        if email in seen_emails:
            skipped.append({"email": email, "reason": "duplicate in batch"})
            continue
        seen_emails.add(email)
        try:
            existing_user = await db.users.find_one({"email": email})
            if existing_user:
                user_doc = existing_user
                user_created = False
            else:
                user_doc = {
                    "id": new_id(),
                    "email": email,
                    "full_name": m.get("full_name"),
                    "role": "user",
                    "created_date": now_iso(),
                    "updated_date": now_iso(),
                }
                await db.users.insert_one(user_doc.copy())
                user_doc.pop("_id", None)
                user_created = True

            user_id = user_doc["id"]

            # Profile
            profile_doc = await db.profiles.find_one({"user_id": user_id})
            slug = (m.get("profile_slug") or slugify(m.get("full_name") or email)).lower()
            # ensure slug uniqueness if profile would be created
            if not profile_doc:
                base_slug = slug
                i = 2
                while await db.profiles.find_one({"profile_slug": slug}):
                    slug = f"{base_slug}-{i}"
                    i += 1
                profile_doc = {
                    "id": new_id(),
                    "user_id": user_id,
                    "full_name": m.get("full_name"),
                    "preferred_name": m.get("preferred_name"),
                    "pronouns": m.get("pronouns") or None,
                    "email": email,
                    "phone": m.get("phone") or None,
                    "city": m.get("city"),
                    "state": m.get("state"),
                    "country": m.get("country"),
                    "primary_role": m.get("primary_role") or "Other",
                    "secondary_roles": m.get("secondary_roles") or [],
                    "experience_level": m.get("experience_level") or "Entry",
                    "union_status": m.get("union_status") or ["Non-Union"],
                    "imdb_link": m.get("imdb_link") or None,
                    "showreel_link": m.get("showreel_link") or None,
                    "bio": m.get("bio") or "",
                    "profile_slug": slug,
                    "availability_status": m.get("availability_status") or "Available Now",
                    "spot_score": 0,
                    "spot_percentile": 0,
                    "import_source": payment_reference,
                    "import_notes": m.get("import_notes"),
                    "created_date": now_iso(),
                    "updated_date": now_iso(),
                }
                await db.profiles.insert_one(profile_doc.copy())
                profile_doc.pop("_id", None)

            # Subscription
            sub_doc = await db.subscriptions.find_one({"user_id": user_id})
            if not sub_doc:
                expires = (datetime.now(timezone.utc) + timedelta(days=30 * months)).isoformat()
                sub_doc = {
                    "id": new_id(),
                    "user_id": user_id,
                    "tier": "pro",
                    "status": "active",
                    "started_at": now_iso(),
                    "expires_at": expires,
                    "contact_reveal_limit": 20,
                    "casting_call_limit": 5,
                    "can_boost": True,
                    "payment_reference": payment_reference,
                    "created_date": now_iso(),
                    "updated_date": now_iso(),
                }
                await db.subscriptions.insert_one(sub_doc.copy())

            # Recalc score
            await recalculate_spot_score(profile_doc["id"])

            # Welcome email (only if explicitly requested — defaults to false)
            if send_welcome:
                try:
                    background.add_task(_send_welcome_internal, user_id, profile_doc["id"], "pro")
                except Exception:
                    pass

            imported.append({
                "email": email,
                "user_id": user_id,
                "profile_id": profile_doc["id"],
                "profile_slug": profile_doc.get("profile_slug"),
                "user_created": user_created,
            })
        except Exception as e:
            failed.append({"email": email, "reason": str(e)})

    return {
        "imported": len(imported),
        "skipped": len(skipped),
        "failed": len(failed),
        "details": {"imported": imported, "skipped": skipped, "failed": failed},
    }


async def _send_welcome_internal(user_id: str, profile_id: str, tier: str = "pro"):
    """Welcome email for bulk-imported CineConnect members — personal tone
    from Brendan, 7-day founding-spot claim deadline."""
    user = await db.users.find_one({"id": user_id})
    profile = await db.profiles.find_one({"id": profile_id})
    if not user or not profile:
        return

    first = (profile.get("preferred_name") or profile.get("full_name") or "there").split(" ")[0]
    # 7-day founding-spot claim window locked in at send time.
    deadline = datetime.now(timezone.utc) + timedelta(days=7)
    deadline_iso = deadline.isoformat()
    login_url = f"{PUBLIC_APP_URL}/login"

    html = f"""
<div style="background:#0D0D0D;color:#E5E5E5;font-family:'DM Sans','Helvetica Neue',Arial,sans-serif;padding:40px 16px;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;">

    <!-- Wordmark -->
    <div style="margin-bottom:32px;">{email_logo_html(40)}</div>

    <!-- Personal opener -->
    <p style="margin:0 0 18px;font-size:16px;color:#E5E5E5;">Hey {first},</p>
    <p style="margin:0 0 18px;font-size:16px;color:#E5E5E5;">It&rsquo;s Brendan from Shadow Wolves Productions.</p>
    <p style="margin:0 0 18px;font-size:16px;color:#E5E5E5;">You might remember filling in our <strong style="color:#FFFFFF;">CineConnect</strong> form a little while back &mdash; our cast and crew database for upcoming productions. Well, that idea grew into something much bigger.</p>
    <p style="margin:0 0 28px;font-size:18px;color:#FFFFFF;font-weight:600;">CineConnect has evolved into Spot&rsquo;d.</p>

    <hr style="border:none;border-top:1px solid #1F1F1F;margin:32px 0;" />

    <!-- What is Spot'd -->
    <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#E6FF00;font-weight:700;">What is Spot&rsquo;d?</p>
    <p style="margin:0 0 16px;color:#E5E5E5;">Spot&rsquo;d is an indie film directory built specifically for people like you &mdash; cast, crew, and production companies all in one place. Think of it as the indie film industry&rsquo;s own professional network, without the noise.</p>
    <p style="margin:0 0 16px;color:#999;">Here&rsquo;s what it does:</p>

    <div style="margin:20px 0;">
      <p style="margin:0 0 6px;color:#FFFFFF;font-weight:600;">🎬 One profile, three presences</p>
      <p style="margin:0 0 18px;color:#B8B8B8;font-size:15px;">Show up as Talent, Crew, or a Company &mdash; or all three under the one login.</p>

      <p style="margin:0 0 6px;color:#FFFFFF;font-weight:600;">⭐ SpotScore</p>
      <p style="margin:0 0 18px;color:#B8B8B8;font-size:15px;">A credibility rating out of 100, built from verifications, peer Spots, credits and activity. The higher your score, the higher you rank in search. Reputation, quantified.</p>

      <p style="margin:0 0 6px;color:#FFFFFF;font-weight:600;">📋 Casting calls</p>
      <p style="margin:0 0 18px;color:#B8B8B8;font-size:15px;">Producers post real casting calls. Set a Role Alert and get notified the moment something matches &mdash; no more trawling Facebook groups.</p>

      <p style="margin:0 0 6px;color:#FFFFFF;font-weight:600;">🤝 Spot them</p>
      <p style="margin:0 0 18px;color:#B8B8B8;font-size:15px;">Peer endorsements with teeth. You request a Spot from someone you&rsquo;ve worked with; they confirm it, and it goes on your profile. If they won&rsquo;t confirm, it doesn&rsquo;t count.</p>

      <p style="margin:0 0 6px;color:#FFFFFF;font-weight:600;">📞 Direct contact</p>
      <p style="margin:0 0 18px;color:#B8B8B8;font-size:15px;">No internal messaging, no middleman. When a producer wants you, they reveal your contact directly. You get notified. Done.</p>
    </div>

    <hr style="border:none;border-top:1px solid #1F1F1F;margin:32px 0;" />

    <!-- Your profile -->
    <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#E6FF00;font-weight:700;">Your profile is ready</p>
    <p style="margin:0 0 16px;color:#E5E5E5;">Based on your CineConnect form, I&rsquo;ve already built the foundation of your Spot&rsquo;d profile. Your name, role, location and details are in there waiting for you.</p>
    <p style="margin:0 0 12px;color:#E5E5E5;">But it needs you to bring it to life.</p>
    <p style="margin:0 0 8px;color:#999;">When you claim your profile, make sure to:</p>
    <ul style="margin:0 0 20px 18px;padding:0;color:#B8B8B8;">
      <li style="margin:6px 0;">Add a headshot or profile photo</li>
      <li style="margin:6px 0;">Link your IMDb profile (if you have one)</li>
      <li style="margin:6px 0;">Add your showreel or portfolio</li>
      <li style="margin:6px 0;">Fill in any missing credits or skills</li>
      <li style="margin:6px 0;">Verify your email (boosts your SpotScore immediately)</li>
    </ul>

    <hr style="border:none;border-top:1px solid #1F1F1F;margin:32px 0;" />

    <!-- Founding member -->
    <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#FF5C35;font-weight:700;">Founding member &mdash; your spot is waiting</p>
    <p style="margin:0 0 16px;color:#E5E5E5;">Because you were one of the first to put your hand up with CineConnect, you&rsquo;re getting first access to Spot&rsquo;d as a <strong style="color:#FFFFFF;">Founding Member</strong>.</p>
    <p style="margin:0 0 12px;color:#999;">What that means:</p>
    <div style="background:#131313;border:1px solid #2A2A2A;border-radius:12px;padding:20px 24px;margin:16px 0 20px;">
      <p style="margin:0 0 8px;color:#E5E5E5;">⚡ <strong style="color:#FFFFFF;">Lifetime free PRO access</strong> &mdash; on us, forever</p>
      <p style="margin:0 0 8px;color:#E5E5E5;">⚡ No credit card. No catch.</p>
      <p style="margin:0 0 8px;color:#E5E5E5;">⚡ Priority placement in search</p>
      <p style="margin:0 0 8px;color:#E5E5E5;">⚡ Unlimited contact reveals</p>
      <p style="margin:0 0 8px;color:#E5E5E5;">⚡ Full portfolio uploads</p>
      <p style="margin:0;color:#E5E5E5;">⚡ Founding member badge on your profile</p>
    </div>
    <p style="margin:0 0 16px;color:#999;font-size:14px;">After launch, PRO is <strong style="color:#FFFFFF;">$9.99/month</strong> or <strong style="color:#FFFFFF;">$79/year</strong>. As a founding member, your PRO access is free for life.</p>
    <p style="margin:0 0 16px;color:#E5E5E5;">But here&rsquo;s the thing &mdash; there are only <strong style="color:#FFFFFF;">100 founding member spots total</strong>.</p>
    <p style="margin:0 0 28px;color:#FF5C35;font-weight:700;font-size:17px;">You have 7 days to claim yours.</p>
    <p style="margin:0 0 32px;color:#999;font-size:14px;">After that, unclaimed spots go to the public waitlist and your profile reverts to a free account.</p>

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="{login_url}" style="display:inline-block;background:#E6FF00;color:#0D0D0D;text-decoration:none;font-weight:800;padding:18px 40px;border-radius:10px;font-family:'Sora',Arial,sans-serif;font-size:15px;letter-spacing:0.04em;">CLAIM YOUR FOUNDING SPOT &rarr;</a>
    </div>

    <p style="margin:24px 0 8px;color:#999;font-size:14px;text-align:center;">Enter this email address at sign-in and we&rsquo;ll send you a code &mdash; no password needed.</p>
    <p style="margin:0 0 32px;color:#999;font-size:14px;text-align:center;">Your profile will be waiting for you.</p>

    <hr style="border:none;border-top:1px solid #1F1F1F;margin:32px 0;" />

    <p style="margin:0 0 12px;color:#E5E5E5;">Can&rsquo;t wait to see you in the directory.</p>
    <p style="margin:0 0 4px;color:#FFFFFF;font-weight:600;">Brendan Byrne</p>
    <p style="margin:0 0 2px;color:#888;font-size:14px;">Founder &mdash; Spot&rsquo;d</p>
    <p style="margin:0 0 2px;color:#888;font-size:14px;">Shadow Wolves Productions</p>
    <p style="margin:0;color:#888;font-size:14px;"><a href="{PUBLIC_APP_URL}" style="color:#888;text-decoration:none;">getspotd.app</a></p>

    <!-- Footer -->
    <p style="margin:48px 0 8px;color:#555;font-size:11px;line-height:1.6;">You&rsquo;re receiving this because you submitted your details via the CineConnect crew database form run by Shadow Wolves Productions. If you&rsquo;d prefer not to receive emails from Spot&rsquo;d, <a href="{PUBLIC_APP_URL}/unsubscribe?e={user['email']}" style="color:#777;">unsubscribe here</a>.</p>
    <p style="margin:0;color:#555;font-size:11px;">getspotd.app &middot; Shadow Wolves Productions</p>
  </div>
</div>
"""
    delivered = await send_email(
        user["email"],
        "CineConnect just became something bigger 🎬",
        html,
        from_name="Brendan Byrne — Spot'd",
    )
    if delivered:
        await db.profiles.update_one({"id": profile_id}, {"$set": {
            "welcome_email_sent": True,
            "welcome_email_sent_at": now_iso(),
            "founding_claim_deadline": deadline_iso,
        }})
    else:
        await db.profiles.update_one({"id": profile_id}, {"$set": {
            "welcome_email_failed_at": now_iso(),
        }})
    return delivered


# --------------------------------------------------------------------------- #
# Bulk re-send pending welcomes — Admin-only.
# Targets every imported profile (import_source set) that still hasn't had
# its welcome email sent. Resets the 7-day claim deadline to now+7d when it
# fires, so members get the full window from this send.
# --------------------------------------------------------------------------- #
class SendPendingWelcomesBody(BaseModel):
    dry_run: Optional[bool] = False
    limit: Optional[int] = Field(None, ge=1, le=2000)


@router.post("/api/admin/send-pending-welcomes")
async def admin_send_pending_welcomes(
    body: SendPendingWelcomesBody,
    background: BackgroundTasks,
    request: Request,
):
    user = await _require_admin(request)
    query = {
        "import_source": {"$exists": True, "$ne": None},
        "$or": [
            {"welcome_email_sent": {"$ne": True}},
            {"welcome_email_sent": {"$exists": False}},
        ],
        "auto_claim_dismissed": {"$ne": True},
    }
    cursor = db.profiles.find(query, {"_id": 0, "id": 1, "user_id": 1, "email": 1, "full_name": 1})
    if body.limit:
        cursor = cursor.limit(int(body.limit))
    pending = await cursor.to_list(length=body.limit or 2000)

    queued = []
    for p in pending:
        queued.append({
            "profile_id": p["id"],
            "email": p.get("email"),
            "full_name": p.get("full_name"),
        })
        if not body.dry_run:
            background.add_task(_send_welcome_internal, p["user_id"], p["id"], "pro")

    await _log_admin_action(
        user["id"],
        "welcome.bulk_resend",
        "imports",
        {"count": len(queued), "dry_run": bool(body.dry_run)},
    )
    return {
        "ok": True,
        "dry_run": bool(body.dry_run),
        "count": len(queued),
        "queued": queued,
    }


# --------------------------------------------------------------------------- #
# Founding-member claim deadline processor — runs daily.
#   • Day 5 (48h before deadline): reminder email if user still hasn't logged in
#   • After deadline: downgrade founder/pro → free and send expiry email
# Each email only sends once (idempotency flags on the profile).


# ----- Admin dashboard endpoints -----

# --------------------------------------------------------------------------- #
# Admin helpers — used by the 7-tab Admin Dashboard
# --------------------------------------------------------------------------- #
async def _require_admin(request: Request):
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


async def _log_admin_action(actor_id: str, action: str, target: str = "", meta: dict | None = None):
    await db.admin_logs.insert_one({
        "id": new_id(),
        "actor_id": actor_id,
        "action": action,
        "target": target,
        "meta": meta or {},
        "created_date": now_iso(),
    })


@router.get("/api/admin/logs")
async def admin_logs(request: Request, limit: int = 100):
    await _require_admin(request)
    items = await db.admin_logs.find({}, {"_id": 0}).sort("created_date", -1).limit(int(limit)).to_list(length=int(limit))
    return items


@router.get("/api/admin/imports")
async def admin_imports(request: Request):
    """Returns only profiles created via bulk-import (import_source set), with claim status + email."""
    await _require_admin(request)
    profiles = await db.profiles.find(
        {"import_source": {"$exists": True, "$ne": None}},
        {"_id": 0},
    ).sort("created_date", -1).to_list(length=500)
    # Hydrate each item with its user email + user_id for the admin UI.
    user_ids = [p["user_id"] for p in profiles if p.get("user_id")]
    users = await db.users.find(
        {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "email": 1}
    ).to_list(length=500)
    by_id = {u["id"]: u for u in users}
    for p in profiles:
        u = by_id.get(p.get("user_id"))
        if u:
            p.setdefault("email", u.get("email"))
    return {
        "total": len(profiles),
        "claimed": sum(1 for p in profiles if p.get("welcome_email_sent") or p.get("auto_claim_dismissed")),
        "unclaimed": sum(1 for p in profiles if not (p.get("welcome_email_sent") or p.get("auto_claim_dismissed"))),
        "items": profiles,
    }


@router.get("/api/admin/emails")
async def admin_emails(request: Request, limit: int = 100):
    """Recent email log entries (mock or real)."""
    await _require_admin(request)
    items = await db.email_log.find({}, {"_id": 0}).sort("created_date", -1).limit(int(limit)).to_list(length=int(limit))
    return items


@router.get("/api/admin/platform")
async def admin_platform(request: Request):
    await _require_admin(request)
    return {
        "email_mock": EMAIL_MOCK,
        "sms_mock": SMS_MOCK,
        "env": os.environ.get("ENV", "development"),
        "founder_count": await db.subscriptions.count_documents({"tier": "founder", "status": "active"}),
        "user_count": await db.users.count_documents({}),
        "profile_count": await db.profiles.count_documents({}),
        "casting_calls": await db.casting_calls.count_documents({}),
        "applications": await db.casting_applications.count_documents({}),
        "endorsements": await db.spots.count_documents({}),
        "notifications": await db.notifications.count_documents({}),
    }


@router.get("/api/admin/casting-calls")
async def admin_casting_calls(request: Request):
    await _require_admin(request)
    items = await db.casting_calls.find({}, {"_id": 0}).sort("created_date", -1).to_list(length=500)
    # Hydrate creator name for the admin table
    creator_ids = list({c.get("creator_user_id") for c in items if c.get("creator_user_id")})
    creators = await db.users.find({"id": {"$in": creator_ids}}, {"_id": 0, "id": 1, "email": 1, "full_name": 1}).to_list(length=500)
    by_id = {u["id"]: u for u in creators}
    for c in items:
        u = by_id.get(c.get("creator_user_id"))
        if u:
            c["creator_email"] = u.get("email")
            c["creator_name"] = u.get("full_name")
    return items


class AdminProfileFlagBody(BaseModel):
    is_hidden: Optional[bool] = None


@router.post("/api/admin/profile/{profile_id}/flag")
async def admin_profile_flag(profile_id: str, body: AdminProfileFlagBody, request: Request):
    user = await _require_admin(request)
    update = {}
    if body.is_hidden is not None:
        update["is_hidden"] = bool(body.is_hidden)
    if not update:
        raise HTTPException(400, "Nothing to update")
    update["updated_date"] = now_iso()
    res = await db.profiles.update_one({"id": profile_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Profile not found")
    await _log_admin_action(user["id"], "profile.flag", profile_id, update)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# PlatformSettings — admin-editable knobs (founder cap, etc.)
# --------------------------------------------------------------------------- #
class PlatformSettingsBody(BaseModel):
    founder_cap: Optional[int] = Field(None, ge=1, le=10000)


@router.get("/api/admin/platform-settings")
async def admin_get_platform_settings(request: Request):
    await _require_admin(request)
    s = await db.platform_settings.find_one({"id": "global"}, {"_id": 0})
    return s or {"id": "global", "founder_cap": 100}


@router.put("/api/admin/platform-settings")
async def admin_update_platform_settings(body: PlatformSettingsBody, request: Request):
    user = await _require_admin(request)
    update = {k: v for k, v in body.dict(exclude_none=True).items()}
    update["updated_date"] = now_iso()
    await db.platform_settings.update_one(
        {"id": "global"},
        {"$set": update, "$setOnInsert": {"id": "global", "created_date": now_iso()}},
        upsert=True,
    )
    _invalidate_public_stats_cache()
    await _log_admin_action(user["id"], "platform.settings.update", "global", update)
    return {"ok": True, "settings": update}


@router.get("/api/admin/launch-checklist")
async def admin_launch_checklist(request: Request):
    await _require_admin(request)
    profile_count = await db.profiles.count_documents({})
    pending_welcome = await db.profiles.count_documents({"welcome_email_sent": False})
    stripe_keys_set = bool(os.environ.get("STRIPE_PRO_MONTHLY_PRICE_ID")) and bool(os.environ.get("STRIPE_ELITE_MONTHLY_PRICE_ID")) and bool(os.environ.get("STRIPE_WEBHOOK_SECRET"))
    return {
        "items": [
            {"key": "email_live", "label": "Postmark email live", "ok": not EMAIL_MOCK, "value": "MOCK" if EMAIL_MOCK else "LIVE"},
            {"key": "stripe_keys", "label": "Stripe price IDs configured", "ok": stripe_keys_set, "value": "SET" if stripe_keys_set else "MISSING"},
            {"key": "profile_count", "label": "Profile count ≥ 10", "ok": profile_count >= 10, "value": str(profile_count)},
            {"key": "pending_welcome", "label": "No pending welcome emails", "ok": pending_welcome == 0, "value": f"{pending_welcome} pending"},
        ]
    }


# --------------------------------------------------------------------------- #
# Waitlist — captured when founder cap is full
# --------------------------------------------------------------------------- #
class WaitlistBody(BaseModel):
    email: EmailStr
    source: str = "landing"


@router.post("/api/waitlist")
async def waitlist_signup(body: WaitlistBody):
    """Anonymous endpoint — captured when founder cap is full."""
    email = body.email.lower().strip()
    existing = await db.waitlist.find_one({"email": email}, {"_id": 0})
    if existing:
        return {"ok": True, "already_listed": True}
    await db.waitlist.insert_one({
        "id": new_id(),
        "email": email,
        "source": body.source,
        "created_date": now_iso(),
    })
    return {"ok": True, "already_listed": False}


@router.get("/api/admin/waitlist")
async def admin_list_waitlist(request: Request):
    await _require_admin(request)
    items = await db.waitlist.find({}, {"_id": 0}).sort("created_date", -1).to_list(length=1000)
    return {"total": len(items), "items": items}
