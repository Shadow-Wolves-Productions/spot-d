"""Public, unauthenticated endpoints — health, public-stats, OG images, etc."""
import asyncio
import json
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from fastapi.responses import JSONResponse, Response as FastAPIResponse
from pydantic import BaseModel, EmailStr, Field, ValidationError

from core import (
    ADMIN_EMAIL, EMAIL_LOGO_URL, EMAIL_MOCK, SMS_MOCK, IS_PROD,
    ENTITIES, PUBLIC_READ,
    coll, current_user, db, log,
    new_id, now_iso, require_user, send_email, serialize, slugify,
)

router = APIRouter()


@router.get("/api/health")
async def health():
    return {"ok": True, "time": now_iso()}


# ----- Analytics + auto-claim + public-settings + public-stats -----

# --------------------------------------------------------------------------- #
# Health + meta — moved to routers/public.py
# --------------------------------------------------------------------------- #
# /api/health → routers/public.py
# /api/profiles/{id}/view  → routers/profiles.py
# /api/casting/{id}/view   → routers/casting.py


@router.get("/api/analytics/summary")
async def analytics_summary(request: Request, days: int = 30):
    """Tier-aware analytics rollup for the current user's primary profile."""
    user = await require_user(request)
    profile = await db.profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(404, "No profile yet")
    sub = await db.subscriptions.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    tier = sub.get("tier", "free")

    pid = profile["id"]
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Always-available counts
    views_count = await db.profile_views.count_documents({"profile_id": pid, "created_date": {"$gte": cutoff}})
    saves_count = await db.saved_profiles.count_documents({"profile_id": pid})
    reveals_count = await db.contact_reveals.count_documents({"profile_id": pid})
    search_count = await db.search_appearances.count_documents({"profile_id": pid, "created_date": {"$gte": cutoff}})

    # Score history (last 90 days)
    score_cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    history_cursor = db.spot_score_history.find(
        {"profile_id": pid, "recorded_at": {"$gte": score_cutoff}},
        {"_id": 0},
    ).sort("recorded_at", 1)
    history = await history_cursor.to_list(length=500)

    payload = {
        "tier": tier,
        "profile": {
            "id": pid,
            "spot_score": profile.get("spot_score", 0),
            "spot_percentile": profile.get("spot_percentile", 0),
        },
        "totals": {
            "views": views_count,
            "saves": saves_count,
            "reveals": reveals_count,
            "search_appearances": search_count,
        },
        "spot_score_history": history,
    }

    # PRO+: who saved
    if tier in ("pro", "elite", "founder"):
        savers = await db.saved_profiles.find({"profile_id": pid}, {"_id": 0}).sort("created_date", -1).to_list(length=50)
        saver_user_ids = list({s["user_id"] for s in savers if s.get("user_id")})
        saver_profiles = await db.profiles.find({"user_id": {"$in": saver_user_ids}}, {"_id": 0}).to_list(length=200)
        by_uid = {p["user_id"]: p for p in saver_profiles}
        payload["who_saved_you"] = [
            {
                "saved_at": s.get("created_date"),
                "profile": {
                    "id": by_uid.get(s["user_id"], {}).get("id"),
                    "full_name": by_uid.get(s["user_id"], {}).get("full_name"),
                    "preferred_name": by_uid.get(s["user_id"], {}).get("preferred_name"),
                    "primary_role": by_uid.get(s["user_id"], {}).get("primary_role"),
                    "profile_slug": by_uid.get(s["user_id"], {}).get("profile_slug"),
                    "profile_photo": by_uid.get(s["user_id"], {}).get("profile_photo"),
                } if by_uid.get(s["user_id"]) else None,
            }
            for s in savers if s.get("user_id")
        ]
    else:
        payload["who_saved_you"] = None  # gated

    # Elite only: who revealed your contact
    if tier in ("elite", "founder"):
        reveals = await db.contact_reveals.find({"profile_id": pid}, {"_id": 0}).sort("created_date", -1).to_list(length=50)
        reveal_user_ids = list({r["revealer_user_id"] for r in reveals if r.get("revealer_user_id")})
        reveal_profiles = await db.profiles.find({"user_id": {"$in": reveal_user_ids}}, {"_id": 0}).to_list(length=200)
        by_uid = {p["user_id"]: p for p in reveal_profiles}
        payload["who_revealed_contact"] = [
            {
                "revealed_at": r.get("created_date"),
                "profile": by_uid.get(r["revealer_user_id"]) and {
                    "id": by_uid[r["revealer_user_id"]].get("id"),
                    "full_name": by_uid[r["revealer_user_id"]].get("full_name"),
                    "primary_role": by_uid[r["revealer_user_id"]].get("primary_role"),
                    "profile_slug": by_uid[r["revealer_user_id"]].get("profile_slug"),
                },
            }
            for r in reveals if r.get("revealer_user_id")
        ]
    elif tier == "pro":
        payload["who_revealed_contact"] = {"count_only": reveals_count}
    else:
        payload["who_revealed_contact"] = None

    return payload


