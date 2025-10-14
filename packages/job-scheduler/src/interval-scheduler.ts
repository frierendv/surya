import { EventEmitter } from "@surya/core/events";
import { createLogger, type Logger } from "@surya/core/logger";
import { SimpleIntervalJob, Task, ToadScheduler } from "toad-scheduler";
import { JobStore, type JobRecord } from "./sqlite";
import type { JobHandler, JobRegistry, SchedulerEvents } from "./types";

export interface IntervalSchedulerOptions {
	logger?: Logger;
}

/**
 * Interval job scheduler using toad-scheduler for in-process timing and SQLite for persistence.
 */
export class IntervalScheduler<
	Reg extends JobRegistry = JobRegistry,
> extends EventEmitter<SchedulerEvents> {
	private store: JobStore;
	private scheduler: ToadScheduler;
	private handlers = new Map<string, JobHandler<any>>();
	private jobs = new Map<string, SimpleIntervalJob>();
	private log: Logger;
	private running = false;

	constructor(store: JobStore, opts: IntervalSchedulerOptions = {}) {
		super();
		this.store = store;
		this.scheduler = new ToadScheduler();
		this.log = opts.logger ?? createLogger({ name: "interval-scheduler" });
	}
	/**
	 * Register a handler function.
	 */
	public register<Key extends string, P = unknown>(
		key: Key,
		handler: JobHandler<P>
	): asserts this is IntervalScheduler<JobRegistry<Key, P>> {
		this.handlers.set(key, handler);
	}

	public add<K extends keyof Reg & string>(
		name: string,
		everyMs: number,
		handlerKey: K,
		payload?: Reg[K],
		opts: {
			maxRuns?: number | null;
			maxRetries?: number;
			backoffMs?: number;
		} = {}
	): JobRecord<Reg[K]> {
		const rec = this.store.createIntervalJob({
			name,
			handlerKey,
			payload,
			intervalMs: everyMs,
			maxRuns: opts.maxRuns ?? null,
			maxRetries: opts.maxRetries ?? 0,
			backoffMs: opts.backoffMs ?? 0,
		}) as JobRecord<Reg[K]>;
		this.emit("job:add", rec);
		// schedule immediately if running and not paused
		if (this.running && !rec.paused) {
			this.schedule(rec);
		}
		return rec;
	}

	start() {
		if (this.running) {
			return;
		}
		this.running = true;
		const actives = this.store.getActiveJobs(["interval"]);
		for (const job of actives) {
			if (job.paused || !job.intervalMs) {
				continue;
			}
			this.schedule(job);
		}
		this.log.info("IntervalScheduler started", { count: actives.length });
	}

	stop() {
		for (const [_id, j] of this.jobs) {
			try {
				j.stop();
			} catch (_err) {
				// ignore
			}
		}
		this.scheduler.stop();
		this.jobs.clear();
		this.running = false;
		this.log.info("IntervalScheduler stopped");
	}

	private schedule(job: JobRecord) {
		if (!job.intervalMs) {
			return;
		}
		const handler = this.handlers.get(job.handlerKey);
		if (!handler) {
			this.log.warn("No handler for interval job", {
				id: job.id,
				handlerKey: job.handlerKey,
			});
			return;
		}
		const task = new Task(job.name ?? job.id, async () => this.run(job.id));
		const si = new SimpleIntervalJob(
			{ milliseconds: job.intervalMs },
			task,
			{ id: job.id, preventOverrun: true }
		);
		this.scheduler.addSimpleIntervalJob(si);
		this.jobs.set(job.id, si);
	}

	private async run(id: string) {
		const job = this.store.getJob(id);
		if (!job || !job.active || job.paused) {
			return;
		}
		// honor backoff gate via runAt if set and in the future
		if (job.runAt && job.runAt > Date.now()) {
			return;
		}
		const handler = this.handlers.get(job.handlerKey);
		if (!handler) {
			return;
		}
		// if exceeding maxRuns, finish
		if (job.maxRuns != null && job.runCount >= job.maxRuns) {
			this.finish(id);
			return;
		}

		// atomic guard: skip if already running
		const started = this.store.tryMarkRunning(id);
		if (!started) {
			return;
		}
		this.emit("job:start", job);
		try {
			await Promise.resolve(handler(job.payload, job));
			this.store.markSuccess(id);
			const after = this.store.getJob(id)!;
			this.emit("job:success", after);
			const fresh = this.store.getJob(id)!;
			if (fresh.maxRuns != null && fresh.runCount >= fresh.maxRuns) {
				this.finish(id);
			}
		} catch (err: any) {
			const msg = (err?.message ?? String(err)) as string;
			this.store.markFailure(id, msg);
			const after = this.store.getJob(id)!;
			this.emit("job:failure", after, err);
			const fresh = this.store.getJob(id)!;
			if (fresh.attempts <= fresh.maxRetries) {
				const delay = Math.max(0, fresh.backoffMs * fresh.attempts);
				const when = Date.now() + delay;
				this.store.updateRunAt(id, when);
				this.log.warn("Interval job backoff", {
					id,
					attempt: fresh.attempts,
					when,
				});
			}
		}
	}

	private finish(id: string) {
		this.store.completeAndDeactivate(id);
		const after = this.store.getJob(id) ?? ({ id } as JobRecord);
		this.emit("job:finish", after);
		const j = this.jobs.get(id);
		if (j) {
			try {
				j.stop();
			} catch (_err) {
				// ignore
			}
			this.jobs.delete(id);
		}
	}

	pause(id: string) {
		this.store.setPaused(id, true);
		this.emit("job:pause", id);
		const j = this.jobs.get(id);
		if (j) {
			try {
				j.stop();
			} catch (_err) {
				// ignore
			}
		}
	}

	resume(id: string) {
		this.store.setPaused(id, false);
		this.emit("job:resume", id);
		const job = this.store.getJob(id);
		if (job && job.active && job.intervalMs) {
			// ensure scheduled
			if (!this.jobs.has(id)) {
				this.schedule(job);
			} else {
				const j = this.jobs.get(id)!;
				try {
					j.start();
				} catch (_err) {
					// ignore
				}
			}
		}
	}

	remove(id: string) {
		this.store.setActive(id, false, "cancelled");
		this.emit("job:remove", id);
		const j = this.jobs.get(id);
		if (j) {
			try {
				j.stop();
			} catch (_err) {
				// ignore
			}
			this.jobs.delete(id);
		}
	}
}
