# Spot'd — Product Requirements Document

**Tagline:** Indie film cast & crew discovery — "IMDb Pro meets Slated for indie."

## Tech Stack
- React 18 + Vite, TailwindCSS, shadcn/ui, framer-motion, html2canvas, recharts
- FastAPI + MongoDB
- Auth: passwordless OTP + JWT
- Stripe (native SDK, subscription mode, LIVE)
- Postmark email (LIVE, Basic-Auth-secured webhook)
- ~~Twilio SMS~~ — REMOVED (cost not justified)
- APScheduler

## Production Readiness

### ✅ LIVE
- **Email**: Postmark — `EMAIL_MOCK_MODE=false`. Sender `hello@getspotd.app` verified. Webhook secured via HTTP Basic Auth.
- **Payments**: Stripe — `sk_live_…` + `pk_live_…`. Real subscription billing via `mode=subscription` + `line_items: [{price: "price_xxx"}]`. Two products (PRO, Elite) × 2 billing cycles = 4 price IDs configured.
- **Webhook signature verification**: Stripe SDK `Webhook.construct_event` enforces signature + 5min timestamp tolerance.
- **Brand colour**: `#E6FF00` neon yellow (was `#E8FC6C` lime).

### ⚠️ Pending pre-launch
- **Cloudflare WAF skip rule** — required for `/api/webhooks/{stripe,postmark}` paths (currently HTTP 403 from CF bot detection). One-time admin task.

### ❌ Removed entirely
- Phone/SMS verification — Twilio cost not justified for indie film market. SpotScore points (8) merged into email verification (now worth 15).

## Implemented (cumulative through Feb 2026)

### Iter 1-8 (summarised)
Foundation migration, OTP auth, Stripe checkout, Postmark, bulk import, SpotScore, AgeGate, multi-role profiles, CompanyProfiles, Analytics, Notifications, AutoClaim, mobile UX polish, casting share card, landing redesign with live data, branded ProfileCard placeholder.

### Iter 9 — Founder cap + waitlist + OG images + Trusted-by + 5min cache + footer + Hero CTA fix
- `/api/public-stats` now caches 300s, returns `founder_cap`
- `/api/og/casting/{id}.png` + `/api/og/profile/{slug}.png` (Pillow, 1h cache)
- Founder cap: PlatformSettings (default 100, admin-editable). All counters live.
- Auto-hide + waitlist when cap reached. Urgency tiers (amber<75, orange<25, pulse<10).
- TrustedByRow on landing (only renders if 3+ verified companies; 3 seeded).
- `/api/waitlist` + admin viewer.
- usePageMeta hook adds OG meta to ProfilePage.
- Footer copyright "© 2026 Shadow Wolves Productions. All rights reserved."

### Iter 10 (this session) — Production go-live
- **Brand colour `#E8FC6C` → `#E6FF00`** (HSL `66 100% 50%`) across all 17 components, CSS vars, RGBA, OG images, email templates.
- **Email branding**: "Spot" + "d" white, only `'` in neon yellow — applied to all 3 email templates.
- **Twilio SMS removed**: VerificationPanel, InlineVerification, AutoClaimBanner, admin Profiles tab, admin Stats tab. Backend `sendVerificationCode` rejects `type: phone`. SpotScore points 7+8 → 15 (email).
- **Postmark webhook → Basic Auth verifier** (replaces HMAC). Username/password configured in `.env`.
- **Stripe go-live**:
  - 4 price IDs in `.env` (PRO/Elite × monthly/annual)
  - LIVE secret + publishable keys
  - Native `stripe-python` SDK powers subscription-mode checkout (replaces `emergentintegrations` for production path; integrations still wired as sandbox fallback)
  - Webhook URL `/api/webhooks/stripe` (plural, what Stripe is configured for) + alias `/api/webhook/stripe`
  - `Webhook.construct_event` verifies signatures correctly: ✅ valid → 200, ✅ bad → 400, ✅ missing → 400, ✅ stale (>5min) → 400
  - Tested live checkout creation: both `cs_live_…` sessions created successfully with real `checkout.stripe.com` URLs
- **Launch checklist** updated: `email_live`, `stripe_keys`, `profile_count ≥ 10`, `pending_welcome=0` — all 4 green.
- Stripe webhook handler now safely converts `StripeObject` → plain dict via JSON re-parse (avoids the `KeyError` from naive `dict()` cast).

### Iter 11 (Feb 2026 — final UX polish) — TESTED ✓
- **Casting Call Detail page** (`/casting/:id`) live — full wireframe (header, poster hero, role cards, apply/share buttons, footer meta, OG share preview).
- **Casting cards clickable** — click anywhere on a card (except inner buttons / links) navigates to detail.
- **Drag-and-drop poster upload** added to `CreateCastingCall.jsx` Phase 2: `data-testid="poster-dropzone"` accepts files via drag-drop or click-browse, with live preview + remove button. Persists `poster_image` URL on the CastingCall doc (verified by pytest 5/5).
- **Admin tab merge**: Users tab removed; merged into Profiles. Per-row "Make Admin / Remove Admin" toggle (`data-testid="admin-toggle-role-{userId}"`) flips `User.role`. Search filters by name + email. Subtitle fixed to remove stale "users" reference.
- **Logo size** confirmed at h-16 (64px) in navbar.
- **FAQ rewrite**: "How do I get verified?" no longer references the non-existent Phone (Twilio removed) or Union verification flows — only Email + IMDb listed.
- **Privacy + Terms cleanup**: removed every Twilio reference; Postmark called out as the email vendor.
- Backend pytest iteration10: 5/5 PASS — OTP login, upload→file_url, CastingCall poster_image persistence, User role flip, casting list.

## Backlog (P1 — post-launch)
- **Server.py 9-router split** (now ~2625 lines) — high priority for maintainability
- Pydantic models for 7 entity types (consistency around field naming)
- Cloudflare WAF skip rule for webhook paths (admin task — one-time)

## Backlog (P2)
- PIL/imghdr image bytes verification on upload
- Strict-Transport-Security header
- Background-task migration for >10k profiles
- Admin profile flag should log {previous, new}
- Migrate uploads from local disk → S3/Cloudflare R2

## Stats (this session)
- 60 visible profiles · 16 distinct roles · 1 active casting call · 1 founder · 99 spots remaining
- All 4 launch checklist items green
- Stripe webhook signature: 4/4 PASS (valid 200, bad/missing/stale all 400)
- Live checkout creation: PRO Monthly + Elite Annual both returned `cs_live_*` sessions

## Test credentials
See `/app/memory/test_credentials.md`.
