# Spot'd — Product Requirements Document

**Tagline:** Indie film cast & crew discovery — "IMDb Pro meets Slated for indie."
**URL:** getspotd.app
**Platform:** Emergent (migrated from Base44)

## Problem
Indie producers struggle to find verified cast/crew fast. Talent and crew struggle to get discovered.
Existing platforms target studio-scale production, not indies.

## Personas
- **Producer / Director** — needs to find verified talent quickly with direct contact.
- **Talent / Crew** — needs to be discovered, build credibility (SpotScore), get notified of relevant casting.
- **Admin (Brendan)** — operates the platform, manages tiers, boosts.

## Tech Stack
- Frontend: React 18 + Vite, TailwindCSS, shadcn/ui, framer-motion, react-router-dom
- Backend: FastAPI (Python) + MongoDB (Motor)
- Auth: Passwordless OTP (email 6-digit code + JWT)
- Payments: Stripe via emergentintegrations
- Email: Postmark (mocked until keys provided)
- SMS: Twilio (mocked until keys provided)
- Scheduler: APScheduler

## Architecture
- Generic entity REST: `/api/entities/{Entity}` (list/filter/CRUD) — mirrors Base44 SDK so the React frontend works unchanged.
- Named functions: `/api/functions/{name}` for SpotScore, welcome emails, role-alert matching, etc.
- Stripe: `/api/stripe/checkout`, `/api/stripe/status/{id}`, `/api/webhook/stripe`, `/api/stripe/founder-claim`.
- Auth: `/api/auth/request-code`, `/api/auth/verify-code`, `/api/auth/me`, `/api/auth/logout`.

## Implemented (v1 — Jan 2026)
- ✅ Project restructured to /app/frontend (Vite) + /app/backend (FastAPI).
- ✅ MongoDB schemas for all 17+ entities (Profile, Subscription, CastingCall, CastingApplication, Spot, SpotRequest, SavedProfile, ContactReveal, RoleAlert, Notification, SpottedWith, VerificationCode, ProfileView, PortfolioClick, SearchAppearance, CompanyProfile).
- ✅ Passwordless OTP login (request-code + verify-code), JWT in localStorage, with rate limit (3/10min) and 5-attempt lockout.
- ✅ Generic entity CRUD endpoints + filter/sort/limit query params.
- ✅ Functions: recalculateSpotScore (full formula), triggerSpotScore, sendVerificationCode, verifyCode, sendWelcomeEmail (dark-themed branded HTML), respondToSpotRequest, sendRoleAlertNotifications, runSpottedWithMatching, sendDailyWeeklyAlerts, purgeVerificationCodes, onCastingApplicationChange.
- ✅ SpotScore auto-recalculates on Profile, Spot, SavedProfile, ContactReveal, CastingApplication, CastingCall, SpottedWith mutations. Percentile recomputed across cohort.
- ✅ Stripe Checkout for PRO Monthly/Annual + Elite Monthly/Annual (AUD) using dynamic-amount mode. Founder $0 claim flow with 500-cap + idempotent.
- ✅ Frontend pages: Landing, SearchDirectory, ProfilePage, ProfileBySlug, CreateProfile, Dashboard, AdminDashboard, Analytics, Pricing, Casting, CastingApplicationsKanban, ContactFAQ — all preserved from original UX.
- ✅ NEW pages: /login (OTP UI), /welcome (post-payment), /terms, /privacy.
- ✅ Brand: dark #0D0D0D, electric yellow #E8FC6C primary, signal orange #FF5C35 accent, Sora/DM Sans/Space Mono fonts (preserved from existing CSS).
- ✅ Seeded admin: Brendan Byrne (admin role, founder tier, profile slug `brendanbyrneofficial`, SpotScore 41 / percentile 99, "Thunk" casting call active).
- ✅ Scheduled jobs: nightly SpottedWith matching (2am UTC), daily/weekly alert digests (17:00 UTC), code purge (3am UTC).
- ✅ Email/SMS mocked with `dev_code` returned in API response for development. Plug-in Postmark/Twilio when keys arrive.
- ✅ Testing: 21/21 backend tests pass; full OTP login E2E confirmed via testing agent.

## Backlog (P0 — needed before public launch)
- [ ] Real Stripe price IDs (pro_monthly, pro_annual, elite_monthly, elite_annual) — user will provide.
- [ ] Postmark API key + Twilio creds + flip mock mode flags.
- [ ] Bulk member import flow for ~58 PDF forms — extracts data, creates User+Profile+Subscription(PRO 12mo), sends welcome email.
- [ ] Age gate on registration (18+ check) + minor performer toggle UI on CreateProfile.
- [ ] Boom: real production domain (getspotd.app) DNS + asset hosting (profile photos, headshots, logos — currently linked URLs only).

## Backlog (P1)
- [ ] Company profile UI (data model already supports it) + 3rd directory tab.
- [ ] Analytics dashboard surfaces ProfileView/PortfolioClick/SearchAppearance counts to PRO/Elite users.
- [ ] Email digest templates (currently very plain HTML) — branded daily/weekly digest layouts.
- [ ] File uploads for headshots/logos/showreels (currently URL inputs).

## Backlog (P2)
- [ ] Stripe customer.subscription.renewed webhook to extend expires_at.
- [ ] Server-side admin actions: tier toggle (free↔pro only — protected for elite/founder), boost on/off.
- [ ] Score recalc moved to background queue (currently sync — may slow at scale).
- [ ] Split server.py (currently ~1300 lines) into modules.

## Key URLs
- App: https://getspotd.app (prod), preview: https://514d4fe8-96b5-4176-a74d-566d3fdc3043.preview.emergentagent.com
- Admin: brendan@shadowwolvesproductions.com.au

## Decisions / Notes
- Endorsement & WorkedWith entities deprecated (kept Endorsement as alias to Spot for legacy code paths).
- "spot_score" is the canonical field name — never "cine_score".
- Always use getspotd.app, never spotd.app, in emails and links.
- All times that matter for Australia run at 17:00 UTC (≈4am AEST).
- Governing law: NSW, Australia. Privacy: Privacy Act 1988 (Cth).
