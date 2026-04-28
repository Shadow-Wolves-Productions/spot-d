"""Stripe + Postmark webhook receivers — staged in ``server.py`` for now.

The two live handlers (``/api/webhooks/stripe`` + ``/api/webhooks/postmark``)
remain in ``server.py`` because they share their signature-verification
helpers with the rest of the Stripe + email code. Move them here once the
Stripe checkout & subscription helpers also live in their own module.
"""
from fastapi import APIRouter

router = APIRouter()
