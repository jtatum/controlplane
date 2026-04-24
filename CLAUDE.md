# OpenClaw Control Plane

Self-service platform for Disney employees to provision and manage OpenClaw AI agent instances.

## Stack

- **Monorepo**: pnpm workspaces
- **API**: Fastify on ECS (`packages/api`)
- **Web UI**: React + Vite (`packages/web`)
- **Worker**: Temporal workflows (`packages/worker`)
- **Shared**: Drizzle ORM schema, Zod types, enums (`packages/shared`)
- **Database**: Postgres (Aurora in prod), migrations in `migrations/`
- **Orchestration**: Temporal (SaaS in prod, Docker Compose locally)

## Local Development

```bash
docker compose up -d    # Postgres + Temporal + Temporal UI
pnpm install
pnpm db:migrate         # Run migrations (needs DATABASE_URL)
pnpm dev:api            # Start API on :3000
pnpm dev:web            # Start web UI on :5173
pnpm dev:worker         # Start Temporal worker
```

Environment: `DATABASE_URL=postgresql://controlplane:controlplane@localhost:5432/controlplane`

## Commands

- `pnpm typecheck` — TypeScript project references check
- `pnpm test` — Vitest unit tests
- `pnpm db:generate` — Generate migration from schema changes
- `pnpm db:migrate` — Apply migrations
- `pnpm build` — Build all packages

## Data Model

12 tables: `users`, `agents`, `channels`, `channel_telegram`, `channel_email`, `email_messages`, `email_attachments`, `skills`, `agent_skills`, `openclaw_versions`, `provisioning_jobs`, `audit_log`.

Schema source of truth: `packages/shared/src/db/schema.ts`

## Architecture Notes

- Channels use table-per-type inheritance (generic `channels` + type-specific tables)
- Email is a runtime dependency — agents call the API to read/send, humans review/approve in the UI
- Agent status lifecycle: requested → provisioning → running → updating → stopping → stopped → terminated | error
- Auth: PKCE OIDC for humans, bearer token for agent-to-API calls
