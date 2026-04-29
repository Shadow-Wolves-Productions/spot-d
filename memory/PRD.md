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

### Iter 12 (Feb 2026 — pre-launch architecture) — TESTED ✓ (14/14 pytest)
- **Instagram Story share** — `CastingStoryShareCard.jsx` generates a 1080×1920 PNG via `html2canvas` (#0D0D0D bg, NOW CASTING chip in #FF5C35, role pills, QR code via `qrcode` lib pointing to /casting/{id}). Triggers Web Share API on mobile, falls back to PNG download on desktop. Wired into `CastingCallDetail.jsx` (`data-testid=casting-detail-story-share`) and `CastingApplicationsKanban.jsx` (`data-testid=kanban-story-share-btn`).
- **React-router navigation** — replaced `window.location.href` with `useNavigate()` for internal routes in `CastingCalls.jsx` (card click) and `AdminDashboard.jsx` (non-admin redirect).
- **Server-side view counts** — new endpoints `POST /api/profiles/{id}/view` + `POST /api/casting/{id}/view`. Rate-limited 1 increment per viewer per hour via TTL `view_events` collection. Owner self-views skipped.
- **server.py router split — Phase 1** — created `core.py` + 9-file `routers/` package. Auth, uploads, profile-view, casting-view, health migrated. server.py: 2949 → 2743 lines.
- **HSTS middleware** — `Strict-Transport-Security` gated on `ENV=production`.
- **7 Pydantic body models** with URL auto-https + slug normalisers. Relative paths preserved. 422 on validation failure.

### Iter 14 (Feb 2026 — logo + cosmetics + pre-launch checklist) — TESTED ✓ (52 backend pytest)
- **Logo size bumped** — header `h-14 md:h-20` (56→80px) with breathing-room padding around the Link wrapper; footer `h-14 md:h-16` (56→64px). Brand mark legible on both dark and light themes.
- **FounderCapEditor success toast** — `toast.success("Founder cap updated to N", { duration: 4000 })` on save.
- **og:image absolute-URL hardening** — `usePageMeta.js` resolves any relative path to `window.location.origin + path` before injecting the meta tag, so Twitter/Slack/LinkedIn/iMessage previews work correctly. Also normalizes `og:url` and `twitter:image`.
- **Helpers consolidated** — `record_view`, `viewer_id_for` lifted from `routers/profiles.py` into `core.py`. `routers/casting.py` imports cleanly without cross-router. Backwards-compat aliases retained.
- **Pre-launch security gaps closed (4 critical):**
  1. **Owner-or-admin gate on update_entity / delete_entity** — non-admin user can no longer edit/delete other users' Profile, CompanyProfile, CastingCall, CastingApplication, SpotRequest, SavedProfile, ContactReveal, Subscription, Notification, RoleAlert (returns 403).
  2. **Duplicate CastingApplication 409** — same user applying twice to the same call returns 409.
  3. **ContactReveal on own profile blocked** — returns 400.
  4. **SpotRequest to self blocked** — returns 400.
- New regression suite at `tests/test_iteration13.py` (15 tests). **52 backend pytest PASS** total.
- Removed stale Cloudflare WAF section from `test_credentials.md` (no longer relevant).

### Iter 13 (Feb 2026 — Profile poster + Phase-2 router split) — TESTED ✓ (37/37 pytest)
- **Profile poster download** — `ProfilePosterCard.jsx` generates a 1080×1920 owner-only card via `html2canvas` (background #0D0D0D, yellow radial glow, large headshot or branded `'` placeholder, name/role/location, SpotScore N/100 badge, percentile badge if qualifying, verified tick if email_verified, IMDb hint if set, QR code linking to `/u/{slug}`, getspotd.app footer). Triggers Web Share API on mobile, PNG download on desktop. Visibility gated at the parent — component only mounts when `myProfile?.id === profile?.id`.
- **Phase-2 router split — COMPLETE.** server.py: 2743 → **132 lines** (thin app factory: middleware + static mount + include_router + startup/shutdown). Endpoints fully migrated:
  - `routers/entities.py` (432 lines): generic CRUD + spot-score helpers + `_on_casting_application_created`
  - `routers/scheduled.py` (646 lines): `/api/functions/*` (14 routes) + `_run_spotted_with` + `_purge_codes` + `_send_daily_weekly` + `_process_founding_deadlines` + `_send_profile_completion_nudges`
  - `routers/webhooks.py` (324 lines): Stripe checkout/status/webhook + Postmark webhook + verifiers
  - `routers/admin.py` (505 lines): 11 `/api/admin/*` routes + bulk-import + welcome-email + admin gates
  - `routers/public.py` (469 lines): health, analytics, auto-claim, public-settings, public-stats, OG images (Pillow), waitlist, founder-count
  - `bootstrap.py` (226 lines): `seed_initial_data`, `create_indexes`, `migrate_all_roles`, `backfill_spot_score_history`
- Cross-router calls handled via lazy import wrappers (`_lazy()` pattern in `scheduled.py` + `admin.py`) to dodge module-load circular imports while preserving async semantics.
- `core.py` hosts `coll`, `compute_all_roles`, `parse_value` so every router shares one source of truth.
- Backend pytest iter11 (14) + iter12 (23) = **37/37 PASS**.

## Backlog (P1 — post-launch)
- (none currently — Phase-2 router split shipped in iter13)

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
