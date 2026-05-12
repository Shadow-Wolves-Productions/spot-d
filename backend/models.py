"""
Pydantic body models for the 7 core entities.

These are *additive* — the entity CRUD endpoint still accepts free-form bodies
for backwards compatibility with the Base44 shim, but when the entity is one of
the typed kinds, we run the body through the matching model first to:

  • enforce required fields
  • normalize/validate URLs (auto-prepend ``https://``)
  • normalize slugs (lowercase, hyphens only)
  • coerce stringy booleans / ints

`extra="allow"` is used everywhere so that future frontend fields don't blow up
existing endpoints. Models always serialise back to a plain dict via
``.model_dump(exclude_unset=True)`` so we never silently fill in defaults that
the client did not actually send.
"""

from __future__ import annotations

import re
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
_SLUG_RE = re.compile(r"[^a-z0-9-]+")


def _normalize_url(value: Optional[str]) -> Optional[str]:
    """Auto-prepend ``https://`` to a bare-domain URL. Empty → None.

    Relative paths starting with ``/`` (e.g. ``/api/static/uploads/foo.png``)
    are left untouched — they're internal-server paths, not external URLs.
    """
    if value is None:
        return None
    v = str(value).strip()
    if not v:
        return None
    if v.startswith("http://") or v.startswith("https://"):
        return v
    if v.startswith("//"):
        return "https:" + v
    if v.startswith("/"):
        # internal/relative path — keep as-is
        return v
    if v.startswith("data:") or v.startswith("blob:"):
        return v
    return "https://" + v


def _normalize_slug(value: Optional[str]) -> Optional[str]:
    """Lowercase, hyphenated, collapse runs of hyphens. Empty → None."""
    if value is None:
        return None
    v = str(value).strip().lower()
    if not v:
        return None
    v = _SLUG_RE.sub("-", v)
    v = re.sub(r"-+", "-", v).strip("-")
    return v or None


class _LooseBase(BaseModel):
    """Base config — accept arbitrary extra fields for forward compatibility."""
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)


# --------------------------------------------------------------------------- #
# 1. Profile
# --------------------------------------------------------------------------- #
class ProfileCreate(_LooseBase):
    full_name: str = Field(..., min_length=1, max_length=200)
    primary_role: Optional[str] = None
    all_roles: Optional[List[str]] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    profile_slug: Optional[str] = None
    profile_photo: Optional[str] = None
    additional_photos: Optional[List[str]] = None
    imdb_link: Optional[str] = None
    website: Optional[str] = None
    showreel_link: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("imdb_link", "website", "showreel_link", "profile_photo", mode="before")
    @classmethod
    def _urls(cls, v):
        return _normalize_url(v)

    @field_validator("profile_slug", mode="before")
    @classmethod
    def _slug(cls, v):
        return _normalize_slug(v)


class ProfileUpdate(_LooseBase):
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)
    primary_role: Optional[str] = None
    all_roles: Optional[List[str]] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    profile_slug: Optional[str] = None
    profile_photo: Optional[str] = None
    additional_photos: Optional[List[str]] = None
    imdb_link: Optional[str] = None
    website: Optional[str] = None
    showreel_link: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None

    @field_validator("imdb_link", "website", "showreel_link", "profile_photo", mode="before")
    @classmethod
    def _urls(cls, v):
        return _normalize_url(v)

    @field_validator("profile_slug", mode="before")
    @classmethod
    def _slug(cls, v):
        return _normalize_slug(v)


# --------------------------------------------------------------------------- #
# 2. CompanyProfile
# --------------------------------------------------------------------------- #
class CompanyProfileCreate(_LooseBase):
    company_name: str = Field(..., min_length=1, max_length=200)
    company_slug: Optional[str] = None
    bio: Optional[str] = None
    logo: Optional[str] = None
    cover_image: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None
    email: Optional[str] = None

    @field_validator("website", "logo", "cover_image", mode="before")
    @classmethod
    def _urls(cls, v):
        return _normalize_url(v)

    @field_validator("company_slug", mode="before")
    @classmethod
    def _slug(cls, v):
        return _normalize_slug(v)


class CompanyProfileUpdate(_LooseBase):
    company_name: Optional[str] = Field(None, min_length=1, max_length=200)
    company_slug: Optional[str] = None
    bio: Optional[str] = None
    logo: Optional[str] = None
    cover_image: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None

    @field_validator("website", "logo", "cover_image", mode="before")
    @classmethod
    def _urls(cls, v):
        return _normalize_url(v)

    @field_validator("company_slug", mode="before")
    @classmethod
    def _slug(cls, v):
        return _normalize_slug(v)


# --------------------------------------------------------------------------- #
# 3. Project
# --------------------------------------------------------------------------- #
class ProjectCreate(_LooseBase):
    title: str = Field(..., min_length=1, max_length=200)
    project_type: Optional[str] = None
    stage: Optional[str] = None
    genre: Optional[str] = None
    seeking: Optional[List[str]] = None
    logline: Optional[str] = None
    synopsis: Optional[str] = None
    director_statement: Optional[str] = None
    production_notes: Optional[str] = None
    country: Optional[str] = None
    filming_location: Optional[str] = None
    budget_range: Optional[str] = None
    runtime: Optional[str] = None
    language: Optional[str] = None
    poster_image: Optional[str] = None
    banner_image: Optional[str] = None
    production_company: Optional[str] = None
    director_name: Optional[str] = None
    contact_role: Optional[str] = None
    contact_email: Optional[str] = None
    festival_status: Optional[str] = None
    release_goals: Optional[str] = None
    imdb_link: Optional[str] = None
    trailer_url: Optional[str] = None
    pitch_deck_url: Optional[str] = None
    company_name: Optional[str] = None
    company_logo: Optional[str] = None

    @field_validator(
        "imdb_link", "trailer_url", "pitch_deck_url",
        "poster_image", "banner_image", "company_logo",
        mode="before",
    )
    @classmethod
    def _urls(cls, v):
        return _normalize_url(v)


