# Spot'd — Product Requirements Document

**Tagline:** Indie film cast & crew discovery — "IMDb Pro meets Slated for indie."

## Tech Stack
- React 18 + Vite, TailwindCSS, shadcn/ui, framer-motion, html2canvas
- FastAPI + MongoDB
- Auth: passwordless OTP + JWT
- Stripe via emergentintegrations
- Postmark email + Twilio SMS (currently mocked)
- APScheduler

## Implemented (cumulative through Jan 2026)

### Iter 1 — Foundation: full migration from Base44 (auth, entities, functions, Stripe, scheduled jobs, /login /welcome /terms /privacy)
### Iter 2 — Postmark, bulk import (57 CineConnect members), Stripe renewed handler, AgeGate, Minor performer toggle, Shareable SpotScore card
### Iter 3 — Bug fixes (photo upload, input focus), Postmark signature verification, file upload endpoints (/api/upload/*), reusable ImageUploader, Company Profile feature (3-tab directory, CompanyProfileCard, /create-company wizard, /c/[slug])
### Iter 4 (this session)
- **Multi-role profiles** — `all_roles` field auto-computed on Profile create/update (union of primary + secondary), one-time migration on startup. Directory tabs query `all_roles` so a profile like Brendan (Producer + Actor + Writer) appears in BOTH Talent and Crew tabs. Card shows context-relevant role (`PRODUCER · Also: Actor, Writer` in Crew tab; `ACTOR` in Talent tab).
- **Personal + Company linked profiles** — Dashboard shows "Your profiles" section with personal + company cards (or empty-state "Create company profile" placeholder). Nav dropdown ("My profile (Personal)" / "My profile (Company)" / "Create personal/company profile" — driven off the user's owned profiles).
- **Self-apply allowed** — Creator can apply to their own casting call ("Apply as crew/cast" button). Auto side effects: increments application_count, adds project to applicant's `Profile.credits`, runs SpottedWith matching, suppresses self-notification. "Creator" badge in the kanban for self-applies.
- **3 test applications on Thunk** — Brendan (self-apply, shortlisted), Sofia Poli (1st AD, pending), Mitchell Baines (1st AC, viewed). `application_count = 3`.
- **Geo proximity UX** — improved error states (denied / timeout / insecure context all show "Enter city manually"), 10s timeout, 5min cache.
- **HTTPS redirect middleware** — only active when `ENV=production` (no redirect loops in dev).
- **ensureAbsoluteUrl utility** (`/app/frontend/src/lib/url.js`) — `imdb_link`, `showreel_link`, `website`, `linkedin`, `resume_url`, `reel_link`, `past_productions[].link` all normalised to `https://...` on save (CreateProfile + CreateCompany) AND on render (ProfileHero, ProfileCard, ProfileSections, CompanyProfilePage). `ensureMailto` for emails.
- **`data-testid="user-menu-trigger"` + `data-testid="user-dropdown"`** for stable test automation against the nav profile-switcher.

## Backlog (P0 — needed before launch)
- Real Stripe price IDs + flip dynamic-amount → fixed-price mode
- Twilio creds + flip SMS_MOCK_MODE
- Set production POSTMARK_WEBHOOK_SECRET + flip EMAIL_MOCK_MODE
- Migrate file uploads from local disk → S3/Cloudflare R2

## Backlog (P1)
- Analytics dashboard completion ("Who saved you" / "Who revealed contact" tier-gated, SpotScoreHistory entity + nightly snapshots, full charts)
- Mobile UX polish (4-tab bottom bar with notifications, filters bottom sheet, ProfileHero stack)
- CastingCall company attribution (post as personal vs company picker)
- "Also on Spot'd" cross-link section between personal + company profile pages

## Backlog (P2)
- Split server.py (~1700 lines) into routers
- PIL/imghdr image bytes verification
- Strict-Transport-Security header
- Background-task migration for >10k profiles
- Admin tier toggle (free↔pro) protecting elite/founder

## Stats
- 60 profiles · 57 PRO + 1 founder + 0 expired
- 1 active casting call (Thunk) · 3 applications
- All-pass tests: iter1 21/21 · iter2 10/10 · iter3 11/11 · iter4 13/13 = 55/55 backend
