"""Generic entity CRUD endpoints — staged in ``server.py`` for now.

This module is intentionally a placeholder while the rest of the
``/api/entities/{Entity}`` family is being lifted out of ``server.py``. The
endpoints currently live in ``server.py`` (lines ~485-665). Move them here
incrementally — each one just needs the ``@app`` decorator changed to
``@router`` and any ``db`` / ``current_user`` reference re-imported from
``core``.
"""
from fastapi import APIRouter

router = APIRouter()
