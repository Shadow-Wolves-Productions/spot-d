"""Admin-only routes — staged in ``server.py`` for now.

The ``/api/admin/*`` family (logs, imports, emails, platform-settings,
launch-checklist, waitlist viewer, …) currently lives in ``server.py``
(lines ~2240-2425). Move them here once the admin authorisation helper
itself is consolidated.
"""
from fastapi import APIRouter

router = APIRouter()
