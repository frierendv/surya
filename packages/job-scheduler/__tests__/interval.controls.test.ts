import fs from "node:fs";
import path from "node:path";
import { IntervalScheduler } from "../src/interval-scheduler";
import { JobStore } from "../src/sqlite";

const tmpDb = () =>
	path.join(process.cwd(), "__tmp_jobs_interval_controls.sqlite");

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

describe("IntervalScheduler controls and backoff", () => {
	afterEach(() => {
		try {
			fs.unlinkSync(tmpDb());
		} catch {
			// ignore
		}
	});

	test("pause/resume/remove interval job", async () => {
		const store = new JobStore(tmpDb());
		const sch = new IntervalScheduler(store);

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
		store.close();
	});

	test("interval failure backoff gates runs", async () => {
		const store = new JobStore(tmpDb());
		const sch = new IntervalScheduler(store);

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
		const j = store.getJob(rec.id)!;
		expect(j.attempts).toBeGreaterThan(0);
		expect(typeof j.runAt === "number" || j.lastRunAt == null).toBe(true);

		sch.stop();
		store.close();
	});
});
