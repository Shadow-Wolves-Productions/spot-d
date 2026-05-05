"""File upload endpoints — profile photos, headshots, company logos, covers.

Storage: MongoDB GridFS via motor (`AsyncIOMotorGridFSBucket`). This gives us
true persistence across redeploys — the old local-disk approach lost every
uploaded image the moment Emergent rebuilt the container image. The previous
``/api/static/uploads/...`` paths are still served from disk as a
backwards-compatibility layer for any files that did survive.
"""
from __future__ import annotations

import io

from bson import ObjectId
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from core import UPLOAD_ROOT, db, new_id, require_user

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

# Single bucket for every upload type. Each file carries a ``subdir`` in its
# metadata so admin tooling can still segment them (profiles / headshots /
# company-logos / company-covers / etc.).
_gridfs = AsyncIOMotorGridFSBucket(db, bucket_name="uploads")

_EXT_BY_MIME = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


async def _save_upload(file: UploadFile, subdir: str, user_id: str | None) -> dict:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Only JPEG, PNG and WEBP images are allowed.")
    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Empty file.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large. Max 5MB.")

    ext = _EXT_BY_MIME[file.content_type]
    filename = f"{new_id()}.{ext}"
    file_id = await _gridfs.upload_from_stream(
        filename,
        io.BytesIO(contents),
        metadata={
            "content_type": file.content_type,
            "subdir": subdir,
            "uploaded_by": user_id,
            "original_name": file.filename,
        },
    )
    # Public URL served by /api/uploads/file/{id} — works on any deploy env.
    public_url = f"/api/uploads/file/{file_id}"
    return {
        "url": public_url,
        "file_url": public_url,
        "filename": filename,
        "size": len(contents),
        "id": str(file_id),
    }


@router.post("/api/upload/profile-photo")
async def upload_profile_photo(request: Request, file: UploadFile = File(...)):
    user = await require_user(request)
    return await _save_upload(file, "profiles", user["id"])


@router.post("/api/upload/headshot")
async def upload_headshot(request: Request, file: UploadFile = File(...)):
    user = await require_user(request)
    return await _save_upload(file, "headshots", user["id"])


@router.post("/api/upload/company-logo")
async def upload_company_logo(request: Request, file: UploadFile = File(...)):
    user = await require_user(request)
    return await _save_upload(file, "company-logos", user["id"])


@router.post("/api/upload/cover-image")
async def upload_cover_image(request: Request, file: UploadFile = File(...)):
    user = await require_user(request)
    return await _save_upload(file, "company-covers", user["id"])


@router.get("/api/uploads/file/{file_id}")
async def get_upload(file_id: str):
    """Stream a GridFS-stored upload by its ObjectId string."""
    try:
        oid = ObjectId(file_id)
    except Exception:
        raise HTTPException(404, "Not found")

    try:
        stream = await _gridfs.open_download_stream(oid)
    except Exception:
        raise HTTPException(404, "Not found")

    meta = getattr(stream, "metadata", None) or {}
    content_type = meta.get("content_type") or "application/octet-stream"

    async def iterator():
        chunk = await stream.readchunk()
        while chunk:
            yield chunk
            chunk = await stream.readchunk()

    return StreamingResponse(
        iterator(),
        media_type=content_type,
        # Cache aggressively — file contents are immutable per ID.
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


# --------------------------------------------------------------------------- #
# Legacy path fallback — files uploaded under the old scheme still resolve via
# /api/static/uploads/... because ``server.py`` mounts ``UPLOAD_ROOT`` there.
# No code change needed here; this comment documents the contract.
# --------------------------------------------------------------------------- #
_ = UPLOAD_ROOT  # keep import live for downstream introspection
