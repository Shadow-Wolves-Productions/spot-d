"""Stripe checkout + Stripe + Postmark webhooks."""
import asyncio
import json
import os
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from fastapi.responses import JSONResponse, Response as FastAPIResponse
from pydantic import BaseModel, EmailStr, Field, ValidationError

from core import (
    ADMIN_EMAIL, EMAIL_LOGO_URL, EMAIL_MOCK, IS_PROD, UPLOAD_ROOT,
    ENTITIES, PUBLIC_READ,
    coll, compute_all_roles, current_user, db, decode_token, log,
    make_token, new_id, now_iso, parse_value, require_user, scheduler,
    send_email, send_sms, serialize, slugify,
)
from models import ENTITY_MODELS

router = APIRouter()

# --------------------------------------------------------------------------- #
# Stripe payments
# --------------------------------------------------------------------------- #
PLANS = {
    "pro_monthly":   {"amount": 9.99,   "currency": "aud", "tier": "pro",   "label": "PRO Monthly",   "billing": "monthly", "price_env": "STRIPE_PRO_MONTHLY_PRICE_ID"},
    "pro_annual":    {"amount": 79.00,  "currency": "aud", "tier": "pro",   "label": "PRO Annual",    "billing": "annual",  "price_env": "STRIPE_PRO_ANNUAL_PRICE_ID"},
    "elite_monthly": {"amount": 14.99,  "currency": "aud", "tier": "elite", "label": "Elite Monthly", "billing": "monthly", "price_env": "STRIPE_ELITE_MONTHLY_PRICE_ID"},
    "elite_annual":  {"amount": 149.00, "currency": "aud", "tier": "elite", "label": "Elite Annual",  "billing": "annual",  "price_env": "STRIPE_ELITE_ANNUAL_PRICE_ID"},
}


class CheckoutBody(BaseModel):
    plan_id: str
    origin_url: str


@router.post("/api/stripe/checkout")
async def stripe_checkout(body: CheckoutBody, request: Request):
    user = await require_user(request)
    if body.plan_id not in PLANS:
        raise HTTPException(400, "Invalid plan")
    plan = PLANS[body.plan_id]

    api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
    price_id = os.environ.get(plan["price_env"], "").strip()
    host_url = body.origin_url.rstrip("/")
    success_url = f"{host_url}/welcome?plan={plan['tier']}&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/pricing"
    metadata = {
        "user_id": user["id"], "plan_id": body.plan_id, "tier": plan["tier"], "billing": plan["billing"],
    }

    # Production path — use a real Price ID for recurring subscription billing.
    # Falls back to dynamic-amount mode when no price ID is configured (dev/sandbox).
    if price_id and api_key.startswith(("sk_live_", "sk_test_")) and api_key != "sk_test_emergent":
        try:
            import stripe as stripe_sdk
        except Exception as e:
            raise HTTPException(500, f"stripe sdk unavailable: {e}")
        stripe_sdk.api_key = api_key
        try:
            session = await asyncio.to_thread(
                stripe_sdk.checkout.Session.create,
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
                subscription_data={"metadata": metadata},
                customer_email=user.get("email"),
                allow_promotion_codes=True,
            )
        except Exception as e:
            log.error("Stripe subscription checkout failed: %s", e)
            raise HTTPException(502, f"Stripe error: {e}")
        await db.payment_transactions.insert_one({
            "id": new_id(),
            "session_id": session.id,
            "user_id": user["id"],
            "plan_id": body.plan_id,
            "tier": plan["tier"],
            "amount": plan["amount"],
            "currency": plan["currency"],
            "metadata": metadata,
            "payment_status": "initiated",
            "status": "pending",
            "mode": "subscription",
            "created_date": now_iso(),
        })
        return {"url": session.url, "session_id": session.id}

    # Sandbox / fallback — emergentintegrations one-shot dynamic-amount checkout.
    try:
        from emergentintegrations.payments.stripe.checkout import (
            StripeCheckout, CheckoutSessionRequest,
        )
    except Exception as e:
        raise HTTPException(500, f"Stripe lib unavailable: {e}")
    webhook_url = f"{host_url}/api/webhooks/stripe"
    checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    req = CheckoutSessionRequest(
        amount=plan["amount"], currency=plan["currency"],
        success_url=success_url, cancel_url=cancel_url, metadata=metadata,
    )
    session = await checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "id": new_id(),
        "session_id": session.session_id,
        "user_id": user["id"],
        "plan_id": body.plan_id,
        "tier": plan["tier"],
        "amount": plan["amount"],
        "currency": plan["currency"],
        "metadata": metadata,
        "payment_status": "initiated",
        "status": "pending",
        "mode": "dynamic",
        "created_date": now_iso(),
    })
    return {"url": session.url, "session_id": session.session_id}


