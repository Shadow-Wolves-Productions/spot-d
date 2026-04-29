"""Entity CRUD endpoints + spot-score helpers."""
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
    ADMIN_EMAIL, EMAIL_LOGO_URL, EMAIL_MOCK, IS_PROD, UPLOAD_ROOT,
    ENTITIES, PUBLIC_READ,
    coll, compute_all_roles, current_user, db, decode_token, log,
    make_token, new_id, now_iso, parse_value, require_user, scheduler,
    send_email, send_sms, serialize, slugify,
)
from models import ENTITY_MODELS

router = APIRouter()

# Generic entity CRUD
# --------------------------------------------------------------------------- #
async def _on_casting_application_created(application: dict):
    """Side effects for new applications:
       - increment application_count
       - notify casting call creator
       - if applicant is the creator (self-apply): add to credits + SpottedWith
    """
    call_id = application.get("casting_call_id")
    call = await db.casting_calls.find_one({"id": call_id}) if call_id else None
    if not call:
        return
    # Increment count + record applied_at on the application
    await db.casting_calls.update_one({"id": call_id}, {"$inc": {"application_count": 1}})
    # Notify creator (skip if self-applying — no need to alert yourself)
    applicant_uid = application.get("applicant_user_id")
    creator_uid = call.get("creator_user_id")
    is_self_apply = applicant_uid and applicant_uid == creator_uid
    if creator_uid and not is_self_apply:
        await db.notifications.insert_one({
            "id": new_id(),
            "user_id": creator_uid,
            "type": "casting_match",
            "title": f"New application for {call.get('project_title')}",
            "body": f"{application.get('applicant_name', 'Someone')} applied for {application.get('role_applied_for', 'a role')}",
            "link": f"/casting/applications?call={call_id}",
            "action_url": f"/casting/applications?call={call_id}",
            "is_read": False,
            "created_date": now_iso(),
        })

    # Self-apply: add credit to applicant's profile + run SpottedWith matching
    if is_self_apply:
        applicant_profile = await db.profiles.find_one({"user_id": applicant_uid})
        if applicant_profile:
            project_title = call.get("project_title")
            role = application.get("role_applied_for") or "Self"
            year = datetime.now(timezone.utc).year
            credits = applicant_profile.get("credits") or []
            already = any(
                (c.get("project_title") or c.get("title") or "").strip().lower() == (project_title or "").strip().lower()
                for c in credits
            )
            if project_title and not already:
                credits.append({"project_title": project_title, "role_on_project": role, "year": year})
                await db.profiles.update_one(
                    {"id": applicant_profile["id"]},
                    {"$set": {"credits": credits, "updated_date": now_iso()}},
                )
                # Re-run SpottedWith matching to surface the new credit
                try:
                    from routers.scheduled import _run_spotted_with
                    await _run_spotted_with()
                except Exception as e:
                    log.warning("SpottedWith re-run after self-apply failed: %s", e)


def coll(entity: str):
    if entity not in ENTITIES:
        raise HTTPException(404, f"Unknown entity: {entity}")
    return db[ENTITIES[entity]]


def compute_all_roles(profile: dict) -> list:
    """Union of primary_role + secondary_roles, deduped, preserving order."""
    seen = []
    for r in [profile.get("primary_role")] + (profile.get("secondary_roles") or []):
        if r and r not in seen:
            seen.append(r)
    return seen


def parse_value(v: str) -> Any:
    if v is None:
        return None
    if v == "true":
        return True
    if v == "false":
        return False
    if v == "null":
        return None
    try:
        if v.isdigit():
            return int(v)
        return float(v) if "." in v else v
    except (ValueError, AttributeError):
        return v


@router.get("/api/entities/{entity}")
async def list_entity(entity: str, request: Request):
    """List with optional ?filter=<json>&sort=<-field|field>&limit=<n>&skip=<n>"""
    if entity not in ENTITIES:
        raise HTTPException(404, "Unknown entity")
    user = await current_user(request)
    if entity not in PUBLIC_READ and not user:
        raise HTTPException(401, "Unauthorized")

    qp = dict(request.query_params)
    filter_raw = qp.pop("filter", None)
    sort_raw = qp.pop("sort", "-created_date")
    limit = int(qp.pop("limit", "100"))
    skip = int(qp.pop("skip", "0"))

    # Build mongo filter
    mongo_filter: dict = {}
    if filter_raw:
        try:
            mongo_filter = json.loads(filter_raw)
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid filter JSON")
    # Any remaining query params become equality filters
    for k, v in qp.items():
        mongo_filter[k] = parse_value(v)

    # Sort
    sort_list = []
    if sort_raw:
        if sort_raw.startswith("-"):
            sort_list.append((sort_raw[1:], -1))
        else:
            sort_list.append((sort_raw, 1))

    cursor = coll(entity).find(mongo_filter, {"_id": 0}).skip(skip).limit(limit)
    if sort_list:
        cursor = cursor.sort(sort_list)
    items = await cursor.to_list(length=limit)
    # Defense-in-depth: never expose Profile rows that admins have flagged as
    # is_hidden=True from the public Profile listing. Owner can still see their
    # own profile via /entities/Profile/{id}.
    if entity == "Profile":
        items = [p for p in items if not p.get("is_hidden")]
    return items


