import fs from "node:fs";
import path from "node:path";
import { JobStore } from "../src/sqlite";
import { TimeScheduler } from "../src/time-scheduler";

const tmpDb = () => path.join(process.cwd(), "__tmp_jobs_controls.sqlite");

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

describe("Schedule controls and backoff", () => {
	afterEach(() => {
		try {
			fs.unlinkSync(tmpDb());
		} catch {
			// ignore
		}
	});

	test("pause/resume/cancel time job", async () => {
		const store = new JobStore(tmpDb());
		const sch = new TimeScheduler(store);

		let ran = 0;
		sch.register("k1", async () => {
			ran++;
		});

		const rec = sch.scheduleAt("t1", Date.now() + 250, "k1");
		sch.pause(rec.id);
		sch.start();

		await new Promise((r) => setTimeout(r, 250));
		expect(ran).toBe(0);

		sch.resume(rec.id);
		await new Promise((r) => setTimeout(r, 250));
		expect(ran).toBe(1);

		// schedule another and then cancel
		const rec2 = sch.scheduleAt("t2", Date.now() + 150, "k1");
		sch.cancel(rec2.id);
		await new Promise((r) => setTimeout(r, 250));
		expect(ran).toBe(1);

		sch.stop();
		store.close();
	});

	test("time job failure with backoff and counters", async () => {
		const store = new JobStore(tmpDb());
		const sch = new TimeScheduler(store);

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
		await new Promise((r) => setTimeout(r, 400));

		const final = store.getJob(rec.id)!;
		expect(final.active).toBe(false);
		expect(
			final.status === "completed" || final.status === "scheduled"
		).toBe(true);
		expect(final.runCount).toBe(1);
		expect(final.attempts).toBeGreaterThanOrEqual(2);
		expect(typeof final.lastRunAt).toBe("number");

		sch.stop();
		store.close();
	});
});
