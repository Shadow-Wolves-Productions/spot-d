"""
Homepage Spotlight system.

Display order on the landing page:
  1. Paid Elite spotlight purchases that are still active (carouseled)
  2. Admin-pinned picks
  3. Early access members (random highest-score) as fallback when nothing is pinned
  4. Highest-SpotScore non-founder profile as final fallback

Entity: SpotlightPick
  {
    id, profile_id, kind: "paid" | "admin" | "founder_fallback",
    expires_at: ISO-8601 string | null,
    position: int  (lower = earlier in carousel),
    created_at, created_by
  }
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core import current_user, db, new_id, now_iso, require_user, serialize

router = APIRouter()


class PinBody(BaseModel):
    profile_id: str = Field(..., min_length=1)
    expires_at: Optional[str] = None  # ISO-8601; None = no expiry
    position: Optional[int] = 0
    note: Optional[str] = None


# --------------------------------------------------------------------------- #
# Public — read the currently-active list
# --------------------------------------------------------------------------- #
@router.get("/api/spotlight/active")
async def spotlight_active():
    """
    Returns ordered list of spotlight profiles to render on the homepage.
    Frontend carousels through whatever comes back. Always includes at
    least one entry when any qualifying profile exists in the system.
    """
    now = datetime.now(timezone.utc).isoformat()

    # 1 — paid + admin picks that haven't expired yet
    active_picks = []
    cur = db.spotlight_picks.find(
        {"$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}]},
        {"_id": 0},
    ).sort([("kind", 1), ("position", 1), ("created_at", 1)])
    async for p in cur:
        active_picks.append(p)

    profile_ids = [p["profile_id"] for p in active_picks]
    profile_map = {}
    if profile_ids:
        async for prof in db.profiles.find(
            {"id": {"$in": profile_ids}, "is_hidden": {"$ne": True}, "is_minor_profile": {"$ne": True}},
            {"_id": 0},
        ):
            profile_map[prof["id"]] = prof

    # Preserve pick order, attach profile, drop missing/hidden
    ordered = []
    for pick in active_picks:
        prof = profile_map.get(pick["profile_id"])
        if not prof:
            continue
        ordered.append({**prof, "_spotlight": {"kind": pick.get("kind"), "expires_at": pick.get("expires_at")}})

    # 2 — Fallbacks if nothing is pinned: prefer founders, then global top score
    if not ordered:
        founder_user_ids = set()
        async for s in db.subscriptions.find(
            {"tier": "founder", "status": "active"}, {"_id": 0, "user_id": 1},
        ):
            founder_user_ids.add(s.get("user_id"))
        # Also treat Users with is_founding_member: true (manual flag) as founders.
        async for u in db.users.find({"is_founding_member": True}, {"_id": 0, "id": 1}):
            founder_user_ids.add(u["id"])

        fallback = []
        if founder_user_ids:
            async for prof in db.profiles.find(
                {
                    "user_id": {"$in": list(founder_user_ids)},
                    "is_hidden": {"$ne": True},
                    "is_minor_profile": {"$ne": True},
                },
                {"_id": 0},
            ).sort("spot_score", -1).limit(3):
                fallback.append({**prof, "_spotlight": {"kind": "founder_fallback"}})
        if not fallback:
            async for prof in db.profiles.find(
                {"is_hidden": {"$ne": True}, "is_minor_profile": {"$ne": True}, "spot_score": {"$gte": 30}},
                {"_id": 0},
            ).sort("spot_score", -1).limit(1):
                fallback.append({**prof, "_spotlight": {"kind": "auto"}})
        ordered = fallback

    return {"picks": ordered, "count": len(ordered)}


# --------------------------------------------------------------------------- #
# Admin — pin / unpin
# --------------------------------------------------------------------------- #
async def _require_admin(request: Request) -> dict:
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


@router.post("/api/admin/spotlight-pin")
async def admin_pin_spotlight(body: PinBody, request: Request):
    user = await _require_admin(request)
    profile = await db.profiles.find_one({"id": body.profile_id}, {"_id": 0, "id": 1, "full_name": 1})
    if not profile:
        raise HTTPException(404, "Profile not found")

    pick = {
        "id": new_id(),
        "profile_id": body.profile_id,
        "kind": "admin",
        "expires_at": body.expires_at,
        "position": int(body.position or 0),
        "note": body.note,
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.spotlight_picks.insert_one(pick)
    return serialize(pick)


@router.get("/api/admin/spotlight-pins")
async def admin_list_spotlight_pins(request: Request):
    """List all pins regardless of expiry — for the admin manage screen."""
    await _require_admin(request)
    out = []
    async for p in db.spotlight_picks.find({}, {"_id": 0}).sort("created_at", -1):
        # Hydrate the profile name for the admin UI
        prof = await db.profiles.find_one({"id": p["profile_id"]}, {"_id": 0, "id": 1, "full_name": 1, "profile_slug": 1, "profile_photo": 1})
        out.append({**p, "profile": prof})
    return out


@router.delete("/api/admin/spotlight-pin/{pin_id}")
async def admin_remove_spotlight_pin(pin_id: str, request: Request):
    await _require_admin(request)
    res = await db.spotlight_picks.delete_one({"id": pin_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Pin not found")
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Paid — Elite users buy a spotlight slot
# (Stripe checkout is wired in routers/webhooks.py for live billing — this
# endpoint is the no-cost confirmation that flips the slot on once the
# webhook records the payment. Frontend calls this for sandbox / staff
# grants. Real production flow goes through the webhook.)
# --------------------------------------------------------------------------- #
class BuyBody(BaseModel):
    profile_id: str = Field(..., min_length=1)
    days: int = Field(30, ge=1, le=365)


@router.post("/api/spotlight/grant")
async def grant_paid_spotlight(body: BuyBody, request: Request):
    """
    Internal/staff endpoint: grants a `paid` spotlight slot to a profile for
    the given number of days. Only callable by an admin or by the user who
    owns the profile (i.e. once a real Stripe purchase clears, the webhook
    can call this on the buyer's behalf).
    """
    user = await require_user(request)
    profile = await db.profiles.find_one({"id": body.profile_id}, {"_id": 0, "user_id": 1})
    if not profile:
        raise HTTPException(404, "Profile not found")
    if user.get("role") != "admin" and profile.get("user_id") != user.get("id"):
        raise HTTPException(403, "You can only grant a spotlight to your own profile.")

    expires = (datetime.now(timezone.utc) + (timezone.utc.utcoffset(datetime.now()) or __import__("datetime").timedelta(days=body.days)))
    # Simpler: compute via timedelta directly
    from datetime import timedelta
    expires = (datetime.now(timezone.utc) + timedelta(days=body.days)).isoformat()

    pick = {
        "id": new_id(),
        "profile_id": body.profile_id,
        "kind": "paid",
        "expires_at": expires,
        "position": -100,  # always sort before admin pins
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.spotlight_picks.insert_one(pick)
    return serialize(pick)
