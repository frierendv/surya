# scheduler

Job scheduling using `@surya/job-scheduler`.

- `index.ts` — exports cron and interval job registries
- `crons/` — cron-based jobs, registered at startup
- `intervals/` — interval-based jobs, registered at startup

Runtime wiring lives in `src/libs/scheduler.ts`, which:

- Instantiates persistent `JobStore` (path via `SR_SCHEDULER_STORE_PATH`, default `./data/jobs.sqlite`)
- Creates `TimeScheduler` and `IntervalScheduler`
- Registers jobs, starts them, and listens for failures

> [!TIP]
> Add jobs by creating new files within `crons/` or `intervals/` and exporting handlers.