@router.get("/api/auto-claim/check")
async def auto_claim_check(request: Request):
    """Returns auto-claim payload if the current user has a pre-built profile
    (welcome_email_sent=false) that they haven't yet completed."""
    user = await require_user(request)
    profile = await db.profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if not profile:
        return {"eligible": False}
    # Eligibility: profile created via import (welcome_email_sent never sent
    # AND they haven't dismissed the auto-claim banner yet)
    welcome_sent = profile.get("welcome_email_sent", False)
    auto_claim_dismissed = profile.get("auto_claim_dismissed", False)
    if welcome_sent or auto_claim_dismissed:
        return {"eligible": False}

    # Compute top 3 missing items by SpotScore impact
    suggestions = []
    if not profile.get("profile_photo"):
        suggestions.append({"key": "profile_photo", "label": "Add a profile photo", "points": 5})
    if not profile.get("showreel_link"):
        suggestions.append({"key": "showreel_link", "label": "Link your showreel", "points": 5})
    if not profile.get("email_verified"):
        suggestions.append({"key": "email_verified", "label": "Verify your email", "points": 15})
    if not profile.get("bio"):
        suggestions.append({"key": "bio", "label": "Add a short bio", "points": 5})
    if not profile.get("imdb_link"):
        suggestions.append({"key": "imdb_link", "label": "Add your IMDb link", "points": 5})
    suggestions = sorted(suggestions, key=lambda s: -s["points"])[:3]

    # Profile completion %
    fields = ["profile_photo", "bio", "primary_role", "city", "imdb_link",
              "showreel_link", "phone", "email_verified"]
    completed = sum(1 for f in fields if profile.get(f))
    completion_pct = round(100 * completed / len(fields))

    return {
        "eligible": True,
        "profile": {
            "id": profile["id"],
            "preferred_name": profile.get("preferred_name") or profile.get("full_name") or "there",
            "spot_score": profile.get("spot_score", 0),
            "profile_slug": profile.get("profile_slug"),
        },
        "completion_pct": completion_pct,
        "suggestions": suggestions,
    }


@router.post("/api/auto-claim/dismiss")
async def auto_claim_dismiss(request: Request):
    user = await require_user(request)
    profile = await db.profiles.find_one({"user_id": user["id"]})
    if not profile:
        raise HTTPException(404, "No profile")
    await db.profiles.update_one(
        {"id": profile["id"]},
        {"$set": {"auto_claim_dismissed": True, "welcome_email_sent": True, "updated_date": now_iso()}},
    )
    return {"ok": True}


@router.get("/api/public-settings")
async def public_settings():
    cap = await get_founder_cap()
    return {
        "founder_remaining": max(0, cap - await db.subscriptions.count_documents({"tier": "founder", "status": "active"})),
        "founder_cap": cap,
        "email_mock": EMAIL_MOCK,
        "sms_mock": SMS_MOCK,
    }


# In-memory cache for /api/public-stats — refreshes every 5 minutes.
# Means signups update the homepage automatically with at most 5 min lag.
_PUBLIC_STATS_CACHE: dict = {"data": None, "expires": 0.0}


async def get_founder_cap() -> int:
    """Founder cap is editable from the admin Platform tab. Defaults to 100."""
    s = await db.platform_settings.find_one({"id": "global"}, {"_id": 0})
    if s and isinstance(s.get("founder_cap"), int) and s["founder_cap"] > 0:
        return s["founder_cap"]
    return 100


