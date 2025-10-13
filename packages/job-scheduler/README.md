# @surya/job-scheduler

SQLite-backed in-process job scheduling for Node.js.

- Time and cron-jobs-like via `node-schedule`
- Interval jobs via `toad-scheduler`
- Persistence using `better-sqlite3`
- Pause, resume, cancel controls
- Retry backoff for failures

## Install

This package is part of the monorepo and built with tsup. Ensure peer packages are built.

## API

### Store

- `new JobStore(dbPath?: string)` – SQLite-backed store (default `./data/jobs.sqlite`).

### Time/Cron Scheduler (Schedule)

- `new Schedule(store, { logger? })`
- `register(key, handler)` – register a handler for jobs with `handlerKey = key`.
- `start()` / `stop()` – load and schedule jobs from DB.
- `scheduleAt(name, when, handlerKey, payload?, { maxRetries?, backoffMs? })`
- `scheduleCron(name, cronExpr, handlerKey, payload?, { maxRetries?, backoffMs? })`
- `pause(id)` / `resume(id)` / `cancel(id)`

Handler signature: `(payload, job) => Promise<void> | void`.

### Interval Scheduler (Scheduler)

- `new Scheduler(store, { logger? })`
- `register(key, handler)`
- `start()` / `stop()`
- `add(name, everyMs, handlerKey, payload?, { maxRuns?, maxRetries?, backoffMs? })`
- `pause(id)` / `resume(id)` / `remove(id)`

`maxRuns` completes and deactivates the job after N successful runs.

### Factory

- `createJobSchedulers({ dbPath?, logger?, autostart? = true })`

Returns `{ store, time, interval, start(), stop(), close() }` with a shared `JobStore` and both schedulers. If `autostart` is true (default), both schedulers start immediately.

## Quick Start

```ts
import { createJobSchedulers } from "@surya/job-scheduler"; // or package export if configured

const app = createJobSchedulers();

app.time.register("send-email", async (payload) => {
  // send email
});

app.time.scheduleAt("welcome-email", Date.now() + 60_000, "send-email", { to: "user@example.com" }, { maxRetries: 3, backoffMs: 2000 });

app.interval.register("refresh", async () => { /* work */ });
app.interval.add("refresh-cache", 15_000, "refresh", undefined, { maxRuns: null });

// app.stop(); app.close();
```

## Notes

- Handlers must be registered before jobs execute. Jobs are looked up by `handlerKey`.
- On restart, active jobs are reloaded from DB and scheduled.
- Cron jobs remain active across runs; time jobs deactivate after completion.
- Interval jobs can gate retries using backoff by setting a future `runAt`.

## License

This package follows the repository license (see top-level `LICENSE`).
