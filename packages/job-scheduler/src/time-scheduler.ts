import { EventEmitter } from "@surya/core/events";
import { createLogger, type Logger } from "@surya/core/logger";
import schedule, {
	type Job as NodeJob,
	type RecurrenceRule,
} from "node-schedule";
import type { CreateCronJob, CreateTimeJob, JobRecord } from "./sqlite";
import { JobStore } from "./sqlite";
import type {
	JobHandler,
	JobRegistry,
	MergeRegistry,
	Registry,
	RetryPolicy,
	SchedulerEvents,
} from "./types";

export interface TimeSchedulerOptions {
	logger?: Logger;
}

/**
 * Time and cron-job-like scheduler using node-schedule for in-process timing and SQLite for persistence.
 */
export class TimeScheduler<
	Reg extends Registry = Registry,
> extends EventEmitter<SchedulerEvents> {
	private store: JobStore;
	private handlers = new Map<string, JobHandler<any>>();
	private timers = new Map<string, NodeJob>();
	private log: Logger;
	private running = false;

	constructor(store: JobStore, opts: TimeSchedulerOptions = {}) {
		super();
		this.store = store;
		this.log = opts.logger ?? createLogger({ name: "time-scheduler" });
	}

	/**
	 * Register a handler function.
	 */
	register<Key extends string, P = unknown>(
		key: Key,
		handler: JobHandler<P>
	): TimeScheduler<Registry<Key, P>> {
		this.handlers.set(key, handler);
		return this as TimeScheduler<Registry<Key, P>>;
	}
	/**
	 * Register multiple handler functions at once.
	 */
	public registerMany<const Arr extends readonly JobRegistry[]>(
		defs: Arr
	): TimeScheduler<MergeRegistry<Arr>> {
		for (const def of defs) {
			this.handlers.set(def.handlerKey, def.handler);
		}
		return this as unknown as TimeScheduler<MergeRegistry<Arr>>;
	}

	start() {
		if (this.running) {
			return;
		}
		this.running = true;
		const jobs = this.store.getActiveJobs(["time", "cron"]);
		for (const job of jobs) {
			if (job.paused) {
				continue;
			}
			if (job.kind === "time") {
				if (job.runAt && job.runAt <= Date.now()) {
					// schedule immediate run in next tick
					setTimeout(() => this.runOnce(job.id), 50);
					// keep reference but it's not a node-schedule Job
				} else if (job.runAt) {
					this.scheduleTime(job);
				}
			} else if (job.kind === "cron") {
				if (job.cronExpr) {
					this.scheduleCronInternal(job);
				}
			}
		}
		this.log.info("TimeScheduler started", { count: jobs.length });
	}

	stop() {
		for (const [id, j] of this.timers) {
			try {
				j.cancel();
			} catch (_err) {
				this.log.debug("cancel failed", { id });
			}
			this.timers.delete(id);
		}
		this.running = false;
		this.log.info("TimeScheduler stopped");
	}

	async runOnce(id: string) {
		const job = this.store.getJob(id);
		if (!job) {
			return;
		}
		if (job.paused || !job.active) {
			return;
		}
		const handler = this.handlers.get(job.handlerKey);
		if (!handler) {
			this.log.warn("No handler for job", {
				id,
				handlerKey: job.handlerKey,
			});
			return;
		}
		// atomic guard to avoid double run
		const started = this.store.tryMarkRunning(id);
		if (!started) {
			// already running or inactive
			return;
		}
		this.emit("job:start", job);
		try {
			await Promise.resolve(handler(job.payload, job));
			if (job.kind === "time") {
				this.store.completeAndDeactivate(id);
				const after = this.store.getJob(id) ?? job;
				this.emit("job:success", after);
				this.emit("job:finish", after);
				const j = this.timers.get(id);
				if (j) {
					j.cancel();
					this.timers.delete(id);
				}
			} else {
				// cron: leave active, will run again by schedule
				this.store.markSuccess(id);
				const after = this.store.getJob(id) ?? job;
				this.emit("job:success", after);
			}
			this.log.success("Job done", { id });
		} catch (err: any) {
			const msg = (err?.message ?? String(err)) as string;
			this.store.markFailure(id, msg);
			const after = this.store.getJob(id) ?? job;
			this.emit("job:failure", after, err);
			// retries only meaningful for 'time' jobs (single-run)
			if (job.kind === "time") {
				const fresh = this.store.getJob(id)!;
				if (fresh.attempts <= fresh.maxRetries) {
					const delay = Math.max(0, fresh.backoffMs * fresh.attempts);
					const when = Date.now() + delay;
					this.store.updateRunAt(id, when);
					this.log.warn("Retrying job", {
						id,
						attempt: fresh.attempts,
						when,
					});
					this.scheduleTime(this.store.getJob(id)!);
					// reflect that it's scheduled again (not stuck as failed)
					// direct status update to 'scheduled' without bumping counters
					this.store.setStatus(id, "scheduled");
				} else {
					this.store.setActive(id, false, "failed");
					this.log.error("Job failed, no more retries", { id });
				}
			}
		}
	}

	private scheduleTime(job: JobRecord) {
		if (!job.runAt) {
			return;
		}
		// cancel previous if exists
		const prev = this.timers.get(job.id);
		if (prev) {
			try {
				prev.cancel();
			} catch (_err) {
				this.log.debug("cancel failed", { id: job.id });
			}
		}
		const date = new Date(job.runAt);
		const nj = schedule.scheduleJob(date, () => this.runOnce(job.id));
		this.timers.set(job.id, nj);
	}

	private scheduleCronInternal(job: JobRecord) {
		if (!job.cronExpr) {
			return;
		}
		const prev = this.timers.get(job.id);
		if (prev) {
			try {
				prev.cancel();
			} catch (_err) {
				this.log.debug("cancel failed", { id: job.id });
			}
		}
		const nj = schedule.scheduleJob(
			job.cronExpr as unknown as RecurrenceRule,
			() => this.runOnce(job.id)
		);
		this.timers.set(job.id, nj);
	}

	/**
	 * Schedule a one-time job at a specific time.
	 */
	scheduleAt<K extends keyof Reg & string>(
		name: string,
		when: Date | number,
		handlerKey: K,
		payload?: Reg[K],
		retry: RetryPolicy = {}
	): JobRecord<Reg[K]> {
		const rec = this.store.createTimeJob({
			name,
			handlerKey,
			payload,
			runAt: when,
			maxRetries: retry.maxRetries ?? 5,
			backoffMs: retry.backoffMs ?? 2000,
		} as CreateTimeJob) as JobRecord<Reg[K]>;
		// only schedule immediately if scheduler is running
		if (this.running && !rec.paused) {
			this.scheduleTime(rec);
		}
		this.emit("job:add", rec);
		return rec;
	}

	/**
	 * Schedule a cron-like recurring job.
	 */
	scheduleCron<K extends keyof Reg & string>(
		name: string,
		cronExpr: string,
		handlerKey: K,
		payload?: Reg[K],
		retry: RetryPolicy = {}
	): JobRecord<Reg[K]> {
		const rec = this.store.createCronJob({
			name,
			handlerKey,
			payload,
			cronExpr,
			maxRetries: retry.maxRetries ?? 0,
			backoffMs: retry.backoffMs ?? 0,
		} as CreateCronJob) as JobRecord<Reg[K]>;
		if (this.running && !rec.paused) {
			this.scheduleCronInternal(rec);
		}
		this.emit("job:add", rec);
		return rec;
	}

	pause(id: string) {
		this.store.setPaused(id, true);
		this.emit("job:pause", id);
		const j = this.timers.get(id);
		if (j) {
			try {
				j.cancel();
			} catch (_err) {
				this.log.debug("cancel failed", { id });
			}
			this.timers.delete(id);
		}
	}

	resume(id: string) {
		this.store.setPaused(id, false);
		this.emit("job:resume", id);
		const job = this.store.getJob(id);
		if (!job) {
			return;
		}
		if (job.kind === "time") {
			// if due in the past, run immediately
			if (job.runAt && job.runAt <= Date.now()) {
				setTimeout(() => this.runOnce(job.id), 0);
			} else {
				this.scheduleTime(job);
			}
		} else {
			this.scheduleCronInternal(job);
		}
	}

	cancel(id: string) {
		this.store.setActive(id, false, "cancelled");
		this.emit("job:cancel", id);
		const j = this.timers.get(id);
		if (j) {
			try {
				j.cancel();
			} catch (_err) {
				this.log.debug("cancel failed", { id });
			}
			this.timers.delete(id);
		}
	}
}
