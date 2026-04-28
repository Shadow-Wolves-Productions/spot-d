"""Server-side scheduled jobs exposed as POST functions —
staged in ``server.py`` for now.

The ``/api/functions/{name}`` family (recalculateSpotScore, runSpottedWith,
sendDailyWeeklyAlerts, sendRoleAlertNotifications, processFoundingDeadlines,
…) currently lives in ``server.py`` together with the APScheduler cron
declarations. Move them here once the scheduler instance is wired into
``core``.
"""
from fastapi import APIRouter

router = APIRouter()
