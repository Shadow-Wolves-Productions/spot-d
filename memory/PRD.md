# Spot'd — Product Requirements Document

**Tagline:** Indie film cast & crew discovery — "IMDb Pro meets Slated for indie."

## Tech Stack
- React 18 + Vite, TailwindCSS, shadcn/ui, framer-motion, html2canvas, recharts
- FastAPI + MongoDB
- Auth: passwordless OTP + JWT
- Stripe via emergentintegrations
- Postmark email + Twilio SMS (currently mocked)
- APScheduler

## Implemented (cumulative through Feb 2026)

### Iter 1 — Foundation: full migration from Base44 (auth, entities, functions, Stripe, scheduled jobs, /login /welcome /terms /privacy)
### Iter 2 — Postmark, bulk import, Stripe renewed handler, AgeGate, Minor performer toggle, Shareable SpotScore card
### Iter 3 — Bug fixes (photo upload, input focus), Postmark signature verification, file upload endpoints, Company Profile feature
### Iter 4 — Multi-role profiles (`all_roles`), personal+company linked profiles on Dashboard, self-apply allowed, geo-proximity HTTPS, ensureAbsoluteUrl utility
### Iter 5 — AnalyticsAdvanced + AutoClaimBanner + Notifications components created
### Iter 6 — Wired Analytics + Notifications + AutoClaim + 4-tab mobile bar; CastingCall company attribution; "Also on Spot'd" cross-link; profile completion nudge job; is_hidden enforcement; minor performer safeguard; 7-tab Admin Dashboard
### Iter 7 (this session) — Final mobile UX + share + lockdown
- **Filters bottom sheet** — `data-testid='mobile-filters-trigger'` opens sheet with active count badge; sheet has Apply (data-testid='mobile-filters-apply') + Clear all (data-testid='mobile-filters-clear') sticky footer
- **ProfileHero mobile stacking** — photo full-width aspect-[4/5], info section, SpotScore as full-width card below (data-testid='profile-hero-spotscore')
- **CreateProfile mobile dot indicator** — 4 numbered dots (filled/outlined/grey) replace text labels on `<sm`, with "Step X of 4 · <name>" caption
- **Casting Call cards mobile** — content + Apply button stack vertically full-width below `sm`; meta row uses gap-x/gap-y
- **CastingCallShareCard component** — 1080x1080 PNG via html2canvas with Spot'd wordmark + NOW CASTING orange chip + project title + role pills + location + comp + "Apply at getspotd.app" + company attribution. Web Share API + Download fallback. Wired to a Share button on every casting call card visible to all users (creators + talent) for organic distribution.
- **SpotScoreHistory seeding** — every new Profile gets one snapshot inserted at create time; `backfill_spot_score_history()` runs on startup and seeded all 60 existing profiles (chart never empty for new users)
- **Anonymous create lockdown** — `/api/entities/<X>` POST now requires auth except for telemetry (`ProfileView`, `SearchAppearance`, `PortfolioClick`, `VerificationCode`). Profile, CompanyProfile, CastingCall, CastingApplication, SpotRequest, SavedProfile, ContactReveal all return 401 without a JWT.
- **Liberal SpotRequest action input** — `/api/functions/respondToSpotRequest` now accepts both `accept`/`decline` shorthand and `accepted`/`declined` long form
- **Admin Imports endpoint enriched** — items now include `email` (joined from users collection) so the Imports tab UX can show contact info per row

### End-to-end flow smoke tests (PASS — all 5)
- (a) **SpotRequest** ✅ — request → accept → Spot row + spot_accepted notification + score recalculates
- (b) **RoleAlert** ✅ — alert + matching CastingCall → role_alert notification fires via sendRoleAlertNotifications
- (c) **ContactReveal** ✅ — reveal → analytics totals.reveals increments + month_key tracked
- (d) **SpottedWith** ✅ — shared `Thunk` credit → SpottedWith row created via runSpottedWithMatching
- (e) **AutoClaim** ✅ — eligible=true, suggestions returned, dismiss flips to eligible=false (verified at endpoint level)

## Backlog (P0 — needed before launch)
- Real Stripe price IDs + flip dynamic-amount → fixed-price mode
- Twilio creds + flip SMS_MOCK_MODE
- Set production POSTMARK_WEBHOOK_SECRET + flip EMAIL_MOCK_MODE
- Migrate file uploads from local disk → S3/Cloudflare R2

## Backlog (P1)
- **Split server.py (~2090 lines) into routers** — deferred from iter 7 due to risk; high priority before launch (auth, entities, profiles, casting, uploads, webhooks, admin, scheduled)
- Pydantic body models for create_entity payloads (ContactReveal field naming inconsistency surfaced in iter7 testing — `target_profile_id` vs `profile_id`)
- DRY: extract `_record_spot_score_snapshot(pid, score)` helper

## Backlog (P2)
- PIL/imghdr image bytes verification on upload
- Strict-Transport-Security header
- Background-task migration for >10k profiles
- Admin profile flag should log {previous, new} for full auditability

## Stats (this session)
- 73 users · 60 profiles · 59 imports (admin imports endpoint live + enriched with email)
- 60+ SpotScoreHistory rows (one per profile, seeded at startup)
- Backend tests: 16/17 PASS (1 skipped, non-regression) in iteration_7 + 18/18 in iteration_6
- Frontend: 100% testid coverage for iter7 surfaces (mobile filters, ProfileHero stacking, CreateProfile dots, casting share card)

## Test credentials
See `/app/memory/test_credentials.md` (admin: brendan@shadowwolvesproductions.com.au, passwordless OTP, founder tier).