@router.post("/api/entities/{entity}")
async def create_entity(entity: str, request: Request):
    user = await current_user(request)
    # Only telemetry entities (anonymous tracking) may be created without auth.
    # Everything else — including Profile, CompanyProfile, CastingCall,
    # CastingApplication, SpotRequest, SavedProfile, ContactReveal — requires
    # an authenticated user.
    ANONYMOUS_CREATE_OK = {"VerificationCode", "ProfileView", "SearchAppearance", "PortfolioClick"}
    if not user and entity not in ANONYMOUS_CREATE_OK:
        raise HTTPException(401, "Unauthorized")

    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(400, "Body must be an object")

    # Pydantic typed validation for the 7 core entities. Falls back to free-form
    # for everything else (telemetry, ad-hoc sub-entities). `extra="allow"`
    # means extra fields are kept untouched — only the declared fields are
    # validated/normalised.
    if entity in ENTITY_MODELS:
        Create, _ = ENTITY_MODELS[entity]
        try:
            validated = Create(**payload)
        except ValidationError as ve:
            raise HTTPException(422, ve.errors())
        # Merge: validated/normalised values overwrite the raw payload, but
        # any extra keys the client sent are preserved.
        payload = {**payload, **validated.model_dump(exclude_unset=True)}

    doc = dict(payload)
    doc["id"] = doc.get("id") or new_id()
    doc.setdefault("created_date", now_iso())
    doc["updated_date"] = now_iso()
    if user:
        doc.setdefault("created_by", user["id"])

    # ----- Pre-insert ownership / self-action guards ------------------------ #
    if entity == "CastingApplication":
        # Block duplicate applications by the same user to the same call.
        existing = await db.casting_applications.find_one({
            "casting_call_id": doc.get("casting_call_id"),
            "applicant_user_id": user["id"] if user else doc.get("applicant_user_id"),
        })
        if existing:
            raise HTTPException(409, "You have already applied to this casting call.")
        # Stamp applicant from session if not provided.
        if user and not doc.get("applicant_user_id"):
            doc["applicant_user_id"] = user["id"]
    elif entity == "ContactReveal":
        # Reveal-yourself is meaningless and would skew analytics.
        target_profile = doc.get("profile_id") and await db.profiles.find_one({"id": doc["profile_id"]}, {"_id": 0, "user_id": 1})
        if user and target_profile and target_profile.get("user_id") == user["id"]:
            raise HTTPException(400, "You can't reveal contact info on your own profile.")
    elif entity == "SpotRequest":
        # Endorsing yourself is similarly invalid.
        target_profile = doc.get("target_profile_id") and await db.profiles.find_one({"id": doc["target_profile_id"]}, {"_id": 0, "user_id": 1})
        if user and target_profile and target_profile.get("user_id") == user["id"]:
            raise HTTPException(400, "You can't request a spot from yourself.")

    # Special handling
    if entity == "Profile":
        if not doc.get("user_id") and user:
            doc["user_id"] = user["id"]
        if not doc.get("profile_slug") and doc.get("full_name"):
            base = slugify(doc["full_name"])
            slug = base
            i = 1
            while await db.profiles.find_one({"profile_slug": slug}):
                i += 1
                slug = f"{base}-{i}"
            doc["profile_slug"] = slug
        # initialise score fields
        doc.setdefault("spot_score", 0)
        doc.setdefault("spot_percentile", 0)
        # Multi-role: compute all_roles on every save
        doc["all_roles"] = compute_all_roles(doc)
    elif entity == "Subscription":
        # Sensible defaults from tier
        tier = doc.get("tier", "free")
        defaults = {
            "free":    {"contact_reveal_limit": 5,  "casting_call_limit": 1,  "can_boost": False},
            "pro":     {"contact_reveal_limit": -1, "casting_call_limit": 5,  "can_boost": True},
            "elite":   {"contact_reveal_limit": -1, "casting_call_limit": -1, "can_boost": True},
            "founder": {"contact_reveal_limit": -1, "casting_call_limit": -1, "can_boost": True},
        }
        for k, v in defaults.get(tier, {}).items():
            doc.setdefault(k, v)
        doc.setdefault("status", "active")
        doc.setdefault("started_at", now_iso())
    elif entity == "Spot" or entity == "Endorsement":
        # ensure spot fields populated for legacy callers
        doc.setdefault("created_date", now_iso())

    target = coll(entity)
    # uniqueness: profile_slug
    if entity == "Profile":
        if await db.profiles.find_one({"profile_slug": doc["profile_slug"]}):
            base = doc["profile_slug"]
            i = 2
            while await db.profiles.find_one({"profile_slug": f"{base}-{i}"}):
                i += 1
            doc["profile_slug"] = f"{base}-{i}"
    await target.insert_one(doc.copy())
    doc.pop("_id", None)

    # Auto-link CastingApplication side effects
    if entity == "CastingApplication":
        await _on_casting_application_created(doc)

    # Seed one SpotScoreHistory snapshot for new Profiles so the analytics
    # chart never starts empty.
    if entity == "Profile":
        await db.spot_score_history.insert_one({
            "id": new_id(),
            "profile_id": doc["id"],
            "score": doc.get("spot_score", 0),
            "recorded_at": now_iso(),
            "created_date": now_iso(),
        })

    # Trigger SpotScore recalc if relevant
    await maybe_recalc_score(entity, doc)
    return doc


