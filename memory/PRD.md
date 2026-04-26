# Spot'd — Product Requirements Document

**Tagline:** Indie film cast & crew discovery — "IMDb Pro meets Slated for indie."
**URL:** getspotd.app
**Platform:** Emergent (migrated from Base44)

## Problem
Indie producers struggle to find verified cast/crew fast. Talent and crew struggle to get discovered.
Existing platforms target studio-scale production, not indies.

## Personas
- **Producer / Director** — needs verified talent quickly with direct contact.
- **Talent / Crew** — needs to be discovered, build credibility (SpotScore), get notified of relevant casting.
- **Admin (Brendan)** — operates the platform.

## Tech Stack
- Frontend: React 18 + Vite, TailwindCSS, shadcn/ui, framer-motion, react-router-dom, html2canvas
- Backend: FastAPI + MongoDB (Motor)
- Auth: Passwordless OTP (email 6-digit code + JWT)
- Payments: Stripe via emergentintegrations
- Email: Postmark (key wired, mock mode ON until launch)
- SMS: Twilio (placeholder, mock mode ON)
- Scheduler: APScheduler

## Implemented (v1.0 — Jan 2026)
- ✅ Project restructured to /app/frontend (Vite) + /app/backend (FastAPI)
- ✅ MongoDB schemas for all 17+ entities + payment_transactions + email/sms/postmark logs
- ✅ Passwordless OTP login (rate limit 3/10min, 5-attempt lockout)
- ✅ Generic entity REST endpoints + filter/sort/limit
- ✅ All 11 named functions: recalculateSpotScore, triggerSpotScore, sendVerificationCode, verifyCode, sendWelcomeEmail, respondToSpotRequest, sendRoleAlertNotifications, runSpottedWithMatching, sendDailyWeeklyAlerts, purgeVerificationCodes, onCastingApplicationChange
- ✅ SpotScore auto-recalculates + percentile recomputed across cohort
- ✅ Stripe Checkout (PRO/Elite Monthly+Annual, AUD) + Founder $0 claim flow with 500-cap + idempotent
- ✅ Frontend pages preserved: Landing, SearchDirectory, ProfilePage, ProfileBySlug, CreateProfile, Dashboard, AdminDashboard, Analytics, Pricing, Casting, CastingApplicationsKanban, ContactFAQ
- ✅ NEW pages: /login, /welcome, /terms, /privacy
- ✅ Brand: dark #0D0D0D, electric yellow #E8FC6C, signal orange #FF5C35
- ✅ Seeded admin: Brendan Byrne (founder, slug brendanbyrneofficial)
- ✅ Scheduled jobs: nightly SpottedWith matching, daily/weekly digests, code purge

## Iteration 2 (Jan 2026)
- ✅ **Postmark integration** — API key wired, webhook /api/webhooks/postmark stores events
- ✅ **Bulk import** of 57 CineConnect founding members via /api/admin/bulk-import
  - All have PRO 12-month subscriptions, payment_reference='cineconnect-import'
  - SpotScores recalculated across the new cohort
  - Idempotent — safe to re-run
- ✅ **Stripe customer.subscription.renewed** webhook handler — extends expires_at by 1yr/30d (was missing — could have caused annual subscribers to be auto-downgraded)
- ✅ **Age gate on registration** (/create-profile)
  - 18-or-older path requires Terms checkbox
  - Under-18 path requires both responsible adult consent + Terms
  - Persisted in localStorage so users don't re-see it
  - Skipped for existing profile edits
- ✅ **Minor performer profile** — toggle on Personal step + Responsible Adult section (name, relationship, email, phone)
- ✅ **Shareable SpotScore card** — `<ShareSpotScoreCard />` component
  - 1080×1920 (Stories) and 1080×1080 (Square) PNG output
  - Branded design: black bg, electric apostrophe, large score, percentile badge (TOP 1% / 5% / 10% / 25%), name, role, location, getspotd.app footer, subtle film-grain overlay
  - Download PNG + Web Share API native share (with download fallback)
  - Triggered from Dashboard SpotScore card

## Backlog (P0 — needed before public launch)
- [ ] Real Stripe price IDs (pro_monthly, pro_annual, elite_monthly, elite_annual) — switch from dynamic-amount to fixed-price mode when provided
- [ ] Twilio creds + flip SMS_MOCK_MODE
- [ ] Flip EMAIL_MOCK_MODE=false when ready (Postmark key already in .env)
- [ ] Add Postmark webhook signature verification (currently anyone can POST to /api/webhooks/postmark)

## Backlog (P1)
- [ ] Company profile UI (data model in place — adds 3rd directory tab)
- [ ] Analytics dashboard for PRO/Elite (ProfileView/PortfolioClick/SearchAppearance entities exist)
- [ ] Branded daily/weekly digest email templates (currently plain HTML)
- [ ] File uploads for headshots/logos/showreels (currently URL inputs)
- [ ] Hide contact fields on public profile listing for unauthenticated requests

## Backlog (P2)
- [ ] Admin actions: tier toggle (free↔pro only — protect elite/founder), boost on/off
- [ ] Move score recalc to background queue (currently sync per mutation)
- [ ] Split server.py (~1500 lines) into routers: auth/, entities/, functions/, stripe/, admin/

## Notes / Decisions
- "spot_score" is canonical (never cine_score). Endorsement & WorkedWith deprecated; Spot + SpottedWith are canonical.
- Always use getspotd.app, never spotd.app, in emails and links.
- All scheduled jobs run at 17:00 UTC (≈4am AEST, AU-first).
- Governing law: NSW, Australia. Privacy: Privacy Act 1988 (Cth).
- Bulk-import response includes `user_created` boolean per record to distinguish new vs reused users.

## Stats (post iteration 2)
- 60 profiles in DB (1 admin + 57 imported + 2 test)
- 57 PRO subscriptions
- 1 founder subscription (Brendan, 499 founder spots remaining)
- 1 active casting call (Thunk)
- 21 backend tests + 10 iteration-2 tests = all green
