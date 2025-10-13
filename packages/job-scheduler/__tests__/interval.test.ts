import fs from "node:fs";
import path from "node:path";
import { IntervalScheduler } from "../src/interval-scheduler";
import { JobStore } from "../src/sqlite";

const tmpDb = () => path.join(process.cwd(), "__tmp_jobs_interval.sqlite");

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
	afterEach(() => {
		try {
			fs.unlinkSync(tmpDb());
		} catch {
			// ignore
		}
	});

	test("interval job runs and respects maxRuns", async () => {
		const store = new JobStore(tmpDb());
		const sch = new IntervalScheduler(store);

		let cnt = 0;
		sch.register("tick", async () => {
			cnt++;
		});

		sch.add("tick-1", 100, "tick");

		sch.start();

		await new Promise((r) => setTimeout(r, 350));

		expect(cnt).toBeGreaterThanOrEqual(2);

		sch.stop();
		store.close();
	});

	test("interval job with maxRuns completes", async () => {
		const store = new JobStore(tmpDb());
		const sch = new IntervalScheduler(store);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		let cnt = 0;
		sch.register("tick", async () => {
			cnt++;
		});

		const rec = sch.add("tick-2", 50, "tick", undefined, { maxRuns: 2 });

		sch.start();

		await new Promise((r) => setTimeout(r, 300));

		const final = store.getJob(rec.id)!;
		expect(final.active).toBe(false);
		expect(final.runCount).toBeGreaterThanOrEqual(2);

		sch.stop();
		store.close();
	});
});
