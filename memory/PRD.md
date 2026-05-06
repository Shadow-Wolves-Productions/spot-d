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

### Iter 20 (Feb 2026 — admin email composer + UX polish + spotlight dedup) — TESTED ✓ (6 new pytest, 21 cumulative)

**1. Admin Email Composer (NEW)**
- Backend: `POST /api/admin/broadcast-email { audience, subject, html, custom_emails?, dry_run }` and `GET /api/admin/audience-counts`. Audiences: `all_users | founders | verified | imported_pending | custom`. 5,000-recipient hard cap, FastAPI `BackgroundTasks` for non-blocking Postmark fan-out, every send wrapped in branded shell (logo, greeting, footer with preferences link). All sends logged to `email_log` (status: sent/failed/exception/mocked).
- Frontend: New `EmailComposer.jsx` component (Emails tab) with: 5 audience radio buttons + live counts, 3 quick-start templates (Update / Weekly digest / Photo re-upload nudge), HTML textarea ↔ Preview toggle, Custom recipient list parser (comma/semicolon/newline), Dry-run + Send buttons, confirm-before-send dialog.

**2. Hero compaction round 2**
- `SearchDirectory` hero went from a centered 4xl/5xl block with gradient to a slim **full-width single-line bar** matching the page width. Removed the dark padding strip above. Removed the 4 quick toggles (`Available Now`, `PRO Only`, `IMDb Linked`, `Verified`) — they live in the left filter sidebar already, so the hero only carries Tabs + Search + (Talent-only) `Minors shown/hidden` toggle.
- Default `includeMinors` flipped from **false → true** so under-18 performers (e.g. Lewis Claassen-Loud) are visible by default. Toggle label flipped to clarify state ("Minors shown" / "Minors hidden").

**3. Profile card icon polish**
- Bottom-of-photo "FOUNDER" pill replaced with a tiny **blue diamond glyph** (`◆`, 16px, `#38BDF8`) in the top-left, with `title="Founding Member"` for hover tooltip.
- "Available now" pill replaced with a **green checkmark circle** (`Check` icon, 16px, `#22C55E`) in the top-left next to the diamond, with `title="Available now"`.
- The percentile badge ("Top 5%" / "Top 10%" etc.) moved from the footer to the **bottom-right of the headshot frame**, opposite the name. New `compact` prop on `PercentileBadge` makes it the same micro-size as the role text.
- Footer simplified — no more Founder/Available pill; just city, experience level, IMDb, spot count, save button.

