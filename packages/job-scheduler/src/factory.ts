import { createLogger, type Logger } from "@surya/core/logger";
import { IntervalScheduler } from "./interval-scheduler";
import { JobStore } from "./sqlite";
import { TimeScheduler } from "./time-scheduler";

export interface CreateJobSchedulersOptions {
	dbPath?: string;
	logger?: Logger;
	autostart?: boolean;
}

export interface JobSchedulers {
	store: JobStore;
	time: TimeScheduler;
	interval: IntervalScheduler;
	start(): void;
	stop(): void;
	close(): void;
}

export function createJobSchedulers(
	opts: CreateJobSchedulersOptions = {}
): JobSchedulers {
	const store = new JobStore(opts.dbPath);
	const logger = opts.logger ?? createLogger({ name: "job-schedulers" });
	const time = new TimeScheduler(store, {
		logger: logger.child({ name: "time" }),
	});
	const interval = new IntervalScheduler(store, {
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
	};

	if (opts.autostart ?? true) {
		api.start();
	}

	return api;
}

export default createJobSchedulers;
