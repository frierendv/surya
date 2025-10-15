import type { JobRecord } from "./sqlite";

export type MaybePromise<T> = T | Promise<T>;

export type JobHandler<Payload = unknown> = (
	/** payload provided when scheduling the job */
	payload: Payload,
	/** job record */
	job: JobRecord<Payload>
) => MaybePromise<void>;

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

export type JobRegistry<K extends string = string, V = unknown> = {
	[I in K]: V;
};

export type DefToRegistry<Key extends string, P> = JobRegistry<Key, P>;

type AnyJobHandler = JobHandler<any>;
export type Def<
	K extends string = string,
	H extends AnyJobHandler = AnyJobHandler,
> = {
	handlerKey: K;
	handler: H;
};

type ParamOfHandler<H> = H extends (p: infer P, ...a: any[]) => any ? P : never;

type DefToReg<D extends Def> = DefToRegistry<
	D["handlerKey"],
	ParamOfHandler<D["handler"]>
>;

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
	x: infer I
) => void
	? I
	: never;

export type MergeDefs<Arr extends readonly Def[]> = UnionToIntersection<
	DefToReg<Arr[number]>
>;
