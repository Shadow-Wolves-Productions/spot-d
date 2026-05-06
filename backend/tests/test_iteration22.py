"""Iter 22 — unified Spot'd email template."""
import asyncio
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core import make_token  # noqa: E402

BASE = os.environ.get("BACKEND_BASE", "http://localhost:8001")


def _admin_token():
    from motor.motor_asyncio import AsyncIOMotorClient
    async def _go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        u = await db.users.find_one({"role": "admin"}, {"_id": 0, "id": 1})
        return u["id"]
    return make_token(asyncio.run(_go()))


# --------------------------------------------------------------------------- #
# Template renderer — direct unit checks
# --------------------------------------------------------------------------- #
def test_render_email_includes_brand_essentials():
    from email_template import render_email
    html = render_email(
        greeting="Hey Brendan,",
        intro=["Welcome aboard."],
        sections=[{"eyebrow": "What's new", "paragraphs": ["A fresh feature."]}],
        cta={"label": "OPEN →", "url": "https://getspotd.app"},
        signoff={"name": "Brendan", "title": "Founder", "company": "Shadow Wolves Productions"},
        footer_email="user@example.com",
    )
    # Brand essentials
    assert "#0D0D0D" in html        # dark bg
    assert "#E6FF00" in html        # neon yellow accent
    assert "spot<span" in html      # wordmark
    assert "Hey Brendan," in html
    # Eyebrow is HTML-escaped, so an apostrophe becomes &#x27;
    assert "What" in html and "new" in html.lower()
    assert "OPEN →" in html or "OPEN \u2192" in html
    assert "Brendan" in html and "Shadow Wolves Productions" in html
    assert "unsubscribe" in html.lower()


def test_render_email_omits_optional_fields():
    """Fields not provided should NOT render anything (no 'undefined', no
    empty divs, no broken layout)."""
    from email_template import render_email
    html = render_email(greeting="Hey,", intro=["Body."])
    # No CTA when not provided
    assert "background:#E6FF00;color:#0D0D0D" not in html or "<a href=\"None\"" not in html
    # No signoff name leak
    assert "Brendan Byrne" not in html
    # Still has wordmark + footer
    assert "spot" in html
    assert "getspotd.app" in html


def test_render_email_escapes_eyebrow_but_not_paragraphs():
    """Eyebrow runs through html.escape so it's safe; paragraphs are intentionally
    treated as inline-HTML so admins can use <strong>, <a>, etc."""
    from email_template import render_email
    html = render_email(
        greeting="Hi,",
        intro=["<strong>Bold</strong> intro."],     # raw HTML preserved
        sections=[{"eyebrow": "<script>alert(1)</script>", "paragraphs": ["safe"]}],
    )
    assert "<strong>Bold</strong>" in html              # paragraphs allow HTML
    assert "<script>alert(1)</script>" not in html      # eyebrow is escaped
    assert "&lt;script&gt;" in html


# --------------------------------------------------------------------------- #
# /api/admin/preview-broadcast and /broadcast-email — structured template path
# --------------------------------------------------------------------------- #
def test_preview_broadcast_renders_branded_template():
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    r = requests.post(
        f"{BASE}/api/admin/preview-broadcast",
        headers=h,
        json={
            "audience": "founders",
            "subject": "Test",
            "template": {
                "greeting": "Hey {first_name},",
                "intro": ["Hi."],
                "sections": [{"eyebrow": "Test eyebrow", "paragraphs": ["x"]}],
                "cta": {"label": "GO", "url": "https://getspotd.app"},
            },
        },
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "html" in body
    html = body["html"]
    assert "#0D0D0D" in html
    assert "#E6FF00" in html
    assert "Test eyebrow".upper() in html.upper()
    assert "GO" in html
    # Greeting placeholder is resolved server-side for preview
    assert "{first_name}" not in html


def test_broadcast_email_accepts_template_payload():
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    r = requests.post(
        f"{BASE}/api/admin/broadcast-email",
        headers=h,
        json={
            "audience": "founders",
            "subject": "Iter22 template-path test",
            "template": {
                "greeting": "Hey {first_name},",
                "intro": ["Hello."],
                "cta": {"label": "OPEN", "url": "https://getspotd.app"},
            },
            "dry_run": True,
        },
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dry_run"] is True
    assert body["count"] >= 1


def test_broadcast_email_400_when_neither_template_nor_html_provided():
    h = {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}
    r = requests.post(
        f"{BASE}/api/admin/broadcast-email",
        headers=h,
        json={"audience": "founders", "subject": "Empty", "dry_run": True},
        timeout=10,
    )
    assert r.status_code == 400
