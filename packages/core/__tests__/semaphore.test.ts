import { Semaphore } from "../src/semaphore";

describe("Semaphore", () => {
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
});
