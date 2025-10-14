import { JobStore, TimeScheduler } from "../src";
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
describe("TimeSchedule (time & cron)", () => {
	let store: JobStore;
	const dbPath = createTempDbPath("interval");
	beforeAll(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date());
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
	test("scheduleAt executes and deactivates", async () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		let ran = 0;
		sch.register("t", async (payload: any) => {
			expect(payload.hello).toBe("world");
			ran++;
		});

		const rec = sch.scheduleAt("test", Date.now() + 50, "t", {
			hello: "world",
		});

		sch.start();

		await advance(200);

		expect(ran).toBe(1);
		const j = store.getJob(rec.id)!;
		expect(j.active).toBe(false);

		// ensure scheduler is stopped to avoid using DB after tests close the connection
		sch.stop();
	});

	test("scheduleCron keeps running", async () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		let cnt = 0;
		sch.register("cron", async () => {
			cnt++;
		});

		sch.scheduleCron("every-second", "* * * * * *", "cron");

		sch.start();

		await advance(2100);

		expect(cnt).toBeGreaterThanOrEqual(2);

		sch.stop();
	});

	it("does not schedule same job twice", () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		sch.register("j", async () => {});

		const r1Cron = sch.scheduleCron("id1", "* * * * * *", "j");
		const r2Cron = sch.scheduleCron("id1", "* * * * * *", "j");
		expect(r2Cron.id).toBe(r1Cron.id);

		sch.register("k", async () => {});

		const r1Time = sch.scheduleAt("id2", Date.now() + 1000, "k");
		const r2Time = sch.scheduleAt("id2", Date.now() + 2000, "k");
		expect(r2Time.id).toBe(r1Time.id);

		sch.stop();
	});

	it("skips if already running", async () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		let runs = 0;
		sch.register("long", async () => {
			runs++;
			// simulate long task
			await advance(200);
		});

		sch.scheduleCron("long-runner", "* * * * * *", "long");

		sch.start();

		await advance(2000);
		// should be around 2 since each run takes 200ms and cron triggers every second
		expect(runs).toBeGreaterThanOrEqual(1);
		expect(runs).toBeLessThanOrEqual(3);

		sch.stop();
	});
	test("time job retries then succeeds", async () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		let attempts = 0;
		sch.register("rr", async () => {
			attempts++;
			if (attempts < 3) {
				throw new Error("fail");
			}
		});

		const rec = sch.scheduleAt(
			"retry-me",
			Date.now() + 100,
			"rr",
			undefined,
			{ maxRetries: 3, backoffMs: 30 }
		);

		sch.start();

		await advance(2000);

		const j = store.getJob(rec.id)!;
		expect(attempts).toBeGreaterThanOrEqual(3);
		expect(j.active).toBe(false);
		expect(j.runCount).toBeGreaterThanOrEqual(1);

		sch.stop();
	});

	test("time job exhausts retries and deactivates as failed", async () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		sch.register("ff", async () => {
			throw new Error("always");
		});

		const rec = sch.scheduleAt(
			"always-fail",
			Date.now() + 10,
			"ff",
			undefined,
			{ maxRetries: 1, backoffMs: 20 }
		);

		sch.start();

		await advance(1200);

		const j = store.getJob(rec.id)!;
		expect(j.active).toBe(false);
		expect(j.status).toBe("failed");
		expect(j.attempts).toBeGreaterThanOrEqual(2);

		sch.stop();
	});

	test("cron updates runCount and lastRunAt", async () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		sch.register("c", async () => {});
		const rec = sch.scheduleCron("every-second", "* * * * * *", "c");

		sch.start();
		await advance(2100);

		const j = store.getJob(rec.id)!;
		expect(j.runCount).toBeGreaterThanOrEqual(1);
		expect(typeof j.lastRunAt).toBe("number");

		sch.stop();
	});

	test("pause/resume/cancel time job", async () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		let ran = 0;
		sch.register("k1", async () => {
			ran++;
		});

		const rec = sch.scheduleAt("t1", Date.now() + 250, "k1");
		sch.pause(rec.id);
		sch.start();

		await advance(250);
		expect(ran).toBe(0);

		sch.resume(rec.id);
		await advance(250);
		expect(ran).toBe(1);

		// schedule another and then cancel
		const rec2 = sch.scheduleAt("t2", Date.now() + 150, "k1");
		sch.cancel(rec2.id);
		await advance(250);
		expect(ran).toBe(1);

		sch.stop();
	});

	test("time job failure with backoff and counters", async () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		let attempts = 0;
		sch.register("fail", async () => {
			attempts++;
			if (attempts < 2) {
				throw new Error("boom");
			}
		});

		const rec = sch.scheduleAt(
			"will-retry",
			Date.now() + 20,
			"fail",
			undefined,
			{
				maxRetries: 3,
				backoffMs: 50,
			}
		);

		sch.start();
		await advance(400);

		const final = store.getJob(rec.id)!;
		expect(final.active).toBe(false);
		expect(
			final.status === "completed" || final.status === "scheduled"
		).toBe(true);
		expect(final.runCount).toBe(1);
		expect(final.attempts).toBeGreaterThanOrEqual(2);
		expect(typeof final.lastRunAt).toBe("number");

		sch.stop();
	});

	test("time dedup updates existing job instead of creating new one", async () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		sch.register("h", async () => {});

		const r1 = sch.scheduleAt(
			"same-name",
			Date.now() + 2000,
			"h",
			{ a: 1 },
			{ maxRetries: 1, backoffMs: 10 }
		);
		const r2 = sch.scheduleAt(
			"same-name",
			Date.now() + 4000,
			"h",
			{ a: 2 },
			{ maxRetries: 2, backoffMs: 20 }
		);

		expect(r2.id).toBe(r1.id);
		const j = store.getJob(r1.id)!;
		expect(j.runAt).toBeGreaterThan(r1.runAt!);
		expect(j.maxRetries).toBe(2);
		expect(j.backoffMs).toBe(20);

		sch.stop();
	});

	test("cron dedup updates existing job instead of creating new one", async () => {
		const sch: TimeScheduler = new TimeScheduler(store);

		sch.register("c", async () => {});

		const r1 = sch.scheduleCron(
			"same-name",
			"* * * * * *",
			"c",
			{ x: 1 },
			{ maxRetries: 0, backoffMs: 0 }
		);
		const r2 = sch.scheduleCron(
			"same-name",
			"*/2 * * * * *",
			"c",
			{ x: 2 },
			{ maxRetries: 5, backoffMs: 50 }
		);

		expect(r2.id).toBe(r1.id);
		const j = store.getJob(r1.id)!;
		expect(j.cronExpr).toBe("*/2 * * * * *");
		expect(j.maxRetries).toBe(5);
		expect(j.backoffMs).toBe(50);

		sch.stop();
	});
});
