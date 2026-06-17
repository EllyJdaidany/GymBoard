# Fullstack Monorepo

A monorepo with a React frontend and a FastAPI backend.

## Structure

```
.
├── frontend/   # React + Vite + Tailwind
└── backend/    # FastAPI + uvicorn
```

## Prerequisites

- Node.js 18+
- Python 3.11+

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at [http://localhost:8000](http://localhost:8000).

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173).

## Database

The schema lives in `supabase/migrations/`. Core tables:

| Table | Purpose |
|---|---|
| `member` | Gym members |
| `gym_pr` | Gym-logged personal records |
| `pr_board_entry` | Best squat/bench/deadlift per member (from OPL + gym) |
| `opl_sync_log` | OPL sync and matching run history |

Meet history is not stored locally — it is fetched from the OPL API on sync and reduced to best lifts in `pr_board_entry`.

Apply via the Supabase SQL editor, or with the Supabase CLI:

```bash
supabase db push
```

## Environment

Copy `backend/.env.example` to `backend/.env` and fill in your values.

Meet data is fetched from [Close Powerlifting](https://closepowerlifting.com/) (`OPL_API_BASE_URL`), which wraps the OpenPowerlifting public dataset.
