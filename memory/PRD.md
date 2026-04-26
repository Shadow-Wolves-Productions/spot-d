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
### Iter 2 — Postmark, bulk import (57 CineConnect members), Stripe renewed handler, AgeGate, Minor performer toggle, Shareable SpotScore card
### Iter 3 — Bug fixes (photo upload, input focus), Postmark signature verification, file upload endpoints (/api/upload/*), reusable ImageUploader, Company Profile feature (3-tab directory, CompanyProfileCard, /create-company wizard, /c/[slug])
### Iter 4 — Multi-role profiles (`all_roles`), personal+company linked profiles on Dashboard, self-apply allowed, geo-proximity HTTPS, ensureAbsoluteUrl utility, test applications on Thunk
### Iter 5 — AnalyticsAdvanced + AutoClaimBanner + Notifications components created (wiring partially completed)
### Iter 6 (this session) — wiring + 6 user requests + 7-tab Admin
- **Analytics page wired** — AnalyticsAdvanced renders SpotScore History (90d), "Who saved you" (PRO+), "Who revealed contact" (Elite+) with tier-gated locked cards
- **Notifications page** — `/notifications` route wired, "Mark all read" button, item click marks-read+navigates, motion entry animations
- **AutoClaim banner** — auto-renders on `/dashboard` for imported users (welcome_email_sent=false), suggests top 3 quick wins, dismiss endpoint
- **Mobile bottom tabs (4)** — Directory · Casting · Inbox (with unread badge polled every 30s) · Dashboard
- **Casting Call attribution** — `/casting/new` shows "Post as: Personal / [Company1] / [Company2]" when user has ≥1 CompanyProfile; selecting prefills company name+logo+email; saved call persists `posted_as`, `posted_as_company_id/slug/name/logo`. Card on `/casting` shows "Posted by <Company>" chip linking to `/c/[slug]`
- **Also on Spot'd cross-link** — `/u/[slug]` shows linked Company tiles (any CompanyProfile owned by same user_id). `/c/[slug]` already shows Team grid for `team_members` array
- **Profile completion nudge email** — `_send_profile_completion_nudges` runs daily at 15:00 UTC. Sends one Postmark nudge to users with SpotScore<40, 48h after completing first login (welcome_email_sent or auto_claim_dismissed), tracked via `nudge_email_sent` boolean. Admin-trigger endpoint `/api/functions/sendProfileCompletionNudges`
- **Directory hide enforcement** — `/api/entities/Profile` listing now filters out `is_hidden=True` at backend (defense-in-depth + frontend filter)
- **Minor performer safeguarding** — Default-hidden in Talent tab; "Include minor performers" toggle (visible only on Talent tab). ProfileCard shows amber "Minor" badge
- **7-tab Admin Dashboard** — Users · Profiles · Casting · Imports · Emails · Platform · Stats · Logs (8 tabs total, including Logs). Profile-level Hide/Unhide button writes admin_logs. Imports tab shows 59 founding members with Claimed/Pending status. Emails tab shows email_log + "Run completion nudges now" button. Platform tab shows env + mock state + counts. Logs tab shows admin action audit trail
- **AdminLogs collection** — every flag action persists `{actor_id, action, target, meta, created_date}` in `admin_logs`
- **base44Client.integrations.Core.UploadFile shim** — fixed missing integration that CreateCastingCall needed for company logo upload

## Backlog (P0 — needed before launch)
- Real Stripe price IDs + flip dynamic-amount → fixed-price mode
- Twilio creds + flip SMS_MOCK_MODE
- Set production POSTMARK_WEBHOOK_SECRET + flip EMAIL_MOCK_MODE
- Migrate file uploads from local disk → S3/Cloudflare R2

## Backlog (P1)
- Mobile UX polish — Filters bottom-sheet on mobile (currently inline collapse)
- ProfileHero stack on mobile (already mostly responsive)
- CreateProfile mobile stacking polish
- Confirm Spot'd flows end-to-end:
  - SpotRequest send → receive → accept/decline → Spot+notification+score update
  - RoleAlert match → notification when matching CastingCall posted
  - ContactReveal count decrements + monthly reset
  - SpottedWith nightly job + section populates on profile

## Backlog (P2)
- Split server.py (~2050 lines) into routers (auth, entities, analytics, admin, functions, stripe)
- PIL/imghdr image bytes verification on upload
- Strict-Transport-Security header
- Background-task migration for >10k profiles
- Seed initial SpotScoreHistory snapshot on profile creation (so new users see chart immediately)
- Admin profile flag should log {previous, new} for full auditability
- Lock down POST /api/entities/Profile to authenticated users only

## Stats (this session)
- 73 users · 60 profiles · 59 imports (all unclaimed)
- Backend tests: 18/18 PASS in iteration_6
- Frontend testids: 8/8 verified in source; 3 surfaces require seeded company/casting data for visual confirmation
- Admin endpoints: /api/admin/{logs,imports,emails,platform,casting-calls} + /api/admin/profile/{id}/flag

## Test credentials
See `/app/memory/test_credentials.md` (admin: brendan@shadowwolvesproductions.com.au, passwordless OTP, founder tier).
