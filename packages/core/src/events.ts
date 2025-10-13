import { EventEmitter as NodeEventEmitter } from "node:events";

export type EventMap = Record<PropertyKey, (...args: unknown[]) => void>;

export class EventEmitter<Events extends EventMap> {
	private readonly emitter = new NodeEventEmitter();

	on<U extends keyof Events>(event: U, listener: Events[U]): this {
		this.emitter.on(
			event as unknown as string | symbol,
			listener as (...args: any[]) => void
		);
		return this;
	}

	off<U extends keyof Events>(event: U, listener: Events[U]): this {
		this.emitter.off(
			event as unknown as string | symbol,
			listener as (...args: any[]) => void
		);
		return this;
	}

	once<U extends keyof Events>(event: U, listener: Events[U]): this {
		this.emitter.once(
			event as unknown as string | symbol,
			listener as (...args: any[]) => void
		);
		return this;
	}

	emit<U extends keyof Events>(
		event: U,
		...args: Parameters<Events[U]>
	): boolean {
		return this.emitter.emit(
			event as unknown as string | symbol,
			...(args as unknown as any[])
		);
	}

	removeAllListeners(): this;
	removeAllListeners<U extends keyof Events>(event: U): this;
	removeAllListeners<U extends keyof Events>(event?: U): this {
		this.emitter.removeAllListeners(
			event as unknown as string | symbol | undefined
		);
		return this;
	}

	listeners<U extends keyof Events>(event: U): Events[U][] {
		return this.emitter.listeners(
			event as unknown as string | symbol
		) as Events[U][];
	}

	listenerCount<U extends keyof Events>(event: U): number {
		return this.emitter.listenerCount(event as unknown as string | symbol);
	}

	eventNames(): (keyof Events)[] {
		return this.emitter.eventNames() as (keyof Events)[];
	}

	setMaxListeners(n: number): this {
		this.emitter.setMaxListeners(n);
		return this;
	}

	getMaxListeners(): number {
		return this.emitter.getMaxListeners();
	}
}
