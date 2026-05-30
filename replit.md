# Dasmesh Stock Management System (DSMS)

A production-grade stock management system for a steel/iron manufacturing company. Replaces an Excel-based stock register with a full-featured web application supporting daily production/dispatch tracking, automatic stock calculation, reports, and role-based access.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, Recharts, React Query, Wouter
- API: Express 5 (port 8080, mounted at `/api`)
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (HS256, 7-day expiry) via `SESSION_SECRET`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — all DB table definitions (source of truth)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks + Zod schemas
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/api-server/src/lib/` — shared server utilities (auth, stockEngine, auditLogger)
- `artifacts/dsms/src/` — React frontend (pages, components, context)

## Architecture decisions

- **Contract-first API**: OpenAPI spec drives codegen for both client hooks and Zod schemas; routes validate inputs against these schemas
- **Stock engine (transaction log)**: Closing stock = opening stock (base) + all production after base date − all dispatch after base date; no denormalized totals stored
- **JWT auth**: Bearer token in `Authorization` header; token stored in `localStorage` under `dsms_token`; `SESSION_SECRET` env var is the signing key
- **Role-based access**: 4 roles — admin (full), production (production entries), dispatch (dispatch entries), viewer (read-only)
- **Numeric fields**: Drizzle `numeric` type returns strings from DB; always call `parseFloat()` before arithmetic in route handlers

## Product

- **Dashboard**: KPI cards (total stock, today's production/dispatch, low-stock count), 12-month trend chart, top produced/dispatched, category breakdown pie chart
- **Stock Master**: CRUD for steel items (Category + Size + Length → auto itemCode)
- **Production / Dispatch**: Daily entry forms with date filters; full CRUD per role
- **Stock Register**: Excel-style daily view — Opening + Production − Dispatch = Closing for all active items
- **Stock Ledger**: Per-item movement history over a date range
- **Reports**: Daily, Monthly, Category, Production Summary, Dispatch Summary tabs
- **Audit Logs**: Full action trail (admin only)
- **Users**: User management with role assignment (admin only)
- **Settings**: Change password

## Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| production | admin123 | Production |
| dispatch | admin123 | Dispatch |
| viewer | admin123 | Viewer |

## Gotchas

- Always run `pnpm --filter @workspace/db run push` after schema changes, then restart the api-server workflow
- Run `pnpm --filter @workspace/api-spec run codegen` after OpenAPI spec changes, then restart the dsms workflow
- Drizzle `numeric` columns return strings — parse before arithmetic
- Express 5: no bare `*` wildcard; use `/{*splat}`; async handlers must return `Promise<void>`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