@router.get("/api/public-stats")
async def public_stats():
    """Live counts for the marketing landing page. All public-safe.
    Cached for 5 minutes to spare the database during traffic spikes."""
    import time as _time
    now = _time.time()
    if _PUBLIC_STATS_CACHE["data"] and now < _PUBLIC_STATS_CACHE["expires"]:
        return _PUBLIC_STATS_CACHE["data"]

    profile_filter = {"is_hidden": {"$ne": True}, "is_minor_profile": {"$ne": True}}
    distinct_roles = await db.profiles.distinct("primary_role", profile_filter)
    distinct_roles = [r for r in distinct_roles if r]
    cap = await get_founder_cap()
    founder_count = await db.subscriptions.count_documents({"tier": "founder", "status": "active"})
    payload = {
        "profile_count": await db.profiles.count_documents(profile_filter),
        "role_count": len(distinct_roles),
        "casting_call_count": await db.casting_calls.count_documents({"is_active": True}),
        "founder_count": founder_count,
        "founder_remaining": max(0, cap - founder_count),
        "founder_cap": cap,
    }
    _PUBLIC_STATS_CACHE["data"] = payload
    _PUBLIC_STATS_CACHE["expires"] = now + 300  # 5 minutes
    return payload


def _invalidate_public_stats_cache():
    """Call after any operation that meaningfully changes public counts
    (founder claim, profile create, casting call create) so urgency banners
    refresh without waiting for the 5-minute window."""
    _PUBLIC_STATS_CACHE["data"] = None
    _PUBLIC_STATS_CACHE["expires"] = 0.0



# ----- OG images + verified companies + waitlist -----

# --------------------------------------------------------------------------- #
# OG image endpoints — Pillow-rendered share cards (1200x630 standard)
# --------------------------------------------------------------------------- #
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from fastapi.responses import Response as _Response

_OG_CACHE: dict = {}  # {key: (expires_ts, bytes)}


def _get_font(size: int, bold: bool = False):
    """Try to load a system font with reasonable defaults; fall back to PIL default."""
    candidates = [
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans-{'Bold' if bold else 'Bold'}.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _draw_pill(draw: ImageDraw.ImageDraw, xy, text, *, bg, fg, font, padding=(18, 10), radius=999):
    x, y = xy
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    rect = (x, y, x + tw + padding[0] * 2, y + th + padding[1] * 2)
    draw.rounded_rectangle(rect, radius=radius, fill=bg)
    draw.text((x + padding[0], y + padding[1] - bbox[1]), text, fill=fg, font=font)
    return rect


def _wrap(text: str, max_chars: int):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= max_chars:
            cur = (cur + " " + w).strip()
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _render_casting_og(call: dict) -> bytes:
    """Render a 1200×630 OG image for a CastingCall."""
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), "#0D0D0D")
    draw = ImageDraw.Draw(img, "RGBA")

    # Subtle yellow glow — radial-ish via concentric ellipses
    for i, alpha in enumerate([8, 14, 20, 28, 38]):
        r = 380 - i * 45
        draw.ellipse((360 - r, 280 - r, 360 + r, 280 + r), fill=(230, 255, 0, alpha))

    # Wordmark
    f_brand = _get_font(56, bold=True)
    draw.text((60, 56), "Spot", fill="#FFFFFF", font=f_brand)
    draw.text((60 + draw.textlength("Spot", font=f_brand), 56), "'d", fill="#E6FF00", font=f_brand)

    # NOW CASTING chip
    f_chip = _get_font(20, bold=True)
    _draw_pill(draw, (W - 60 - 240, 70), "NOW CASTING", bg="#FF5C35", fg="#FFFFFF", font=f_chip, padding=(22, 12))

    # Project type label
    f_label = _get_font(22)
    project_type = (call.get("project_type") or "PROJECT").upper()
    draw.text((60, 175), project_type, fill="#999999", font=f_label)

    # Title — wrap to 2 lines max
    title = (call.get("project_title") or "Casting call")[:120]
    f_title = _get_font(72, bold=True)
    lines = _wrap(title, 26)[:2]
    if len(_wrap(title, 26)) > 2:
        lines[1] = lines[1].rstrip(",.;:") + "…"
    y = 215
    for line in lines:
        draw.text((60, y), line, fill="#FFFFFF", font=f_title)
        y += 84

    # Roles row
    roles = (call.get("roles_needed") or [])[:4]
    f_pill = _get_font(22)
    rx = 60
    ry = max(y + 24, 410)
    for r in roles:
        rect = _draw_pill(draw, (rx, ry), r, bg="#2A2A2A", fg="#FFFFFF", font=f_pill, padding=(20, 10))
        rx = rect[2] + 12

    # Bottom strip — location + comp
    f_meta = _get_font(22)
    parts = []
    if call.get("location"):
        parts.append("· " + call["location"])
    comp = call.get("compensation") or call.get("budget_range")
    if comp:
        parts.append("· " + str(comp))
    if parts:
        draw.text((60, H - 130), "  ".join(parts), fill="#999999", font=f_meta)

    # CTA
    f_cta = _get_font(28, bold=True)
    draw.text((60, H - 70), "Apply at getspotd.app", fill="#E6FF00", font=f_cta)
    return _png_bytes(img)


