# Spot'd

A professional directory and discovery platform for the Australian film and television industry — connecting cast, crew, and creative talent.

## Stack

- **Frontend** — React + Vite + Tailwind CSS + shadcn/ui
- **Backend** — Python / FastAPI
- **Database** — MongoDB
- **Platform** — Emergent (hosting + auth + entity layer)

## Local development

1. Clone the repo
2. Install frontend dependencies: `npm install`
3. Create a `.env.local` file at the root with the required environment variables (contact the team for values)
4. Run the dev server: `npm run dev`

## Key areas

| Path | Description |
|---|---|
| `frontend/src/pages/` | Page-level components (Dashboard, SearchDirectory, ProfilePage, Projects, etc.) |
| `frontend/src/components/` | Shared UI components (ProfileCard, ProfileHero, Layout, etc.) |
| `backend/` | FastAPI routers, models, and server entry point |
| `base44/` | Entity schemas and platform function definitions |

## Deployment

Changes pushed to `main` are deployed automatically via Emergent.
