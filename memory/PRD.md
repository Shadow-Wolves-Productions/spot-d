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
### Iter 7 — Mobile UX polish (filters bottom sheet, ProfileHero stack, CreateProfile dot indicator, casting card mobile); CastingCallShareCard 1080×1080; SpotScoreHistory backfill + seed; anonymous create lockdown; smoke tests for SpotRequest/RoleAlert/ContactReveal/SpottedWith/AutoClaim flows (all PASS)
### Iter 8 (this session) — Landing page redesign with live data
- **`/api/public-stats` endpoint** — `{profile_count, role_count, casting_call_count, founder_count, founder_remaining}` (anonymous-readable)
- **HeroSection rewrite** — dynamic subheadline ("60 verified cast and crew profiles…"); live trust stats grid (profiles · roles · Instant); real-profile crossfade carousel in right column (3 cards, 4s cycle, dot pagination); subtle electric warmth gradient at 30% × 50%
- **`MiniProfileCard`** in hero — same branded apostrophe placeholder when no photo, shows SpotScore + Available now badge
- **FeaturedProfiles** — now 6 profiles in 3-col grid (was 8 in 4-col); excludes `is_minor_profile` defensively; "View full directory →" link
- **CastingCallsPreview** new section — shows up to 3 most-recent active calls with PostedByChip (company logo + name when posted_as=company); hidden entirely if zero active calls
- **LiveStatsBar** new section — 4 cells (profiles · roles · casting calls · Instant) using `/api/public-stats`
- **Why Spot'd tiles** — replaced with current platform terminology: Smart search · SpotScore trust · Frequently Spotted with · Spot them · Direct contact · Casting calls (removed Worked with, Endorsements, IMDb integration)
- **HowItWorks step 2** — copy updated to mention SpotScore + peer Spots + verified credentials + project credits
- **Founding member section** — live `<X> of 500 founding spots claimed` counter; PRO benefits list updated to 6 current items
- **ProfileCard branded placeholder** — replaces grey film-frame icon with electric `#E8FC6C` apostrophe at 30% opacity on `#1A1A1A` bg, sized via container queries (`min(60cqw, 80cqh)`)

## Backlog (P0 — needed before launch)
- Real Stripe price IDs + flip dynamic-amount → fixed-price mode
- Twilio creds + flip SMS_MOCK_MODE
- Set production POSTMARK_WEBHOOK_SECRET + flip EMAIL_MOCK_MODE
- Migrate file uploads from local disk → S3/Cloudflare R2

## Backlog (P1)
- **Split server.py (~2120 lines) into routers** — overdue
- Move `data-testid` from inner `<Button>` onto wrapping `<Link>` so test selectors expose `href` correctly (called out in iter8 review)
- Pydantic body models for `create_entity` payloads (field-name consistency: target_profile_id vs profile_id, profile_a_id vs profile_id_a)

## Backlog (P2)
- PIL/imghdr image bytes verification on upload
- Strict-Transport-Security header
- Background-task migration for >10k profiles
- Admin profile flag should log {previous, new}
- ProfileCard placeholder fallback for browsers without container queries (acceptable to skip — modern target)

## Stats (this session)
- 60 visible profiles · 16 distinct roles · 1 active casting call · 1 founder
- Backend tests: iter8 100% PASS · iter7 16/17 · iter6 18/18 · iter4 13/13
- Frontend testids: iter8 100% verified (admin UI not re-checked due to Cloudflare bot challenge — already 100% in iter6)

## Test credentials
See `/app/memory/test_credentials.md` (admin: brendan@shadowwolvesproductions.com.au, passwordless OTP, founder tier).
