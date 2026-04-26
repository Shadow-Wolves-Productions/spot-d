# Spot'd Test Credentials

## Auth Flow
Spot'd uses **passwordless OTP login** — there is no password field anywhere.

### Sign-in steps
1. Visit `/login`
2. Enter email
3. Backend sends 6-digit code to email (mocked in dev — see notes below)
4. **DEV MODE**: the API returns `dev_code` in the response body (also displayed in UI)
5. Enter code on `/login` step 2 → JWT token stored in localStorage as `spotd_token`

## Seeded Admin Account
- **Email**: `brendan@shadowwolvesproductions.com.au`
- **Role**: `admin`
- **Tier**: `founder` (lifetime, unlimited)
- **Profile slug**: `brendanbyrneofficial`
- **Profile URL**: `/u/brendanbyrneofficial`
- **SpotScore**: 41, Percentile: 99
- **Casting call**: "Thunk" (active, deadline +60 days)

To sign in as admin:
```bash
API="https://514d4fe8-96b5-4176-a74d-566d3fdc3043.preview.emergentagent.com"
RES=$(curl -s -X POST "$API/api/auth/request-code" \
  -H "Content-Type: application/json" \
  -d '{"email":"brendan@shadowwolvesproductions.com.au"}')
CODE=$(echo "$RES" | python3 -c "import sys,json;print(json.load(sys.stdin)['dev_code'])")
TOKEN=$(curl -s -X POST "$API/api/auth/verify-code" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"brendan@shadowwolvesproductions.com.au\",\"code\":\"$CODE\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl "$API/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

## Test User
Any new email registered via `/login` will become a `user` role with no profile.
After verification, the user is redirected to `/create-profile`.

## Mock Mode
Email and SMS are **mocked** by default (env: `EMAIL_MOCK_MODE=true`, `SMS_MOCK_MODE=true`).
- Generated codes are returned in `dev_code` field of the API response
- Codes are also written to `email_log` / `sms_log` MongoDB collections
- Real keys (Postmark / Twilio) can be added later — set `EMAIL_MOCK_MODE=false` after adding key

## Stripe
Using `STRIPE_API_KEY=sk_test_emergent` (Emergent test key). Real price IDs will be
populated by the user later. Checkout uses dynamic-amount mode so it works without
configured price IDs in dev.

## Endpoints (auth)
- `POST /api/auth/request-code` — body `{email}` → `{success, dev_code?}`
- `POST /api/auth/verify-code`  — body `{email, code}` → `{token, user, profile}`
- `GET  /api/auth/me`           — Bearer token → user
- `POST /api/auth/logout`       — clears cookie

## Token storage
- `localStorage.spotd_token` (frontend)
- Cookie `spotd_token` (also set, optional)
