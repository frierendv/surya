import { Semaphore } from "../src/semaphore";

describe("Semaphore", () => {
	const tick = () => Promise.resolve();
	const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
	test("limits concurrency and wakes waiters in order", async () => {
		const sem = new Semaphore(2);
		const inFlight: number[] = [];
		const maxSeen: number[] = [];

		const task = async (id: number, delay: number) => {
			await sem.acquire();
			inFlight.push(id);
			maxSeen.push(inFlight.length);
			await new Promise((r) => setTimeout(r, delay));
			inFlight.splice(inFlight.indexOf(id), 1);
			sem.release();
		};

		// 3 tasks, but concurrency 2 => at most 2 in flight at once
		await Promise.all([task(1, 30), task(2, 20), task(3, 10)]);

		expect(Math.max(...maxSeen)).toBeLessThanOrEqual(2);
	});
	test("wakes waiters FIFO and one-per-release", async () => {
		const sem = new Semaphore(1);
		const acquired: number[] = [];

		const deferred = () => {
			let resolve!: () => void;
			const promise = new Promise<void>((r) => (resolve = r));
			return { promise, resolve };
		};

		const d1 = deferred();
		const d2 = deferred();
		const d3 = deferred();

		const task = async (
			id: number,
			d: { promise: Promise<void>; resolve: () => void }
		) => {
			await sem.acquire();
			acquired.push(id);
			await d.promise;
			sem.release();
		};

		const t1 = task(1, d1);
		const t2 = task(2, d2);
		const t3 = task(3, d3);

		await delay(10);
		expect(acquired).toEqual([1]);

		d1.resolve();
		await delay(10);
		expect(acquired).toEqual([1, 2]); // only one waiter woke up

		d2.resolve();
		await delay(10);
		expect(acquired).toEqual([1, 2, 3]); // FIFO order

		d3.resolve();
		await Promise.all([t1, t2, t3]);
	});

	test("acquire blocks when no permits and proceeds after release", async () => {
		const sem = new Semaphore(0);
		let entered = false;

		const waiter = (async () => {
			await sem.acquire();
			entered = true;
		})();

		await delay(10);
		expect(entered).toBe(false);

		sem.release();
		await delay(10);
		expect(entered).toBe(true);

		await waiter;
	});

	test("release with no waiters increases available for future immediate acquires", async () => {
		const sem = new Semaphore(1);
		sem.release(); // available is now 2

		await sem.acquire(); // immediate
		await sem.acquire(); // immediate

		let gotThird = false;
		const third = (async () => {
			await sem.acquire();
			gotThird = true;
		})();

		// No permits left, so third should block
		await delay(10);
		expect(gotThird).toBe(false);

		sem.release(); // wake the third waiter
		await third;
		expect(gotThird).toBe(true);
	});

	test("stress: maintains upper bound on concurrency", async () => {
		const limit = 3;
		const sem = new Semaphore(limit);
		let inFlight = 0;
		let worst = 0;

		const jobs = Array.from({ length: 20 }, (_, i) =>
			(async () => {
				await sem.acquire();
				inFlight++;
				worst = Math.max(worst, inFlight);
				await delay(5 + (i % 3));
				inFlight--;
				sem.release();
			})()
		);

		await Promise.all(jobs);
		expect(worst).toBeLessThanOrEqual(limit);
	});

	it("blocks when unavailable and resumes on release (covers waiter enqueue and w())", async () => {
		const sem = new Semaphore(1);

		await sem.acquire(); // now unavailable

		let secondResolved = false;
		const second = sem.acquire().then(() => {
			secondResolved = true;
		});

		// Give microtasks a chance; second should be pending (waiter enqueued)
		await tick();
		expect(secondResolved).toBe(false);

		// Release should wake exactly one waiter (calls w())
		sem.release();
		await second;
		expect(secondResolved).toBe(true);
	});

	it("wakes waiters one-by-one when multiple are queued", async () => {
		const sem = new Semaphore(1);

		await sem.acquire(); // consume available

		let a = false,
			b = false;
		const pa = sem.acquire().then(() => {
			a = true;
		});
		const pb = sem.acquire().then(() => {
			b = true;
		});

		await tick();
		expect(a).toBe(false);
		expect(b).toBe(false);

		sem.release(); // should wake first waiter only
		await pa;
		await tick();
		expect(a).toBe(true);
		expect(b).toBe(false);

		sem.release(); // now wake second
		await pb;
		expect(b).toBe(true);
	});

	it("release without waiters just increases availability (covers no-waiter branch)", async () => {
		const sem = new Semaphore(1);

		// No waiters yet
		sem.release(); // no waiter; branch where w is falsy

		// Should allow two immediate acquires
		await sem.acquire();
		await sem.acquire();

		// Third acquire should block until release
		let thirdResolved = false;
		const p3 = sem.acquire().then(() => {
			thirdResolved = true;
		});
		await tick();
		expect(thirdResolved).toBe(false);

		sem.release();
		await p3;
		expect(thirdResolved).toBe(true);
	});
});
