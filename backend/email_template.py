"""Spot'd email template — single canonical renderer used for every
broadcast/transactional email so the brand stays consistent.

Structured input:

    {
        "greeting": "Hey Brendan,",
        "intro": ["First paragraph", "Second paragraph"],   # optional
        "sections": [
            {
                "eyebrow": "What's new",
                "eyebrow_color": "#E6FF00",                   # default neon yellow
                "paragraphs": ["..."],
                "list": ["bullet 1", "bullet 2"],            # optional
                "highlight": ["⚡ Lifetime free PRO", "⚡ ..."], # optional
            },
        ],
        "cta": {"label": "CLAIM YOUR SPOT →", "url": "https://getspotd.app/login"},
        "post_cta": "Enter this email at sign-in and we'll send you a code…",
        "signoff": {
            "name": "Brendan Byrne",
            "title": "Founder — Spot'd",            "company": "Shadow Wolves Productions",
        },
        "footer_email": "user@example.com",   # for the unsubscribe link
    }

Anything missing is silently omitted so admins don't have to fill every field.
"""
from __future__ import annotations

import html
from typing import Any, List, Optional


_BG = "#0D0D0D"
_PANEL_BORDER = "#1F1F1F"
_TEXT = "#E5E5E5"
_TEXT_MUTED = "#999999"
_TEXT_FAINT = "#888888"
_NEON = "#E6FF00"
_ORANGE = "#FF5C35"
_LIME_DOT = "#E8FC6C"


def _esc(v: Any) -> str:
    """HTML-escape a value, preserving `None` as empty string. We intentionally
    DO NOT escape `paragraph` content because admins compose with inline HTML
    (links, <strong>, etc.) — that's the contract documented in the composer."""
    if v is None:
        return ""
    return html.escape(str(v))


def _para(text: str, *, color: str = _TEXT, size: int = 16, weight: int = 400, mb: int = 18) -> str:
    return (
        f'<p style="margin:0 0 {mb}px;font-size:{size}px;color:{color};'
        f'font-weight:{weight};line-height:1.6;">{text}</p>'
    )


def _hr() -> str:
    return f'<hr style="border:none;border-top:1px solid {_PANEL_BORDER};margin:32px 0;">'


def _eyebrow(text: str, color: str = _NEON) -> str:
    return (
        f'<p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;'
        f'letter-spacing:0.15em;color:{color};font-weight:700;">{_esc(text)}</p>'
    )


def _wordmark() -> str:
    return (
        '<div style="margin-bottom:32px;">'
        '<span style="display:inline-block;font-family:Helvetica,Arial,sans-serif;'
        'font-weight:800;font-size:40px;letter-spacing:-1px;color:#FFFFFF;line-height:1;">'
        f"spot<span style=\"color:{_LIME_DOT};\">'</span>d"
        '</span></div>'
    )


def _cta(label: str, url: str) -> str:
    return (
        '<div style="text-align:center;margin:32px 0;">'
        f'<a href="{_esc(url)}" style="display:inline-block;background:{_NEON};'
        f'color:{_BG};text-decoration:none;font-weight:800;padding:18px 40px;'
        f'border-radius:10px;font-family:\'Sora\',Arial,sans-serif;font-size:15px;'
        f'letter-spacing:0.04em;">{_esc(label)}</a>'
        '</div>'
    )


def _highlight_box(items: List[str]) -> str:
    rows = "".join(
        f'<p style="margin:0 0 8px;color:{_TEXT};font-size:15px;">{r}</p>'
        for r in items
    )
    return (
        '<div style="background:#131313;border:1px solid #2A2A2A;border-radius:12px;'
        'padding:20px 24px;margin:16px 0 20px;">'
        f'{rows}</div>'
    )


def _section(section: dict) -> str:
    out: list[str] = [_hr()]
    eyebrow = section.get("eyebrow")
    if eyebrow:
        out.append(_eyebrow(eyebrow, section.get("eyebrow_color") or _NEON))
    for p in section.get("paragraphs") or []:
        out.append(_para(p))
    items = section.get("list") or []
    if items:
        bullets = "".join(
            f'<li style="margin:6px 0;color:#B8B8B8;">{i}</li>' for i in items
        )
        out.append(
            f'<ul style="margin:0 0 20px 18px;padding:0;color:#B8B8B8;">{bullets}</ul>'
        )
    highlight = section.get("highlight") or []
    if highlight:
        out.append(_highlight_box(highlight))
    return "".join(out)


