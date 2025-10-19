import { logger } from "@/libs/logger";
import { cronJobs, intervalJobs } from "@/scheduler";
import type { Logger } from "@surya/core/logger";
import { readEnv } from "@surya/core/read-env";
import {
	IntervalScheduler,
	JobStore,
	TimeScheduler,
} from "@surya/job-scheduler";
import type { JobRecord } from "@surya/job-scheduler";

const store = new JobStore(
	readEnv("SR_SCHEDULER_STORE_PATH", {
		defaultValue: "./data/jobs.sqlite",
	})
);

const time = new TimeScheduler(store, {
	logger: logger as unknown as Logger,
}).registerMany(cronJobs);
const interval = new IntervalScheduler(store, {
	logger: logger as unknown as Logger,
}).registerMany(intervalJobs);

const jobErrorHandler = (job: JobRecord, err: unknown) => {
	logger.error({ ...job }, "Job failed", err);
	store.removeJob(job.id);
};

for (const cron of cronJobs) {
	// schedule cron jobs
	time.scheduleCron(
		cron.handlerKey,
		cron.cronExpr,
		cron.handlerKey,
		undefined,
		cron.cronOptions
	);
}

interval.on("job:failure", (job, err) => {
	const matched = intervalJobs.find((j) => j?.handlerKey === job?.handlerKey);
	if (matched?.onError) {
		matched.onError(job as JobRecord<any>, err);
		return;
	}
	jobErrorHandler(job, err);
});
time.on("job:failure", jobErrorHandler);

export const scheduler = {
	time,
	interval,
	store,
	start() {
		time.start();
		interval.start();
	},
	stop() {
		time.stop();
		interval.stop();
	},
	close() {
		scheduler.stop();
		store.close();
	},
};
export { time, interval, store };
