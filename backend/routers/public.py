"""Public, unauthenticated endpoints — health, public-stats, OG images, etc.

Most of the family (``/api/public-stats``, ``/api/og/casting/{id}.png``,
``/api/og/profile/{slug}.png``, ``/api/waitlist``, ``/api/public-settings``,
``/api/public-verified-companies``) currently lives in ``server.py``. The
``/api/health`` ping is the first one moved here as the canonical example.
"""
from __future__ import annotations

from fastapi import APIRouter

from core import now_iso

router = APIRouter()


@router.get("/api/health")
async def health():
    return {"ok": True, "time": now_iso()}