def render_email(
    *,
    greeting: Optional[str] = None,
    intro: Optional[List[str]] = None,
    sections: Optional[List[dict]] = None,
    cta: Optional[dict] = None,
    post_cta: Optional[str] = None,
    signoff: Optional[dict] = None,
    footer_email: Optional[str] = None,
    unsubscribe_url_base: str = "https://getspotd.app/unsubscribe",
) -> str:
    """Render a full HTML email document using the Spot'd brand template."""
    body: list[str] = []
    body.append(_wordmark())

    if greeting:
        body.append(_para(greeting, color=_TEXT))
    for p in intro or []:
        body.append(_para(p, color=_TEXT))

    for sec in sections or []:
        body.append(_section(sec))

    if cta and cta.get("label") and cta.get("url"):
        body.append(_hr())
        body.append(_cta(cta["label"], cta["url"]))

    if post_cta:
        body.append(
            f'<p style="margin:24px 0 8px;color:{_TEXT_MUTED};font-size:14px;'
            f'text-align:center;">{post_cta}</p>'
        )

    if signoff:
        body.append(_hr())
        if signoff.get("intro"):
            body.append(_para(signoff["intro"], color=_TEXT, mb=12))
        if signoff.get("name"):
            body.append(
                f'<p style="margin:0 0 4px;color:#FFFFFF;font-weight:600;">'
                f'{_esc(signoff["name"])}</p>'
            )
        if signoff.get("title"):
            body.append(
                f'<p style="margin:0 0 2px;color:{_TEXT_FAINT};font-size:14px;">'
                f'{_esc(signoff["title"])}</p>'
            )
        if signoff.get("company"):
            body.append(
                f'<p style="margin:0 0 2px;color:{_TEXT_FAINT};font-size:14px;">'
                f'{_esc(signoff["company"])}</p>'
            )
        if signoff.get("link_label"):
            body.append(
                f'<p style="margin:0;color:{_TEXT_FAINT};font-size:14px;">'
                f'<a href="{_esc(signoff.get("link_url") or "https://getspotd.app/")}" '
                f'style="color:{_TEXT_FAINT};text-decoration:none;">'
                f'{_esc(signoff["link_label"])}</a></p>'
            )

    # Footer
    unsub = ""
    if footer_email:
        from urllib.parse import quote_plus
        unsub = (
            f'If you\'d prefer not to receive emails from Spot\'d, '
            f'<a href="{unsubscribe_url_base}?e={quote_plus(footer_email)}" '
            f'style="color:#777;">unsubscribe here</a>.'
        )
    body.append(
        f'<p style="margin:48px 0 8px;color:#555;font-size:11px;line-height:1.6;">'
        f'You\'re receiving this because you have a Spot\'d account. {unsub}</p>'
    )
    body.append(
        '<p style="margin:0;color:#555;font-size:11px;">'
        'getspotd.app · Shadow Wolves Productions</p>'
    )

    inner = "".join(body)
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;">
<div style="background:{_BG};color:{_TEXT};font-family:'DM Sans','Helvetica Neue',Arial,sans-serif;padding:40px 16px;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;">
    {inner}
  </div>
</div>
</body></html>"""


def render_simple_announcement(
    *,
    greeting: str,
    body_paragraphs: List[str],
    cta_label: Optional[str] = None,
    cta_url: Optional[str] = None,
    signoff_name: str = "Brendan Byrne",
    signoff_title: str = "Founder — Spot'd",
    signoff_company: str = "Shadow Wolves Productions",
    footer_email: Optional[str] = None,
) -> str:
    """Convenience renderer for the simplest case — greeting + paragraphs +
    optional CTA. Good for one-off announcements where the admin types a
    couple of paragraphs and (maybe) provides a button."""
    cta = {"label": cta_label, "url": cta_url} if cta_label and cta_url else None
    return render_email(
        greeting=greeting,
        intro=body_paragraphs,
        cta=cta,
        signoff={
            "intro": "Talk soon,",
            "name": signoff_name,
            "title": signoff_title,
            "company": signoff_company,
            "link_label": "getspotd.app",
            "link_url": "https://getspotd.app/",
        },
        footer_email=footer_email,
    )
