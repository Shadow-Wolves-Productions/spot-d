"""File upload endpoints — profile photos, headshots, company logos, covers.

Local-disk MVP. TODO(prod): swap for S3 / Cloudflare R2.
"""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from core import UPLOAD_ROOT, new_id, require_user

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


async def _save_upload(file: UploadFile, subdir: str, public_url_base: str) -> dict:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Only JPEG, PNG and WEBP images are allowed.")
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large. Max 5MB.")
    if not contents:
        raise HTTPException(400, "Empty file.")
    ext = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp"}[file.content_type]
    filename = f"{new_id()}.{ext}"
    path = UPLOAD_ROOT / subdir / filename
    path.write_bytes(contents)
    return {"url": f"{public_url_base}/{filename}", "filename": filename, "size": len(contents)}


@router.post("/api/upload/profile-photo")
async def upload_profile_photo(request: Request, file: UploadFile = File(...)):
    await require_user(request)
    return await _save_upload(file, "profiles", "/api/static/uploads/profiles")


@router.post("/api/upload/headshot")
async def upload_headshot(request: Request, file: UploadFile = File(...)):
    await require_user(request)
    return await _save_upload(file, "headshots", "/api/static/uploads/headshots")


@router.post("/api/upload/company-logo")
async def upload_company_logo(request: Request, file: UploadFile = File(...)):
    await require_user(request)
    return await _save_upload(file, "company-logos", "/api/static/uploads/company-logos")


@router.post("/api/upload/cover-image")
async def upload_cover_image(request: Request, file: UploadFile = File(...)):
    await require_user(request)
    return await _save_upload(file, "company-covers", "/api/static/uploads/company-covers")