def _render_profile_og(profile: dict) -> bytes:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), "#0D0D0D")
    draw = ImageDraw.Draw(img, "RGBA")
    # Right-side electric warmth
    for i, alpha in enumerate([8, 14, 22, 32]):
        r = 380 - i * 60
        draw.ellipse((900 - r, 320 - r, 900 + r, 320 + r), fill=(230, 255, 0, alpha))

    # Left half — photo placeholder (apostrophe)
    photo_box = (40, 40, 540, H - 40)
    draw.rounded_rectangle(photo_box, radius=24, fill="#1A1A1A")
    f_apos = _get_font(420, bold=True)
    apos_w = draw.textlength("'", font=f_apos)
    draw.text(((photo_box[0] + photo_box[2]) / 2 - apos_w / 2, photo_box[1] + 50), "'", fill=(230, 255, 0, 77), font=f_apos)

    # Right half — text
    f_label = _get_font(22)
    draw.text((600, 90), "SPOT'D · INDIE FILM DIRECTORY", fill="#999999", font=f_label)

    name = (profile.get("preferred_name") or profile.get("full_name") or "Profile")[:30]
    f_name = _get_font(72, bold=True)
    draw.text((600, 140), name, fill="#FFFFFF", font=f_name)

    role = profile.get("primary_role") or "Profile"
    f_role = _get_font(36)
    draw.text((600, 240), role, fill="#E6FF00", font=f_role)

    # Location
    place_parts = [p for p in [profile.get("city"), profile.get("state"), profile.get("country")] if p]
    if place_parts:
        f_loc = _get_font(26)
        draw.text((600, 305), ", ".join(place_parts), fill="#BBBBBB", font=f_loc)

    # SpotScore badge
    score = int(profile.get("spot_score") or 0)
    f_score_n = _get_font(96, bold=True)
    draw.text((600, 390), str(score), fill="#E6FF00", font=f_score_n)
    f_score_l = _get_font(20)
    draw.text((600, 506), "SPOTSCORE · /100", fill="#999999", font=f_score_l)

    # Footer CTA
    f_cta = _get_font(24, bold=True)
    draw.text((600, H - 70), "Find cast & crew at getspotd.app", fill="#E6FF00", font=f_cta)
    return _png_bytes(img)


def _png_bytes(img: "Image.Image") -> bytes:
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _og_cache_get(key: str):
    import time as _time
    item = _OG_CACHE.get(key)
    if item and _time.time() < item[0]:
        return item[1]
    return None


def _og_cache_set(key: str, data: bytes, ttl: int = 3600):
    import time as _time
    _OG_CACHE[key] = (_time.time() + ttl, data)


@router.get("/api/public-verified-companies")
async def public_verified_companies(limit: int = 8):
    """Companies that should appear in the landing 'Trusted by' row.
    Anonymous endpoint, only returns minimal display fields."""
    items = await db.company_profiles.find(
        {"is_verified": True},
        {"_id": 0, "id": 1, "company_name": 1, "company_slug": 1, "logo": 1, "company_type": 1},
    ).limit(int(limit)).to_list(length=int(limit))
    return items


@router.get("/api/og/casting/{casting_call_id}.png")
async def og_casting(casting_call_id: str):
    call = await db.casting_calls.find_one({"id": casting_call_id}, {"_id": 0})
    if not call:
        raise HTTPException(404, "Casting call not found")
    cache_key = f"casting:{casting_call_id}:{call.get('updated_date', call.get('created_date',''))}"
    data = _og_cache_get(cache_key)
    if data is None:
        data = _render_casting_og(call)
        _og_cache_set(cache_key, data)
    return _Response(content=data, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/api/og/profile/{slug}.png")
async def og_profile(slug: str):
    profile = await db.profiles.find_one({"profile_slug": slug}, {"_id": 0})
    if not profile:
        profile = await db.profiles.find_one({"id": slug}, {"_id": 0})
    if not profile:
        raise HTTPException(404, "Profile not found")
    cache_key = f"profile:{profile['id']}:{profile.get('updated_date', profile.get('created_date',''))}"
    data = _og_cache_get(cache_key)
    if data is None:
        data = _render_profile_og(profile)
        _og_cache_set(cache_key, data)
    return _Response(content=data, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


