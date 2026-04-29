"""Database seeding, index creation, role migration, score backfill."""
import asyncio
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from core import (
    ADMIN_EMAIL, EMAIL_LOGO_URL, EMAIL_MOCK, ENTITIES,
    coll, compute_all_roles, db, log, new_id, now_iso, send_email, slugify,
)

# --------------------------------------------------------------------------- #
async def seed_initial_data():
    if not ADMIN_EMAIL:
        return
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing:
        user = existing
    else:
        user = {
            "id": new_id(),
            "email": ADMIN_EMAIL,
            "full_name": "Brendan Byrne",
            "role": "admin",
            "created_date": now_iso(),
            "updated_date": now_iso(),
        }
        await db.users.insert_one(user.copy())
    user_id = user["id"]
    profile = await db.profiles.find_one({"user_id": user_id})
    if not profile:
        profile_id = new_id()
        await db.profiles.insert_one({
            "id": profile_id,
            "user_id": user_id,
            "full_name": "Brendan Byrne",
            "preferred_name": "Brendan",
            "profile_slug": "brendanbyrneofficial",
            "primary_role": "Producer",
            "city": "Sydney",
            "state": "NSW",
            "country": "Australia",
            "bio": "Founder of Spot'd. Indie filmmaker, producer at Shadow Wolves Productions.",
            "email": ADMIN_EMAIL,
            "email_verified": True,
            "spot_score": 41,
            "spot_percentile": 99,
            "credits": [{"project_title": "Thunk", "role_on_project": "Producer", "year": 2024}],
            "availability_status": "Available Now",
            "created_date": now_iso(),
            "updated_date": now_iso(),
        })
        profile = await db.profiles.find_one({"user_id": user_id})
    sub = await db.subscriptions.find_one({"user_id": user_id})
    if not sub:
        await db.subscriptions.insert_one({
            "id": new_id(),
            "user_id": user_id,
            "tier": "founder",
            "status": "active",
            "started_at": now_iso(),
            "expires_at": None,
            "contact_reveal_limit": -1,
            "casting_call_limit": -1,
            "can_boost": True,
            "created_date": now_iso(),
            "updated_date": now_iso(),
        })
    call = await db.casting_calls.find_one({"project_title": "Thunk"})
    if not call:
        await db.casting_calls.insert_one({
            "id": new_id(),
            "creator_user_id": user_id,
            "creator_profile_id": profile["id"],
            "project_title": "Thunk",
            "project_type": "Short Film",
            "company_name": "Shadow Wolves Productions",
            "description": "Indie short film. Looking for cast and crew across Sydney.",
            "location": "Sydney, NSW",
            "is_active": True,
            "view_count": 0,
            "application_count": 0,
            "deadline": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat(),
            "roles_needed": ["Actor", "Cinematographer"],
            "application_method": "spot_button",
            "created_date": now_iso(),
            "updated_date": now_iso(),
        })

    # Seed/verify the 3 production companies for the "Trusted by" landing row.
    await _seed_verified_companies(user_id)


