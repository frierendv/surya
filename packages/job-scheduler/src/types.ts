import type { JobRecord } from "./sqlite";

export type JobHandler<Payload = unknown> = (
	/** payload provided when scheduling the job */
	payload: Payload,
	/** job record */
	job: JobRecord<Payload>
) => Promise<void> | void;

export interface RetryPolicy {
	/**
	 * Maximum number of retries on failure.
	 *
	 * Default: `5`
	 */
	maxRetries?: number;
	/**
	 * Initial backoff in milliseconds.
	 *
	 * Default: `2000` (2 seconds)
	 */
	backoffMs?: number;
}

/**
 * Events emitted by both TimeScheduler and IntervalScheduler.
 */
export type SchedulerEvents = {
	"job:add": (job: JobRecord) => void;
	"job:start": (job: JobRecord) => void;
	"job:success": (job: JobRecord) => void;
	"job:failure": (job: JobRecord, error: unknown) => void;
	"job:finish": (job: JobRecord) => void;
	"job:pause": (id: string) => void;
	"job:resume": (id: string) => void;
	"job:cancel": (id: string) => void;
	"job:remove": (id: string) => void;
};

export type RegK = PropertyKey;
export type RegV = unknown;

export type JobRegistry<K extends RegK = RegK, V = RegV> = {} & {
	[P in K]: V;
};
