# handler

Message and plugin dispatching.

- `message.ts` — entry for incoming messages; matches commands to plugins and prepares the execution context
- `plugin.ts` — helpers for executing a matched plugin with proper lifecycle hooks

> [!NOTE]
>
> - Keep handlers thin; place business logic inside plugins or lib utilities
> - Handlers should be resilient to missing/invalid messages and log errors via `libs/logger`
