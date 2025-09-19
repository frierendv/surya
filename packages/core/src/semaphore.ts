// A simple semaphore to limit concurrency
export class Semaphore {
	private available: number;
	private waiters: Array<() => void> = [];
	constructor(count: number) {
		this.available = count;
	}
	async acquire(): Promise<void> {
		if (this.available > 0) {
			this.available--;
			return;
		}
		await new Promise<void>((res) => this.waiters.push(res));
	}
	release(): void {
		this.available++;
		const w = this.waiters.shift();
		if (w) {
			this.available--;
			// resolve next waiter
			w();
		}
	}
}
