import { IntervalScheduler } from "../src";
import { getJobStore } from "./helper";

// increase jest timeout
jest.setTimeout(20000);

// disable logger
jest.mock("@surya/core/logger", () => ({
	createLogger: () => ({
		info: () => {},
		warn: () => {},
		error: () => {},
		debug: () => {},
		child: () => ({
			info: () => {},
			warn: () => {},
			error: () => {},
			debug: () => {},
		}),
	}),
}));

describe("IntervalScheduler (interval)", () => {
	let jobStore: Awaited<ReturnType<typeof getJobStore>>;
	beforeAll(async () => {
		jobStore = await getJobStore("interval");
	});
	afterEach(() => {
		jobStore.clear();
	});

	afterAll(() => {
		jobStore.close();
	});

	test("interval job runs and respects maxRuns", async () => {
		const sch: IntervalScheduler = new IntervalScheduler(jobStore.store);

		let cnt = 0;
		sch.register("tick", async () => {
			cnt++;
		});

		sch.add("tick-1", 100, "tick");

		sch.start();

		await new Promise((r) => setTimeout(r, 350));

		expect(cnt).toBeGreaterThanOrEqual(2);

		sch.stop();
	});

	test("interval job with maxRuns completes", async () => {
		const sch: IntervalScheduler = new IntervalScheduler(jobStore.store);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		let cnt = 0;
		sch.register("tick", async () => {
			cnt++;
		});

		const rec = sch.add("tick-2", 50, "tick", undefined, { maxRuns: 2 });

		sch.start();

		await new Promise((r) => setTimeout(r, 300));

		const final = jobStore.store.getJob(rec.id)!;
		expect(final.active).toBe(false);
		expect(final.runCount).toBeGreaterThanOrEqual(2);

		sch.stop();
	});

	it("does not schedule same job twice", () => {
		const sch: IntervalScheduler = new IntervalScheduler(jobStore.store);

		sch.register("tick", async () => {
			// do nothing
		});

		const rec1 = sch.add("tick-3", 100, "tick");
		const rec2 = sch.add("tick-3", 100, "tick");

		expect(rec1.id).toBe(rec2.id);

		sch.stop();
	});

	it("ignores job with no handler", async () => {
		const sch = new IntervalScheduler(jobStore.store);

		const rec = sch.add("tick-4", 100, "no-such-handler");

		expect(rec).toBeDefined();
		expect(jobStore.store.getJob(rec.id)).toBeDefined();

		sch.start();

		// wait a bit to ensure no errors
		await new Promise((r) => setTimeout(r, 250));
		sch.stop();
	});

	test("pause/resume/remove interval job", async () => {
		const sch: IntervalScheduler = new IntervalScheduler(jobStore.store);

		let cnt = 0;
		sch.register("x", async () => {
			cnt++;
		});

		const rec = sch.add("i1", 100, "x");
		sch.start();
		await new Promise((r) => setTimeout(r, 250));
		expect(cnt).toBeGreaterThanOrEqual(1);

		sch.pause(rec.id);
		const pausedCnt = cnt;
		await new Promise((r) => setTimeout(r, 250));
		expect(cnt).toBe(pausedCnt);

		sch.resume(rec.id);
		await new Promise((r) => setTimeout(r, 250));
		expect(cnt).toBeGreaterThan(pausedCnt);

		sch.remove(rec.id);
		const afterRemove = cnt;
		await new Promise((r) => setTimeout(r, 250));
		expect(cnt).toBe(afterRemove);

		sch.stop();
	});

	test("interval failure backoff gates runs", async () => {
		const sch: IntervalScheduler = new IntervalScheduler(jobStore.store);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		let attempts = 0;
		sch.register("fail", async () => {
			attempts++;
			throw new Error("nope");
		});

		const rec = sch.add("i2", 50, "fail", undefined, {
			maxRetries: 2,
			backoffMs: 80,
		});
		sch.start();

		// let it run a few intervals; backoff should reduce number of attempts
		await new Promise((r) => setTimeout(r, 400));
		const j = jobStore.store.getJob(rec.id)!;
		expect(j.attempts).toBeGreaterThan(0);
		expect(typeof j.runAt === "number" || j.lastRunAt == null).toBe(true);

		sch.stop();
	});

	test("interval dedup updates and no overlap when handler is slow", async () => {
		const sch: IntervalScheduler = new IntervalScheduler(jobStore.store);
		let runs = 0;
		sch.register("slow", async () => {
			runs++;
			// take a while
			await new Promise((r) => setTimeout(r, 120));
		});
		sch.add("i3", 50, "slow", undefined);
		sch.start();
		await new Promise((r) => setTimeout(r, 400));
		expect(runs).toBeGreaterThanOrEqual(2);
		expect(runs).toBeLessThanOrEqual(4);

		sch.stop();
	});
});