@router.get("/api/stripe/status/{session_id}")
async def stripe_status(session_id: str):
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
    except Exception as e:
        raise HTTPException(500, f"Stripe lib unavailable: {e}")
    api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
    checkout = StripeCheckout(api_key=api_key, webhook_url="")
    status = await checkout.get_checkout_status(session_id)
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if txn and txn.get("payment_status") != "paid" and status.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": status.payment_status, "status": status.status, "updated_date": now_iso()}},
        )
        # Activate subscription idempotently
        await activate_subscription_for_session(session_id, status.metadata or txn.get("metadata", {}))
    return {
        "status": status.status, "payment_status": status.payment_status,
        "amount_total": status.amount_total, "currency": status.currency,
        "metadata": status.metadata,
    }


async def activate_subscription_for_session(session_id: str, metadata: dict):
    user_id = metadata.get("user_id")
    tier = metadata.get("tier")
    billing = metadata.get("billing")
    if not user_id or not tier:
        return
    expires = None
    if billing == "monthly":
        expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    elif billing == "annual":
        expires = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    existing = await db.subscriptions.find_one({"user_id": user_id})
    sub = {
        "tier": tier,
        "status": "active",
        "expires_at": expires,
        "started_at": now_iso(),
        "contact_reveal_limit": -1,
        "casting_call_limit": -1 if tier == "elite" else 5,
        "can_boost": True,
        "payment_reference": session_id,
        "updated_date": now_iso(),
    }
    if existing:
        await db.subscriptions.update_one({"id": existing["id"]}, {"$set": sub})
    else:
        sub.update({"id": new_id(), "user_id": user_id, "created_date": now_iso()})
        await db.subscriptions.insert_one(sub)


