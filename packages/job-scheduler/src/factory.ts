import { createLogger, type Logger } from "@surya/core/logger";
import { IntervalScheduler } from "./interval-scheduler";
import { JobStore } from "./sqlite";
import { TimeScheduler } from "./time-scheduler";
import type { JobRegistry } from "./types";

export interface CreateJobSchedulersOptions {
	dbPath?: string;
	logger?: Logger;
	autostart?: boolean;
}

export interface JobSchedulers {
	store: JobStore;
	/**
	 * Time scheduler. For one-off and cron-like jobs.
	 */
	time: TimeScheduler<JobRegistry>;
	/**
	 * Interval scheduler. For repeating jobs with fixed intervals.
	 */
	interval: IntervalScheduler<JobRegistry>;
	/**
	 * Start both schedulers.
	 */
	start(): void;
	/**
	 * Stop both schedulers.
	 */
	stop(): void;
	/**
	 * Stop both schedulers and close the job store.
	 */
	close(): void;
	/**
	 * Clear all jobs in the job store.
	 */
	clearAllJob(): void;
}

export const createJobSchedulers = (
	opts: CreateJobSchedulersOptions = {}
): JobSchedulers => {
	const store = new JobStore(opts.dbPath);
	const logger = opts.logger ?? createLogger({ name: "job-schedulers" });

	const time = new TimeScheduler<JobRegistry>(store, {
		logger: logger.child({ name: "time" }),
	});
	const interval = new IntervalScheduler<JobRegistry>(store, {
		logger: logger.child({ name: "interval" }),
	});

	const api: JobSchedulers = {
		store,
		time,
		interval,
		start() {
			time.start();
			interval.start();
		},
		stop() {
			time.stop();
			interval.stop();
		},
		close() {
			api.stop();
			store.close();
		},
		clearAllJob() {
			try {
				const timers = (
					time as unknown as {
						timers: Map<string, { cancel: () => void }>;
					}
				).timers;
				for (const t of timers.values()) {
					t.cancel();
				}
				timers.clear();

				// Fast-clear interval jobs: remove from scheduler, then clear the map once.
				const intervalInternals = interval as unknown as {
					jobs: Map<string, { id?: string | number }>;
					scheduler: { removeById: (id: string | number) => void };
				};
				for (const job of intervalInternals.jobs.values()) {
					if (job?.id != null) {
						intervalInternals.scheduler.removeById(job.id);
					}
				}
				intervalInternals.jobs.clear();
			} catch (error) {
				logger.error("Failed to clear all jobs", { error });
			} finally {
				store.clearAllJob();
			}
		},
	};

	if (opts.autostart ?? true) {
		api.start();
	}

	return api;
};