async def _seed_verified_companies(default_user_id: str):
    """Ensure 3 verified CompanyProfiles exist so the Trusted-by row renders.

    Each company is keyed by `company_slug` so re-running on startup is idempotent.
    Creates the user account if the contact email isn't already on the platform,
    so the company has a real owner. Marks each company `is_verified=True`.
    """
    seeds = [
        {
            "slug": "shadow-wolves-productions",
            "name": "Shadow Wolves Productions",
            "type": "Production Company",
            "email": ADMIN_EMAIL,
            "owner_user_id": default_user_id,
            "city": "Sydney",
            "state": "NSW",
        },
        {
            "slug": "phantom-digital-fx",
            "name": "Phantom Digital FX",
            "type": "VFX Studio",
            "email": "sam.lewis@phantom-fx.com",
            "city": "Melbourne",
            "state": "VIC",
        },
        {
            "slug": "mellow-pictures",
            "name": "Mellow Pictures",
            "type": "Production Company",
            "email": "joshua@mellowpictures.com.au",
            "city": "Brisbane",
            "state": "QLD",
        },
    ]
    for s in seeds:
        existing = await db.company_profiles.find_one({"company_slug": s["slug"]}, {"_id": 0})
        if existing:
            if not existing.get("is_verified"):
                await db.company_profiles.update_one(
                    {"id": existing["id"]},
                    {"$set": {"is_verified": True, "updated_date": now_iso()}},
                )
            continue
        # Resolve or create the user account that owns this company
        owner_id = s.get("owner_user_id")
        if not owner_id:
            u = await db.users.find_one({"email": s["email"].lower()}, {"_id": 0})
            if u:
                owner_id = u["id"]
            else:
                owner_id = new_id()
                await db.users.insert_one({
                    "id": owner_id,
                    "email": s["email"].lower(),
                    "full_name": s["name"],
                    "role": "user",
                    "created_date": now_iso(),
                    "updated_date": now_iso(),
                })
        await db.company_profiles.insert_one({
            "id": new_id(),
            "user_id": owner_id,
            "company_slug": s["slug"],
            "company_name": s["name"],
            "company_type": s["type"],
            "email": s["email"].lower(),
            "city": s["city"],
            "state": s["state"],
            "country": "Australia",
            "is_verified": True,
            "created_date": now_iso(),
            "updated_date": now_iso(),
        })


async def migrate_all_roles():
    """One-time backfill: ensure every Profile has all_roles set."""
    cursor = db.profiles.find({"$or": [{"all_roles": {"$exists": False}}, {"all_roles": {"$size": 0}}]}, {"_id": 0})
    n = 0
    async for p in cursor:
        roles = compute_all_roles(p)
        if roles:
            await db.profiles.update_one({"id": p["id"]}, {"$set": {"all_roles": roles}})
            n += 1
    if n:
        log.info("Migrated all_roles for %d profiles", n)


async def backfill_spot_score_history():
    """One-time backfill: insert one SpotScoreHistory snapshot per profile that
    has zero history rows so the chart on /analytics is never empty."""
    cursor = db.profiles.find({}, {"_id": 0, "id": 1, "spot_score": 1})
    n = 0
    async for p in cursor:
        existing = await db.spot_score_history.count_documents({"profile_id": p["id"]})
        if existing == 0:
            await db.spot_score_history.insert_one({
                "id": new_id(),
                "profile_id": p["id"],
                "score": p.get("spot_score", 0),
                "recorded_at": now_iso(),
                "created_date": now_iso(),
            })
            n += 1
    if n:
        log.info("Backfilled SpotScoreHistory for %d profiles", n)


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.profiles.create_index("id", unique=True)
    await db.profiles.create_index("profile_slug", unique=True, sparse=True)
    await db.profiles.create_index("user_id")
    await db.subscriptions.create_index("user_id")
    await db.notifications.create_index([("user_id", 1), ("created_date", -1)])
    await db.spots.create_index("spotted_profile_id")
    await db.saved_profiles.create_index([("user_id", 1), ("profile_id", 1)])
    await db.casting_calls.create_index("creator_user_id")
    await db.casting_applications.create_index("casting_call_id")
    await db.role_alerts.create_index("user_id")
    await db.spotted_with.create_index([("profile_id_a", 1), ("profile_id_b", 1)])
    await db.verification_codes.create_index("user_id")
    await db.login_codes.create_index("email")
    await db.payment_transactions.create_index("session_id")
    # view_events — TTL index auto-purges entries 1h after creation, which is
    # exactly the rate-limit window for a viewer × target. Compound index
    # speeds the "is there a fresh row already?" lookup.
    await db.view_events.create_index("created_at", expireAfterSeconds=3600)
    await db.view_events.create_index([("kind", 1), ("target_id", 1), ("viewer_id", 1)])


