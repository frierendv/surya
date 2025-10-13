import { EventEmitter as NodeEventEmitter } from "node:events";

export class EventEmitter<
	Events extends Record<string, (...args: any[]) => void>,
> {
	private emitter = new NodeEventEmitter();

	on<U extends keyof Events>(event: U, listener: Events[U]): this {
		this.emitter.on(event as string, listener);
		return this;
	}
	off<U extends keyof Events>(event: U, listener: Events[U]): this {
		this.emitter.off(event as string, listener);
		return this;
	}
	emit<U extends keyof Events>(
		event: U,
		...args: Parameters<Events[U]>
	): boolean {
		return this.emitter.emit(event as string, ...args);
	}
	once<U extends keyof Events>(event: U, listener: Events[U]): this {
		this.emitter.once(event as string, listener);
		return this;
	}
	removeAllListeners<U extends keyof Events>(event?: U): this {
		this.emitter.removeAllListeners(event as string | undefined);
		return this;
	}
	listeners<U extends keyof Events>(event: U): Events[U][] {
		return this.emitter.listeners(event as string) as Events[U][];
	}
	listenerCount<U extends keyof Events>(event: U): number {
		return this.emitter.listenerCount(event as string);
	}
}
