# Spot'd — Test credentials & integration secrets

## Admin login (hybrid auth — iter15)
- Email: `brendan@shadowwolvesproductions.com.au`
- **Login flow (preferred)**: `POST /api/auth/login` with `{ email, password }`.
  - If `password_hash` is null → returns 409 `{ code: "set_password_required" }`. Frontend then drops into the OTP-then-set-password flow.
  - As of this iter, Brendan has NOT yet set a password. First sign-in uses the OTP flow:
    1. `POST /api/auth/request-code { email }`
    2. `POST /api/auth/verify-code { email, code }` — code from Postmark email or `db.login_codes`
    3. After verify, frontend prompts for password → `POST /api/auth/set-password { password }`
- Role: `admin`, founder tier active
- Profile slug: `brendanbyrneofficial`
- For automated testing of password endpoints, use `iter14-rtt@example.com` flow (see `tests/test_iteration14.py::test_otp_set_password_then_login_round_trip`).

## Email — Postmark (LIVE)
- Server API token: configured in `/app/backend/.env` as `POSTMARK_API_KEY`
- Sender address: `hello@getspotd.app` (Sender Signature verified)
- Webhook URL: `https://getspotd.app/api/webhooks/postmark`
- Webhook auth: HTTP Basic Auth
  - Username: `spotd-postmark`
  - Password: stored in `/app/backend/.env` as `POSTMARK_WEBHOOK_PASSWORD`
- `EMAIL_MOCK_MODE=false` (live)

## SMS
- DISABLED. Phone verification removed from product entirely.
- `SMS_MOCK_MODE=true` (function is no-op)

## Stripe — LIVE keys, subscription mode
- Publishable key + Secret key in `/app/backend/.env`
- Webhook URL: `https://getspotd.app/api/webhooks/stripe`
- Backwards-compat alias: `https://getspotd.app/api/webhook/stripe`
- Webhook signing secret: `STRIPE_WEBHOOK_SECRET=whsec_…` in env
- Verified events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.paid`, `payment_intent.payment_failed`
- Price IDs (all in env):
  - PRO Monthly: `price_1TQnT3PF6tM0yOLwHjcvfAfE` ($9.99 AUD/mo)
  - PRO Annual: `price_1TQnTYPF6tM0yOLwLROIb66k` ($79.00 AUD/yr)
  - Elite Monthly: `price_1TQnUGPF6tM0yOLw2pqxF1fS` ($14.99 AUD/mo)
  - Elite Annual: `price_1TQnUGPF6tM0yOLwI09pgo0K` ($149.00 AUD/yr)

## Mongo (preview/local)
- Connection from `/app/backend/.env` `MONGO_URL` + `DB_NAME`
- Login codes table: `db.login_codes` — clear via `db.login_codes.deleteMany({})` if rate-limited during testing

## Founder cap
- Default: 100 spots (admin-editable from /admin → Platform tab)
- Stored in `db.platform_settings` at `id: "global"`
- Cap reached → all founding sections auto-hide and waitlist replaces them
