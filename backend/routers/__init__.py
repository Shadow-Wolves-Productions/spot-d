"""
Spot'd backend — router package.

Each router owns a logical slice of the API surface:
  • auth       — passwordless OTP login + /me + logout
  • entities   — generic CRUD over the 19 entity collections
  • profiles   — profile-specific endpoints (view counts, …)
  • casting    — casting-call-specific endpoints (view counts, …)
  • uploads    — file upload endpoints (profile photos, posters, …)
  • webhooks   — Stripe + Postmark webhook receivers
  • admin      — admin-only routes (logs, imports, platform-settings, …)
  • scheduled  — server-side scheduled jobs exposed as POST functions
  • public     — health, public-stats, OG images, waitlist, etc.

Routers import only from ``core`` and ``models`` — never from ``server``.
"""