**4. Admin nav cleanup**
- Removed **Platform** tab and **Logs** tab (their stats were duplicated in Stats; founder-cap editor wasn't being touched).
- Removed standalone **Imports** tab.
- Moved the "Manual founding-member flag" card to the **Profiles** tab (top of the list).
- Admin nav now: Profiles · Casting · Spotlight · Emails · Stats (was 8 tabs, now 5).

**5. Spotlight pin dedup**
- The "Pin a new profile" search list now filters out profiles whose IDs are already in the active-pins list. Previously, a pinned profile would appear in BOTH sections with another "Pin" button — now they only appear in the "Active spotlight pins" section.

**6. Landing page**
- Removed the redundant `<HowItWorks />` section (info already covered above it). Landing flow is now: Hero → Featured Profiles → CastingCalls → Pricing → Founding Section.

State: 58 users (preview) · 3 founders claimed (preview) · 1 casting call · admin nav 5 tabs.

### Iter 19 (Feb 2026 — UI compaction + GridFS uploads + phone removal) — TESTED ✓ (4 new pytest, 15 cumulative)

**1. Photo persistence (URGENT FIX) — local disk → MongoDB GridFS**
- Rewrote `routers/uploads.py` to use `AsyncIOMotorGridFSBucket(bucket_name="uploads")`. Every upload (profile photo / headshot / company-logo / company-cover) now persists in MongoDB and survives container redeploys (the previous local-disk approach lost every photo on every Emergent rebuild → that's why uploaded photos broke "after a day or two").
- New URL shape: `/api/uploads/file/{ObjectId}` — served by a streaming GET endpoint with `Cache-Control: public, max-age=31536000, immutable`.
- Legacy `/api/static/uploads/...` path still mounted from `server.py` for backwards-compat.
- 5MB cap, JPEG/PNG/WEBP only, file-type-by-MIME validated (unchanged from before).

**2. Profile carousel (multi-photo)**
- New optional field `Profile.additional_photos: List[str]` (Pydantic + persistence). `ProfileCard.jsx` shows a swipe carousel of `[profile_photo, ...additional_photos]` inside the headshot frame — chevron arrows fade in on hover, dots indicate position. Single-photo profiles render unchanged.

**3. ProfileCard redesign — 5-col grid, full names, preferred-name italics**
- Card aspect ratio went from `3/4` → `4/5` (more portrait-like).
- Body text shrunk by ~30% (font sizes, paddings, badge sizes all dropped a tier).
- Bottom overlay now shows **full legal name** (line 1) and the preferred name in italics + smart quotes (line 2) only when preferred ≠ first name token (e.g. "Brendan Byrne" / *"Brent"*).
- Directory grid: `grid-cols-1 xs:2 sm:2 lg:3` → `grid-cols-2 sm:3 md:4 lg:5`. Same change applied to `ProfilePage` "similar profiles" + landing `FeaturedProfiles`.
- New `compact` prop on `FoundingMemberBadge` for the smaller card.

**4. SearchDirectory hero compaction**
- Hero padding: `py-12 sm:py-16` → `py-5 sm:py-7`.
- H1 size: `text-3xl/4xl/5xl` → `text-xl/2xl`.
- Search input height + button: `h-11 px-6` → `h-9 px-4`.
- Quick-toggle gaps tightened. Main results container `gap-8` → `gap-5`, header margin `mb-6` → `mb-3`.

**5. Dashboard compaction + pull-to-refresh**
- Stats cards: padding `p-5` → `p-3`, gaps `gap-4` → `gap-3`, font sizes shrunk ~20%, text labels shortened (e.g. "Contact Reveals" → "Reveals", "remaining this month" → "left").
- Section spacing: header `mb-8` → `mb-5`, grid gap `gap-6` → `gap-3`, panel padding `p-6` → `p-4`.
- Wrapped data load in `useCallback` and wired into `usePullToRefresh` — pull-down on mobile now refreshes the whole dashboard (test-id `dashboard-pull-indicator`).

**6. Years-of-experience input fix**
- `value` now resolves to empty string when the underlying number is 0/undefined, so users can clear the leading zero and type two-digit values cleanly. Test-id `years-of-experience-input`.

**7. Phone verification — completely removed**
- Frontend: `phone_verified` references purged from `ProfileCard`, `ProfileHero`, `CreateProfile`. Phone is now a plain contact field with no verify button.
- `InlineVerificationButton` rewritten to be email-only (no `type` prop). Code-entry row uses `flex-wrap basis-full` so the 6-digit input + Confirm button always have room — fixes the "can't enter code" bug the user reported.
- Backend: `/api/functions/sendVerificationCode` returns 400 for any `type ≠ "email"`; `verifyCode` only writes `email_verified` and now also stamps `User.email_verified` (previously only the Profile got the flag, which is why some auth.me() responses didn't see verification).

State after iter 19: 58 users · 58 profiles · 1 casting call · 1 founder claimed.

### Iter 18 (Feb 2026 — go-live housekeeping: casting CRUD + founder claim flow + cleanup) — TESTED ✓ (5 new pytest)

**1. Casting Call edit / end / reopen / delete**
- New route `/casting/:id/edit` reuses `CreateCastingCall.jsx` in edit mode (loads existing call, pre-fills the 4-step wizard, calls `update` instead of `create`, redirects back to detail page on save).
- `CastingCallDetail.jsx` adds owner-only controls (`Edit`, `End` ↔ `Reopen`, `Delete`) plus a full-width red **Casting call closed** banner whenever `is_closed` is true. The Apply CTA is replaced with a disabled `Applications closed` pill for non-owners.
- `CastingCalls.jsx` adds primary status tabs **Open / Closed-Past / All** with live counts. Each card now shows a `CLOSED` pill and (for owners) inline `Edit / End / Reopen / Delete` quick-action buttons. Empty state for the Closed tab is its own message.
- Default browse experience = Open only (closed/past calls are hidden until the user pivots).

**2. Server-side enforcement of closed state**
- New `is_casting_call_closed(call)` helper in `routers/entities.py` — true if `is_active === false` OR `deadline` (UTC) is in the past.
- Every casting call returned by `/api/entities/CastingCall[?...]` now carries an authoritative `is_closed` boolean (computed server-side; frontend doesn't have to re-derive it).
- New 409 guard on `POST /api/entities/CastingApplication` — applications to closed/past calls are rejected with `"This casting call is closed and is no longer accepting applications."`. Sits before the duplicate-application 409.

**3. Founder count fixed**
- Source-of-truth for "founding member" status migrated from `subscriptions.tier=founder` → `User.is_founding_member`.
- `/api/public-stats.founder_count` and `/api/public-settings.founder_remaining` both count `users.is_founding_member: true`.
- `auth.verify-code` now atomically flips `is_founding_member: true` (with `founding_claimed_at` timestamp) the first time an imported user verifies their email — and invalidates the public-stats cache so the homepage counter updates within seconds. Imported-but-not-yet-claimed members are NOT counted (the spot is reserved for them but they haven't claimed).
- Bulk-import no longer auto-flags users; the badge appears as people claim.

**4. Cleanup (one-shot)**
- Deleted 25 test users (`@example.com`, `test_*`, `iter*`, `lockout_*`, `ratelimit_*`, etc.) plus their cascaded profiles, subscriptions, applications, login codes, login attempts.
- Deleted 2 test casting calls (`TEST_iter10_*`, `Checklist Dup-App Test`).
- Deleted 42 test email-log entries.
- Reverted `is_founding_member` flag on the 59 imported-but-unverified users (they keep their reserved import slot but aren't counted as claimed founders until verify-code).

State after cleanup: 58 users · 58 profiles · 1 real casting call (Thunk) · 1 founder claimed (Brendan) / 99 spots remaining.

### Iter 17 (Feb 2026 — go-live: bulk welcome resend + lens placeholder + bug fixes) — TESTED ✓ (6 new pytest)

**1. Bulk welcome email resend (Admin)**
- New endpoint `POST /api/admin/send-pending-welcomes { dry_run, limit }` — finds every imported profile with `welcome_email_sent ≠ true` and queues `_send_welcome_internal` via FastAPI `BackgroundTasks`. Logs the action to `admin_logs`.
- Admin Dashboard → **Imports** tab now has a "Send N pending welcomes" button (`data-testid=admin-send-pending-welcomes-btn`) that surfaces the unclaimed counter and triggers the bulk send with confirm dialog.
- **Triggered live on go-live: 58 imported CineConnect members were sent the founding-member welcome email via Postmark.** A handful of Postmark 422 "Inactive Recipient" rejections (stale addresses from the original CineConnect form) are expected and logged.

**2. Email delivery tracking hardened**
- `core.send_email` now writes every send attempt to `db.email_log` (was only logging in mock mode), including Postmark status code + error message. Added `status` field: `sent | failed | exception | mocked`.
- `_send_welcome_internal` only sets `welcome_email_sent: true` when Postmark returns 2xx. Failed sends instead set `welcome_email_failed_at`, so the bulk endpoint can be safely re-run for retries without spamming successfully delivered recipients.

**3. Lens placeholder**
- New asset: `/app/frontend/public/brand/lens-only.png` (1024×1024 → cropped + resized to 256×256, ~50KB).
- Wired into 4 placeholder render paths: `ProfileCard.jsx` (directory grid), `HeroSection.jsx` (mini hero card), `ProfileHero.jsx` (profile-detail page header), `ProfilePosterCard.jsx` (1080×1920 share poster). Replaces the previous yellow-apostrophe placeholder.

**4. Bug fixes (pre-existing post-refactor NameErrors)**
- `core.PUBLIC_APP_URL` was referenced from `routers/admin.py` and `routers/scheduled.py` but never defined after the Phase-1 router split — would have crashed on first welcome / nudge / role-alert digest send. Now defined in `core.py` from env and imported by both routers.
- `core.SMS_MOCK` was referenced from `routers/admin.py::admin_platform()` but not imported. Fixed.
- `typing.Any` was referenced in `core.parse_value` but only `Optional` was imported. Fixed.

### Iter 16 (Feb 2026 — Brendan founder + Spotlight pin system + hero merge) — TESTED ✓ (49 backend pytest)

**1. Brendan = Founding Member**
- New `User.is_founding_member: true` flag (independent from billing tier — Brendan stays on `elite` for billing but carries the badge).
- `bootstrap.py::migrate_founding_member_flag()` runs on every boot: any user with an active `tier=founder` subscription is auto-flagged. Brendan is set in `seed_initial_data()`.
- `<FoundingMemberBadge>` updated to accept either `isFoundingMember` (preferred) or legacy `tier === "founder"`.

**2. Spotlight pin system**
- New entity `SpotlightPick` `{ profile_id, kind: "paid"|"admin"|"founder_fallback", expires_at, position }`.
- `routers/spotlight.py` (new):
  - `GET /api/spotlight/active` — returns ordered list of profiles to render. Hierarchy: paid Elite carousel → admin pins → founder fallback (highest-score founder profiles, top 3) → algorithmic top-SpotScore non-founder.
  - `POST /api/admin/spotlight-pin { profile_id, expires_at, position }` — admin pin
  - `GET /api/admin/spotlight-pins` — admin list (with hydrated profile details)
  - `DELETE /api/admin/spotlight-pin/{id}` — admin unpin
  - `POST /api/spotlight/grant { profile_id, days }` — owner-or-admin paid grant (called by Stripe webhook in production)
- `AdminDashboard.jsx` gains a 3rd tab: **Spotlight** — search + pin (30-day default) + active-pins list with unpin button.

**3. Hero merge ("Spot'd this month")**
- `HeroSection.jsx` carousel now consumes `/api/spotlight/active` instead of "top by SpotScore". Cycles through whatever the spotlight feed returns.
- `**SPOT'D THIS MONTH**` eyebrow rendered above the carousel with a neon dot. For algorithmic fallback only ("Top of the directory" eyebrow with muted styling).
- The standalone `<HomepageSpotlight />` strip on `Landing.jsx` was **removed** (merged into hero).

Tests: iter11 (14) + iter13 (15) + iter14 (12) + iter15 (8) = **49 backend pytest PASS** (combined runs hit known OTP rate-limit collisions; isolated runs all green).

### Iter 15 (Feb 2026 — password auth + Founding Member badge + Spotlight + email logo) — TESTED ✓ (41/41 pytest)

**1. Password auth (replaces OTP-only login)**
- New endpoints: `POST /api/auth/login` (email+password, JWT), `POST /api/auth/set-password` (auth required), `POST /api/auth/reset-password` (email+code+new_password), `POST /api/auth/forgot-password` (alias of request-code).
- `verify-code` now returns `needs_password_setup` flag — frontend prompts to set a password if user has none.
- Legacy / imported users (no `password_hash`) → `POST /api/auth/login` returns 409 with `{ code: "set_password_required" }`. Frontend auto-falls into OTP → set-password flow.
- bcrypt cost factor 12 (passlib). Brute-force gate: 5 failed attempts in 15min → 429 soft-lock. Successful login wipes failed history.
- New collections: `db.users.password_hash`, `db.users.password_set_at`, `db.login_attempts` (tracks failed attempts).
- Frontend: full Login.jsx rewrite — email+password as default, with `Forgot password?` link, `Show/hide password` toggle, `New here? Create account` register flow (email → OTP → set-password), and seamless legacy-user migration via 409 detection.

**2. Founding Member badge**
- `<FoundingMemberBadge tier={subscription?.tier} />` — pill: `#E8FC6C` bg, `#0D0D0D` text, `◆` glyph + "Founding Member" label, only renders when `tier === "founder"`.
- Wired into ProfileCard (between photo and name row), ProfileHero (next to tier badges), and SearchDirectory (batched founder lookup).
- FeaturedProfiles on landing also tags founder cards.

**3. Spot'd this month (Spotlight)**
- New `<HomepageSpotlight />` component on the landing page — surfaces the highest-SpotScore non-founder non-minor profile (≥30 score) of the month.
- Heading: **"Spot'd this month"** (per user direction).
- Hidden if no qualifying profile exists.
- Dashboard sidebar gains a Spotlight card: Elite users see `"You'll appear in the public Spotlight this month"`; Free/PRO/Founder users see `"Upgrade to Elite to get featured"` + CTA to /pricing.

**4. Email logo fix**
- All 5 email templates (auth OTP, welcome, founding-deadline, profile-completion-nudge ×3) now render the wordmark via inline HTML+CSS — `<span ...>spot<span style="color:#E8FC6C">'</span>d</span>` — instead of `<img>`. Works in Outlook/Gmail/Postmark even when remote image-loading is blocked.
- Helper: `core.email_logo_html(font_size=40)`.

**5. Lifetime PRO copy**
- All `"12 months of PRO"` → `"Lifetime free PRO"` across `routers/admin.py` (welcome email), `routers/scheduled.py` (founding-deadline reminder).
- Pricing page already used "lifetime free PRO" wording — no change needed.

**6. Cosmetic**
- Privacy + Terms `Contact:` updated to `hello@getspotd.app` (was Brendan's personal email).

Backend pytest: iter11 (14) + iter13 (15) + iter14 (12) = **41/41 PASS**.

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
