"""Spot'd backend — thin app factory.

All endpoint logic lives in ``routers/`` (auth, entities, profiles, casting,
uploads, webhooks, admin, scheduled, public). Database state, helpers and the
APScheduler instance live in ``core``. Bootstrap (seed data, indexes, role
migration, score backfill) is in ``bootstrap``.

This file does five things only:
  1. Build the FastAPI app
  2. Apply middleware (CORS, force-HTTPS, HSTS in prod)
  3. Mount static uploads
  4. Include every router
  5. Wire up startup + shutdown hooks
"""
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from apscheduler.triggers.cron import CronTrigger

from core import IS_PROD, mongo, scheduler
from bootstrap import (
    backfill_spot_score_history, create_indexes, migrate_all_roles,
    seed_initial_data,
)
from routers import auth as _auth_router
from routers import entities as _entities_router
from routers import profiles as _profiles_router
from routers import casting as _casting_router
from routers import uploads as _uploads_router
from routers import webhooks as _webhooks_router
from routers import admin as _admin_router
from routers import scheduled as _scheduled_router
from routers import public as _public_router

# --------------------------------------------------------------------------- #
# App + middleware
# --------------------------------------------------------------------------- #
app = FastAPI(title="Spot'd API")

_PROD_ORIGINS = [
    "https://getspotd.app",
    "https://www.getspotd.app",
    "https://api.getspotd.app",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_PROD_ORIGINS if IS_PROD else ["*"],
    allow_credentials=IS_PROD,
    allow_methods=["*"],
    allow_headers=["*"],
)

if IS_PROD:
    # NOTE: HSTS is gated on ENV=production (via core.IS_PROD). In dev/preview
    # we never emit Strict-Transport-Security so localhost over HTTP keeps
    # working. Production deployments set ENV=production and the two
    # middlewares below kick in.
    @app.middleware("http")
    async def force_https(request: Request, call_next):
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        if proto == "http":
            url = request.url.replace(scheme="https")
            return JSONResponse(
                status_code=301,
                content={"detail": "HTTPS required"},
                headers={"Location": str(url)},
            )
        return await call_next(request)

    @app.middleware("http")
    async def add_hsts_header(request: Request, call_next):
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

# --------------------------------------------------------------------------- #
# Static uploads
# --------------------------------------------------------------------------- #
app.mount(
    "/api/static",
    StaticFiles(directory=str(Path(__file__).parent / "static")),
    name="static",
)

# --------------------------------------------------------------------------- #
# Mount routers
# --------------------------------------------------------------------------- #
for _r in (
    _auth_router, _entities_router, _profiles_router, _casting_router,
    _uploads_router, _webhooks_router, _admin_router, _scheduled_router,
    _public_router,
):
    app.include_router(_r.router)


# --------------------------------------------------------------------------- #
# Lifecycle
# --------------------------------------------------------------------------- #
@app.on_event("startup")
async def on_startup():
    from routers.scheduled import (
        _process_founding_deadlines, _purge_codes,
        _run_spotted_with, _send_daily_weekly,
        _send_profile_completion_nudges,
    )

    await create_indexes()
    await seed_initial_data()
    await migrate_all_roles()
    await backfill_spot_score_history()

    scheduler.add_job(_run_spotted_with, CronTrigger(hour=2, minute=0))
    scheduler.add_job(_purge_codes, CronTrigger(hour=3, minute=0))
    scheduler.add_job(_process_founding_deadlines, CronTrigger(hour=9, minute=0))
    scheduler.add_job(_send_profile_completion_nudges, CronTrigger(hour=15, minute=0))
    scheduler.add_job(lambda: _send_daily_weekly("daily"), CronTrigger(hour=17, minute=0))
    scheduler.add_job(
        lambda: _send_daily_weekly("weekly"),
        CronTrigger(day_of_week="sun", hour=17, minute=0),
    )
    scheduler.start()


@app.on_event("shutdown")
async def on_shutdown():
    scheduler.shutdown(wait=False)
    mongo.close()
