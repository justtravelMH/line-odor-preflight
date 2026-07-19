#!/usr/bin/env bash
set -euo pipefail

if git grep -nE 'sb_secret_[A-Za-z0-9_-]{10,}|SUPABASE_SECRET_KEY[[:space:]]*=[[:space:]]*[^$[:space:]]+' -- ':!scripts/secret-boundary.sh'; then
  echo "Potential Supabase server secret found in tracked files" >&2
  exit 1
fi

if git grep -nE '(NEXT_PUBLIC|VITE|PUBLIC)_.*(SECRET|SERVICE_ROLE)'; then
  echo "Server credential is exposed through a client-public variable" >&2
  exit 1
fi

echo "No Supabase server secret pattern found in tracked client assets"