class ProjectUpdate(_LooseBase):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    project_type: Optional[str] = None
    stage: Optional[str] = None
    genre: Optional[str] = None
    seeking: Optional[List[str]] = None
    logline: Optional[str] = None
    synopsis: Optional[str] = None
    director_statement: Optional[str] = None
    production_notes: Optional[str] = None
    country: Optional[str] = None
    filming_location: Optional[str] = None
    budget_range: Optional[str] = None
    runtime: Optional[str] = None
    language: Optional[str] = None
    poster_image: Optional[str] = None
    banner_image: Optional[str] = None
    production_company: Optional[str] = None
    director_name: Optional[str] = None
    contact_role: Optional[str] = None
    festival_status: Optional[str] = None
    release_goals: Optional[str] = None
    imdb_link: Optional[str] = None
    trailer_url: Optional[str] = None
    pitch_deck_url: Optional[str] = None
    is_published: Optional[bool] = None
    is_archived: Optional[bool] = None

    @field_validator(
        "imdb_link", "trailer_url", "pitch_deck_url",
        "poster_image", "banner_image",
        mode="before", check_fields=False,
    )
    @classmethod
    def _urls(cls, v):
        return _normalize_url(v)


# --------------------------------------------------------------------------- #
# 3b. CastingCall (legacy — kept for backwards compat)
# --------------------------------------------------------------------------- #
class CastingCallCreate(_LooseBase):
    project_title: str = Field(..., min_length=1, max_length=200)
    project_type: Optional[str] = None
    description: Optional[str] = None
    contact_email: Optional[str] = None
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    poster_image: Optional[str] = None
    location: Optional[str] = None
    budget_range: Optional[str] = None
    union_status: Optional[str] = None
    deadline: Optional[str] = None
    roles: Optional[List[Any]] = None
    roles_needed: Optional[List[str]] = None
    submission_link: Optional[str] = None

    @field_validator("company_logo", "poster_image", "submission_link", mode="before")
    @classmethod
    def _urls(cls, v):
        return _normalize_url(v)


class CastingCallUpdate(_LooseBase):
    project_title: Optional[str] = Field(None, min_length=1, max_length=200)
    project_type: Optional[str] = None
    description: Optional[str] = None
    poster_image: Optional[str] = None
    location: Optional[str] = None
    budget_range: Optional[str] = None
    deadline: Optional[str] = None
    roles: Optional[List[Any]] = None
    roles_needed: Optional[List[str]] = None
    is_active: Optional[bool] = None
    submission_link: Optional[str] = None

    @field_validator("company_logo", "poster_image", "submission_link", mode="before", check_fields=False)
    @classmethod
    def _urls(cls, v):
        return _normalize_url(v)


# --------------------------------------------------------------------------- #
# 4. CastingApplication (create only)
# --------------------------------------------------------------------------- #
class CastingApplicationCreate(_LooseBase):
    casting_call_id: str = Field(..., min_length=1)
    profile_id: Optional[str] = None
    role: Optional[str] = None
    cover_note: Optional[str] = None


# --------------------------------------------------------------------------- #
# 5. SpotRequest
# --------------------------------------------------------------------------- #
class SpotRequestCreate(_LooseBase):
    target_profile_id: str = Field(..., min_length=1)
    requester_profile_id: Optional[str] = None
    role: Optional[str] = None
    project_title: Optional[str] = None
    message: Optional[str] = None


# --------------------------------------------------------------------------- #
# 6. SavedProfile
# --------------------------------------------------------------------------- #
class SavedProfileCreate(_LooseBase):
    profile_id: str = Field(..., min_length=1)
    user_id: Optional[str] = None
    note: Optional[str] = None


# --------------------------------------------------------------------------- #
# 7. ContactReveal
# --------------------------------------------------------------------------- #
class ContactRevealCreate(_LooseBase):
    profile_id: str = Field(..., min_length=1)
    revealer_user_id: Optional[str] = None
    revealed_email: Optional[bool] = False
    revealed_phone: Optional[bool] = False


# --------------------------------------------------------------------------- #
# Registry — entity name → (CreateModel, UpdateModel | None)
# --------------------------------------------------------------------------- #
ENTITY_MODELS: dict = {
    "Profile":             (ProfileCreate,            ProfileUpdate),
    "CompanyProfile":      (CompanyProfileCreate,     CompanyProfileUpdate),
    "Project":             (ProjectCreate,            ProjectUpdate),
    "CastingCall":         (CastingCallCreate,        CastingCallUpdate),
    "CastingApplication":  (CastingApplicationCreate, None),
    "SpotRequest":         (SpotRequestCreate,        None),
    "SavedProfile":        (SavedProfileCreate,       None),
    "ContactReveal":       (ContactRevealCreate,      None),
}
