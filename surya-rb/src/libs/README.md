# surya-rb/libs

Cross-cutting utilities used across the surya-rb runtime.

## Key modules

- `logger.ts` — Pino-based logger. Level via `LOG_LEVEL`. Exports `logger` and `baileysLogger`.
- `mongodb.ts` — shared Mongoose connection helpers. Uses `SR_MONGODB_URI` / `SR_MONGODB_DB_NAME`.
- `database.ts` — wraps `@surya/database` for JSON store and optional Mongo connection.
- `plugin-manager.ts` — loads plugins from `src/plugins` in dev and `dist/plugins` in prod; watches changes in dev.
- `scheduler.ts` — wires `@surya/job-scheduler` (cron + interval), persistent store via `SR_SCHEDULER_STORE_PATH`.
- `sticker.ts`, `fetch.ts`, `performance.ts`, `auth-provider.ts` — feature helpers.

## Conventions

- Import logger from here for consistent formatting
- Prefer small modules with focused responsibilities

---
