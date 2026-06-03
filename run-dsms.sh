#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="/run/media/soularch/CrossDrive/Projects/dsms/Steel-Ledger"
RUN_DIR="/tmp/Steel-Ledger-run"
API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-8081}"
SESSION_SECRET="${SESSION_SECRET:-dev-secret}"

port_in_use() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$port )" | tail -n +2 | grep -q .
    return $?
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  return 1
}

if [ ! -d "$RUN_DIR" ]; then
  echo "Creating runnable copy at $RUN_DIR"
  cp -a "$SOURCE_DIR" "$RUN_DIR"
fi

cd "$RUN_DIR"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
elif [ -f "$SOURCE_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$SOURCE_DIR/.env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is missing."
  echo "Create /tmp/Steel-Ledger-run/.env with:"
  echo 'DATABASE_URL="your_postgres_url"'
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npx pnpm install --ignore-scripts
fi

if port_in_use "$API_PORT"; then
  echo "Port $API_PORT is already in use."
  echo "Stop the existing backend before starting DSMS."
  exit 1
fi

if port_in_use "$WEB_PORT"; then
  echo "Port $WEB_PORT is already in use."
  echo "Stop the existing frontend before starting DSMS."
  exit 1
fi

cleanup() {
  echo
  echo "Stopping DSMS..."
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Starting backend on http://localhost:$API_PORT"
PORT="$API_PORT" \
DATABASE_URL="$DATABASE_URL" \
SESSION_SECRET="$SESSION_SECRET" \
npx pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "Starting frontend on http://localhost:$WEB_PORT"
PORT="$WEB_PORT" \
BASE_PATH="/" \
API_PROXY_TARGET="http://127.0.0.1:$API_PORT" \
npx pnpm --filter @workspace/dsms run dev &
WEB_PID=$!

echo
echo "DSMS is starting:"
echo "Frontend: http://localhost:$WEB_PORT"
echo "Backend:  http://localhost:$API_PORT/api/healthz"
echo "Press Ctrl+C to stop both."
echo

wait "$API_PID" "$WEB_PID"
