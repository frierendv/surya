import type { JobRecord } from "./sqlite";

export type MaybePromise<T> = T | Promise<T>;
export type JobHandler<Payload = unknown> = (
	/** payload provided when scheduling the job */
	payload: Payload,
	/** job record */
	job: JobRecord<Payload>
) => MaybePromise<void>;
export type Registry<K extends string = string, V = unknown> = Record<K, V>;
export type JobRegistry<K extends string = string, H = JobHandler<any>> = {
	/** Unique key to identify the handler */
	handlerKey: K;
	/** The handler function */
	handler: H;
};

export interface RetryPolicy {
	/** Maximum number of retries on failure. Default: 5 */
	maxRetries?: number;
	/** Initial backoff in milliseconds. Default: 2000 (2 seconds) */
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

type ParamOfHandler<H> = H extends (p: infer P, ...a: any[]) => any ? P : never;

type Def = JobRegistry;
/**
 * Merge an array of `Def` into a single registry type.
 */
export type MergeRegistry<Arr extends readonly Def[]> = Arr extends readonly [
	infer H extends Def,
	...infer T extends readonly Def[],
]
	? Registry<H["handlerKey"], ParamOfHandler<H["handler"]>> & MergeRegistry<T>
	: Registry;
