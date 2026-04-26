# Spot'd — Product Requirements Document

**Tagline:** Indie film cast & crew discovery — "IMDb Pro meets Slated for indie."
**URL:** getspotd.app
**Platform:** Emergent (migrated from Base44)

## Tech Stack
- Frontend: React 18 + Vite, TailwindCSS, shadcn/ui, framer-motion, react-router-dom, html2canvas
- Backend: FastAPI + MongoDB (Motor)
- Auth: Passwordless OTP (email 6-digit code + JWT)
- Payments: Stripe via emergentintegrations
- Email: Postmark (key wired, mock mode ON until launch)
- SMS: Twilio (placeholder, mock mode ON)
- Scheduler: APScheduler

## Implemented (cumulative through Jan 2026)

### Iteration 1 — Foundation
- Project restructured (frontend/ + backend/), all entity collections, OTP login, generic entity REST mirroring Base44 SDK, all 11 named functions, SpotScore + percentile, Stripe Checkout, scheduled jobs, /login /welcome /terms /privacy, brand styling, admin seed.

### Iteration 2 — Postmark/Imports/Age Gate/Share
- Postmark integration with webhook handler
- Bulk import of 57 CineConnect founding members (PRO 12mo, idempotent)
- Stripe customer.subscription.renewed handler (extends expires_at)
- AgeGate component on /create-profile (18+ + minor consent)
- Minor performer toggle + Responsible Adult fields
- Shareable SpotScore card (1080×1920 + 1080×1080 PNG via html2canvas)

### Iteration 3 — Bug Fixes + Company Profiles + Uploads
- **Bug fix**: photo upload now uses real backend (was calling non-existent base44 SDK method)
- **Bug fix**: input focus loss eliminated by moving TagInput component to module scope (was defined inside CreateProfile, causing remount on every keystroke)
- **Postmark webhook signature verification** — HMAC-SHA256 base64 against `POSTMARK_WEBHOOK_SECRET`; rejects unsigned/invalid with 403
- **File upload endpoints**: `/api/upload/{profile-photo,headshot,company-logo,cover-image}` with 5MB cap, JPG/PNG/WEBP only, served at `/api/static/uploads/<type>/<id>.<ext>` (mounted under /api/ so the K8s ingress routes it correctly)
- **ImageUploader** reusable component with drag-drop, preview, replace, remove
- **Company Profiles**:
  - 3-tab directory (Talent / Crew / Companies) — default Crew
  - `CompanyProfileCard` grid card with logo / type badge / SpotScore / location
  - `/create-company` 4-step wizard (Basics, Location & Contact, Portfolio, Review) with logo + cover upload, slug editor, services tags, past productions array
  - `/c/[slug]` company profile page with cover banner, contact strip, services, showreel, productions list, team links
  - "Company profile" CTA on Dashboard
- **ProfileCard** fixes: data-testid added; nested `<a>` (IMDb badge) replaced with `<span role="link">` to avoid invalid HTML

## Backlog (P0 — needed before public launch)
- [ ] Real Stripe price IDs (pro_monthly, pro_annual, elite_monthly, elite_annual)
- [ ] Twilio creds + flip SMS_MOCK_MODE
- [ ] Set production POSTMARK_WEBHOOK_SECRET (currently `spotd-dev-postmark-secret-rotate-me`)
- [ ] Flip EMAIL_MOCK_MODE=false when ready
- [ ] Migrate file uploads from local disk to S3/Cloudflare R2 (current MVP writes to /app/backend/static/uploads/)
- [ ] Stream-based upload size cap (currently buffers full file before checking 5MB limit)

## Backlog (P1 — analytics + mobile UX, partial)
- [ ] Analytics dashboard completion: full charts (already partial), "Who saved you" (PRO/Elite), "Who revealed your contact" (Elite only), SpotScoreHistory entity + nightly snapshot
- [ ] Mobile bottom-tab bar — add Notifications tab (4 tabs)
- [ ] SearchFilters in mobile bottom sheet
- [ ] ProfileHero stack on mobile (photo full-width, SpotScore below, full-width CTA)
- [ ] Pull-to-refresh confirm on Dashboard / CastingCalls
- [ ] Skeleton loaders on remaining pages

## Backlog (P2)
- [ ] Server.py refactor — split into routers/auth, routers/entities, routers/functions, routers/uploads, routers/stripe, routers/webhooks, routers/companies (~1600 lines now)
- [ ] PIL/imghdr verification of uploaded image bytes vs declared content-type
- [ ] Admin actions: tier toggle (free↔pro only), boost on/off
- [ ] Move SpotScore recalc to background queue
- [ ] startup warning when POSTMARK_WEBHOOK_SECRET is unset

## Stats
- 60+ profiles · 57 PRO subs · 1 founder sub (Brendan) · 499 founder spots remaining
- 1 active casting call (Thunk)
- 0 companies (will grow once Brendan/team add their own — `/create-company`)
- Test suites: iter1 (21/21) + iter2 (10/10) + iter3 (11/11) = all green

## Notes
- "spot_score" is canonical; Endorsement & WorkedWith deprecated
- All scheduled jobs run at 17:00 UTC (≈4am AEST)
- Governing law: NSW, Australia
- Any URL with "spotd.app" should be "getspotd.app"