@router.get("/api/entities/{entity}/{item_id}")
async def get_entity(entity: str, item_id: str, request: Request):
    user = await current_user(request)
    if entity not in PUBLIC_READ and not user:
        raise HTTPException(401, "Unauthorized")
    item = await coll(entity).find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Not found")
    return item


@router.patch("/api/entities/{entity}/{item_id}")
@router.put("/api/entities/{entity}/{item_id}")
async def update_entity(entity: str, item_id: str, request: Request):
    user = await require_user(request)
    payload = await request.json()
    payload.pop("_id", None)
    payload.pop("id", None)

    # Owner-or-admin gate. Only enforced for entities where the resource has a
    # known "owner" field. Admin endpoints flow through dedicated routers, so
    # any /api/entities/{X}/{id} mutation must be by the original owner unless
    # the caller has the admin role.
    OWNER_FIELDS = {
        "Profile":            "user_id",
        "CompanyProfile":     "owner_user_id",
        "CastingCall":        "creator_user_id",
        "CastingApplication": "applicant_user_id",
        "SpotRequest":        "requester_user_id",
        "SavedProfile":       "user_id",
        "ContactReveal":      "revealer_user_id",
        "Subscription":       "user_id",
        "Notification":       "user_id",
        "RoleAlert":          "user_id",
    }
    if user.get("role") != "admin" and entity in OWNER_FIELDS:
        existing = await coll(entity).find_one({"id": item_id}, {"_id": 0})
        if existing is None:
            raise HTTPException(404, "Not found")
        owner_field = OWNER_FIELDS[entity]
        owner = existing.get(owner_field)
        if owner is not None and owner != user["id"]:
            raise HTTPException(403, "You don't have permission to modify this resource.")

    # Pydantic typed validation for entities with an Update model.
    if entity in ENTITY_MODELS:
        _, Update = ENTITY_MODELS[entity]
        if Update is not None:
            try:
                validated = Update(**payload)
            except ValidationError as ve:
                raise HTTPException(422, ve.errors())
            payload = {**payload, **validated.model_dump(exclude_unset=True)}

    payload["updated_date"] = now_iso()
    # Recompute all_roles when role fields change on a Profile
    if entity == "Profile" and ("primary_role" in payload or "secondary_roles" in payload):
        existing = await coll(entity).find_one({"id": item_id}, {"_id": 0}) or {}
        merged = {**existing, **payload}
        payload["all_roles"] = compute_all_roles(merged)
    res = await coll(entity).update_one({"id": item_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    item = await coll(entity).find_one({"id": item_id}, {"_id": 0})
    await maybe_recalc_score(entity, item)
    return item


@router.delete("/api/entities/{entity}/{item_id}")
async def delete_entity(entity: str, item_id: str, request: Request):
    user = await require_user(request)
    item = await coll(entity).find_one({"id": item_id}, {"_id": 0})
    # Owner-or-admin gate (mirror of update_entity above).
    OWNER_FIELDS = {
        "Profile":            "user_id",
        "CompanyProfile":     "owner_user_id",
        "CastingCall":        "creator_user_id",
        "CastingApplication": "applicant_user_id",
        "SpotRequest":        "requester_user_id",
        "SavedProfile":       "user_id",
        "ContactReveal":      "revealer_user_id",
        "Subscription":       "user_id",
        "Notification":       "user_id",
        "RoleAlert":          "user_id",
    }
    if user.get("role") != "admin" and entity in OWNER_FIELDS and item:
        owner = item.get(OWNER_FIELDS[entity])
        if owner is not None and owner != user["id"]:
            raise HTTPException(403, "You don't have permission to delete this resource.")
    await coll(entity).delete_one({"id": item_id})
    if item:
        await maybe_recalc_score(entity, item)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Spot score
# --------------------------------------------------------------------------- #
async def calculate_spot_score(profile: dict) -> int:
    pid = profile["id"]
    user_id = profile.get("user_id")
    score = 0
    # Completeness (25)
    if profile.get("profile_photo"): score += 5
    if profile.get("bio"): score += 5
    if profile.get("primary_role"): score += 3
    if profile.get("city"): score += 2
    if profile.get("imdb_link"): score += 5
    if profile.get("showreel_link"): score += 5
    # Verified (15)
    if profile.get("email_verified"): score += 15  # was 7, +8 redistributed from phone
    # Spots received (25)
    spots = await db.spots.count_documents({"spotted_profile_id": pid})
    if spots >= 10: score += 25
    elif spots >= 6: score += 20
    elif spots >= 3: score += 14
    elif spots >= 1: score += 8
    # Social credibility (25)
    saved_by = await db.saved_profiles.count_documents({"profile_id": pid})
    if saved_by >= 15: score += 17
    elif saved_by >= 5: score += 12
    elif saved_by >= 1: score += 5
    revealed = await db.contact_reveals.count_documents({"profile_id": pid})
    if revealed >= 3: score += 5
    confirmed_sw = await db.spotted_with.count_documents({
        "$and": [{"$or": [{"profile_id_a": pid}, {"profile_id_b": pid}]}, {"confirmed": True}]
    })
    if confirmed_sw >= 1: score += 3
    # Engagement (10)
    if user_id:
        seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        u = await db.users.find_one({"id": user_id})
        if u and u.get("updated_date", "") > seven_days_ago:
            score += 3
        applied = await db.casting_applications.count_documents({"applicant_user_id": user_id})
        if applied: score += 4
        posted = await db.casting_calls.count_documents({"creator_user_id": user_id})
        if posted: score += 3
    return min(score, 100)


async def recalc_percentiles():
    profiles = await db.profiles.find({}, {"id": 1, "spot_score": 1, "_id": 0}).to_list(length=10000)
    if not profiles:
        return
    scores = [p.get("spot_score", 0) for p in profiles]
    n = len(scores)
    for p in profiles:
        below = sum(1 for s in scores if s < p.get("spot_score", 0))
        pct = round(below / n * 100) if n else 0
        await db.profiles.update_one({"id": p["id"]}, {"$set": {"spot_percentile": pct}})


async def recalculate_spot_score(profile_id: str) -> Optional[int]:
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        return None
    score = await calculate_spot_score(profile)
    prev = profile.get("spot_score", 0)
    await db.profiles.update_one({"id": profile_id}, {"$set": {"spot_score": score}})
    await recalc_percentiles()
    # Snapshot — only when the score actually changes (avoids polluting history
    # with no-op recalcs from unrelated entity mutations)
    if score != prev:
        await db.spot_score_history.insert_one({
            "id": new_id(),
            "profile_id": profile_id,
            "score": score,
            "recorded_at": now_iso(),
            "created_date": now_iso(),
        })
    return score


SCORE_TRIGGERS = {
    "Profile": lambda d: d.get("id"),
    "Spot": lambda d: d.get("spotted_profile_id"),
    "Endorsement": lambda d: d.get("spotted_profile_id") or d.get("profile_id"),
    "SavedProfile": lambda d: d.get("profile_id"),
    "ContactReveal": lambda d: d.get("profile_id"),
    "SpottedWith": lambda d: d.get("profile_id_a"),
    "CastingApplication": lambda d: None,  # recalc applicant — see below
    "CastingCall": lambda d: None,
}


async def maybe_recalc_score(entity: str, doc: Optional[dict]):
    if not doc:
        return
    try:
        if entity == "CastingApplication":
            user_id = doc.get("applicant_user_id")
            if user_id:
                p = await db.profiles.find_one({"user_id": user_id}, {"id": 1, "_id": 0})
                if p:
                    await recalculate_spot_score(p["id"])
            return
        if entity == "CastingCall":
            user_id = doc.get("creator_user_id")
            if user_id:
                p = await db.profiles.find_one({"user_id": user_id}, {"id": 1, "_id": 0})
                if p:
                    await recalculate_spot_score(p["id"])
            return
        getter = SCORE_TRIGGERS.get(entity)
        if getter:
            pid = getter(doc)
            if pid:
                await recalculate_spot_score(pid)
    except Exception as e:
        log.exception("score recalc failed: %s", e)


