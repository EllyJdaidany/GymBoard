#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
CSV="${CSV:-$ROOT/data/Catalyst-Members-061226.csv}"

if [[ ! -f "$BACKEND/.env" ]]; then
  echo "Missing backend/.env"
  echo "Copy backend/.env.example to backend/.env and set:"
  echo "  SUPABASE_URL=https://<project-ref>.supabase.co"
  echo "  SUPABASE_KEY=<service_role_key>"
  exit 1
fi

if [[ ! -f "$CSV" ]]; then
  echo "CSV not found: $CSV"
  exit 1
fi

echo "==> Applying Supabase migrations (if linked project is configured)"
if command -v supabase >/dev/null 2>&1; then
  (cd "$ROOT" && supabase db push) || echo "Skipping db push — run manually if needed"
else
  echo "Supabase CLI not found — apply migrations manually"
fi

echo "==> Installing backend dependencies"
cd "$BACKEND"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt email-validator

echo "==> Seeding members from CSV"
python scripts/seed_from_csv.py --csv "$CSV" "$@"

echo ""
echo "==> Start the stack in two terminals:"
echo "  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "  cd frontend && npm run dev"
echo ""
echo "Open http://localhost:5173/tv?mock=false for live PR board data"