@router.post("/api/webhooks/stripe")
@router.post("/api/webhook/stripe")  # backwards-compat alias for the older path
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("stripe-signature") or request.headers.get("Stripe-Signature", "")
    api_key = os.environ.get("STRIPE_API_KEY", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()

    event = None
    # Production path — native Stripe SDK verifies the whsec_ signature.
    if webhook_secret and api_key.startswith(("sk_live_", "sk_test_")):
        try:
            import stripe as stripe_sdk
            stripe_sdk.api_key = api_key
            event = stripe_sdk.Webhook.construct_event(body, sig, webhook_secret)
        except Exception as e:
            log.error("Stripe webhook signature verification failed: %s", e)
            raise HTTPException(400, "Invalid signature")
        evt_type = event["type"]
        # Convert StripeObject -> plain dict by re-parsing the original JSON body
        # so all downstream .get() calls behave like a normal dict.
        try:
            full_event = json.loads(body.decode("utf-8") or "{}")
            data_obj = full_event.get("data", {}).get("object", {}) or {}
        except Exception:
            data_obj = {}
        meta = data_obj.get("metadata") or {}
        session_id = data_obj.get("id") if data_obj.get("object") == "checkout.session" else (data_obj.get("checkout_session") or "")
        if evt_type == "checkout.session.completed" and data_obj.get("payment_status") == "paid":
            await activate_subscription_for_session(session_id, meta)
        elif evt_type in ("customer.subscription.deleted", "payment_intent.payment_failed"):
            if meta.get("user_id"):
                await db.subscriptions.update_one(
                    {"user_id": meta["user_id"]},
                    {"$set": {"tier": "free", "status": "expired", "updated_date": now_iso()}},
                )
        elif evt_type in ("customer.subscription.updated", "invoice.payment_succeeded", "invoice.paid"):
            if meta.get("user_id"):
                sub = await db.subscriptions.find_one({"user_id": meta["user_id"]})
                if sub:
                    billing = meta.get("billing") or "monthly"
                    base = datetime.fromisoformat(sub["expires_at"]) if sub.get("expires_at") else datetime.now(timezone.utc)
                    base = max(base, datetime.now(timezone.utc))
                    extended = base + timedelta(days=365 if billing == "annual" else 30)
                    await db.subscriptions.update_one(
                        {"id": sub["id"]},
                        {"$set": {
                            "expires_at": extended.isoformat(),
                            "status": "active",
                            "updated_date": now_iso(),
                        }},
                    )
        return {"received": True}

    # Sandbox fallback — emergentintegrations parser used pre-launch.
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        checkout = StripeCheckout(api_key=api_key or "sk_test_emergent", webhook_url="")
        evt = await checkout.handle_webhook(body, sig)
    except Exception as e:
        log.error("stripe webhook parse err: %s", e)
        return {"received": True}
    if evt.event_type in ("checkout.session.completed",) and evt.payment_status == "paid":
        await activate_subscription_for_session(evt.session_id, evt.metadata or {})
    elif evt.event_type in ("customer.subscription.deleted", "payment_intent.payment_failed"):
        meta = evt.metadata or {}
        if meta.get("user_id"):
            await db.subscriptions.update_one(
                {"user_id": meta["user_id"]},
                {"$set": {"tier": "free", "status": "expired", "updated_date": now_iso()}},
            )
    elif evt.event_type in ("customer.subscription.updated", "invoice.payment_succeeded", "customer.subscription.renewed"):
        meta = evt.metadata or {}
        if meta.get("user_id"):
            sub = await db.subscriptions.find_one({"user_id": meta["user_id"]})
            if sub:
                billing = meta.get("billing") or "monthly"
                base = datetime.fromisoformat(sub["expires_at"]) if sub.get("expires_at") else datetime.now(timezone.utc)
                base = max(base, datetime.now(timezone.utc))
                extended = base + timedelta(days=365 if billing == "annual" else 30)
                await db.subscriptions.update_one(
                    {"id": sub["id"]},
                    {"$set": {
                        "expires_at": extended.isoformat(),
                        "status": "active",
                        "updated_date": now_iso(),
                    }},
                )
    return {"received": True}


# --------------------------------------------------------------------------- #
# Postmark webhook (delivery / bounce / spam events)
# Authenticated via HTTP Basic Auth using POSTMARK_WEBHOOK_USERNAME +
# POSTMARK_WEBHOOK_PASSWORD. Postmark configures these in its dashboard
# (Webhook → Custom headers and basic auth → Basic auth credentials).
# --------------------------------------------------------------------------- #
def verify_postmark_basic_auth(request: Request) -> bool:
    expected_user = os.environ.get("POSTMARK_WEBHOOK_USERNAME", "").strip()
    expected_pass = os.environ.get("POSTMARK_WEBHOOK_PASSWORD", "").strip()
    # If creds are unset we reject — never accept unauthenticated webhook data.
    if not expected_user or not expected_pass:
        return False
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    if not auth_header.lower().startswith("basic "):
        return False
    try:
        decoded = base64.b64decode(auth_header.split(" ", 1)[1].strip()).decode("utf-8")
    except Exception:
        return False
    if ":" not in decoded:
        return False
    user, pwd = decoded.split(":", 1)
    return hmac.compare_digest(user, expected_user) and hmac.compare_digest(pwd, expected_pass)


@router.post("/api/webhooks/postmark")
async def postmark_webhook(request: Request):
    if not verify_postmark_basic_auth(request):
        raise HTTPException(status_code=401, detail="Unauthorized", headers={"WWW-Authenticate": "Basic"})
    raw = await request.body()
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        payload = {}
    record_type = payload.get("RecordType") or payload.get("Type") or "Unknown"
    await db.postmark_events.insert_one({
        "id": new_id(),
        "record_type": record_type,
        "email": payload.get("Recipient") or payload.get("Email"),
        "message_id": payload.get("MessageID"),
        "raw": payload,
        "created_date": now_iso(),
    })
    return {"received": True}


# --------------------------------------------------------------------------- #
# File uploads — moved to routers/uploads.py
# --------------------------------------------------------------------------- #


# --------------------------------------------------------------------------- #
# Bulk import — admin only
