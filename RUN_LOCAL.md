# Run Locally

This project requires `pnpm` and PostgreSQL.

## Important for this machine

The project is on `/run/media/...`, and that mounted drive blocks symlinks. `pnpm install` fails there.

Use a Linux-native folder for running:

```bash
cp -a /run/media/soularch/CrossDrive/Projects/dsms/Steel-Ledger /tmp/Steel-Ledger-run
cd /tmp/Steel-Ledger-run
npx pnpm install --ignore-scripts
```

Before starting, make sure `8080` and `8081` are free. If one is already in use, stop the existing backend/frontend first.

## Environment

Set these values before running the API:

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
export SESSION_SECRET="change-this-secret"
```

For local frontend:

```bash
export BASE_PATH="/"
```

## Database

Push the database schema:

```bash
npx pnpm --filter @workspace/db run push
```

## Start API

Terminal 1:

```bash
cd /tmp/Steel-Ledger-run
PORT=8080 DATABASE_URL="$DATABASE_URL" SESSION_SECRET="$SESSION_SECRET" npx pnpm --filter @workspace/api-server run dev
```

API runs at:

```text
http://localhost:8080/api
```

Health check:

```text
http://localhost:8080/api/healthz
```

## Start Frontend

Terminal 2:

```bash
cd /tmp/Steel-Ledger-run
PORT=8081 BASE_PATH=/ API_PROXY_TARGET=http://127.0.0.1:8080 npx pnpm --filter @workspace/dsms run dev
```

Frontend runs at:

```text
http://localhost:8081
```

## Default Login

From `replit.md`:

```text
admin / admin123
production / admin123
dispatch / admin123
viewer / admin123
```

The database must contain these users for login to work.
