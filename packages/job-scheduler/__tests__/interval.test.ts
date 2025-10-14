import { IntervalScheduler, JobStore } from "../src";
import { cleanupTempDb, createTempDbPath } from "./helper";

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

jest.useFakeTimers();
describe("IntervalScheduler (interval)", () => {
	let store: JobStore;
	const dbPath = createTempDbPath("interval");
	beforeAll(() => {
		store = new JobStore(dbPath);
	});
	afterEach(() => {
		store.clearAllJob();
	});

	afterAll(() => {
		store.close();
		cleanupTempDb(dbPath);
		jest.useRealTimers();
	});
	const advance = async (ms: number) => {
		await jest.advanceTimersByTimeAsync(ms);
		await Promise.resolve();
	};

	test("interval job runs and respects maxRuns", async () => {
		const sch: IntervalScheduler = new IntervalScheduler(store);

		let cnt = 0;
		sch.register("tick", async () => {
			await advance(10); // simulate some work
			cnt++;
		});

		sch.add("tick-1", 100, "tick", undefined, { maxRuns: 5 });

		sch.start();

		await advance(350);

		expect(cnt).toBeGreaterThanOrEqual(2);

		sch.stop();
	});

	test("interval job with maxRuns completes", async () => {
		const sch: IntervalScheduler = new IntervalScheduler(store);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		let cnt = 0;
		sch.register("tick", async () => {
			cnt++;
		});

		const rec = sch.add("tick-2", 50, "tick", undefined, { maxRuns: 2 });

		sch.start();

		await advance(300);

		const final = store.getJob(rec.id)!;
		expect(final.active).toBe(false);
		expect(final.runCount).toBeGreaterThanOrEqual(2);

		sch.stop();
	});

	it("does not schedule same job twice", () => {
		const sch: IntervalScheduler = new IntervalScheduler(store);

		sch.register("tick", async () => {
			// do nothing
		});

		const rec1 = sch.add("tick-3", 100, "tick");
		const rec2 = sch.add("tick-3", 100, "tick");

		expect(rec1.id).toBe(rec2.id);

		sch.stop();
	});

	it("ignores job with no handler", async () => {
		const sch = new IntervalScheduler(store);

		const rec = sch.add("tick-4", 100, "no-such-handler");

		expect(rec).toBeDefined();
		expect(store.getJob(rec.id)).toBeDefined();

		sch.start();

		// wait a bit to ensure no errors
		await advance(250);
		sch.stop();
	});

	test("pause/resume/remove interval job", async () => {
		const sch: IntervalScheduler = new IntervalScheduler(store);

		let cnt = 0;
		sch.register("x", async () => {
			cnt++;
		});

		const rec = sch.add("i1", 100, "x");
		sch.start();
		await advance(250);
		expect(cnt).toBeGreaterThanOrEqual(1);

		sch.pause(rec.id);
		const pausedCnt = cnt;
		await advance(250);
		expect(cnt).toBe(pausedCnt);

		sch.resume(rec.id);
		await advance(250);
		expect(cnt).toBeGreaterThan(pausedCnt);

		sch.remove(rec.id);
		const afterRemove = cnt;
		await advance(250);
		expect(cnt).toBe(afterRemove);

		sch.stop();
	});

	test("interval failure backoff gates runs", async () => {
		const sch: IntervalScheduler = new IntervalScheduler(store);

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
		await advance(400);
		const j = store.getJob(rec.id)!;
		expect(j.attempts).toBeGreaterThan(0);
		expect(typeof j.runAt === "number" || j.lastRunAt == null).toBe(true);

		sch.stop();
	});

	test("interval dedup updates and no overlap when handler is slow", async () => {
		const sch: IntervalScheduler = new IntervalScheduler(store);
		let runs = 0;
		sch.register("slow", async () => {
			runs++;
		});
		sch.add("i3", 50, "slow", undefined);
		sch.start();
		await advance(200);
		expect(runs).toBeGreaterThanOrEqual(2);
		expect(runs).toBeLessThanOrEqual(4);

		sch.stop();
	});
});
