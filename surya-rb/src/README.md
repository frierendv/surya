# src

This directory contains the runtime code for Surya RB.

- `index.ts` — boots the app: connects database, loads plugins, launches socket, starts scheduler
- `handler/` — dispatching for messages and plugin execution
- `libs/` — shared utilities (logger, database, socket, scheduler, etc.)
- `plugins/` — built-in plugins grouped by purpose
- `scheduler/` — cron and interval jobs
- `types/` — shared and generated types

> [!IMPORTANT]
> See the README files inside each subfolder for deeper guidance.
