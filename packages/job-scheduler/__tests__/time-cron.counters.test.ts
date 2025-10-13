import fs from "node:fs";
import path from "node:path";
import { JobStore } from "../src/sqlite";
import { TimeScheduler } from "../src/time-scheduler";

const tmpDb = () => path.join(process.cwd(), "__tmp_jobs_cron.sqlite");

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

describe("Cron counters and lastRunAt", () => {
	afterEach(() => {
		try {
			fs.unlinkSync(tmpDb());
		} catch {
			// ignore
		}
	});

	test("cron updates runCount and lastRunAt", async () => {
		const store = new JobStore(tmpDb());
		const sch = new TimeScheduler(store);

		sch.register("c", async () => {});
		const rec = sch.scheduleCron("every-second", "* * * * * *", "c");

		sch.start();
		await new Promise((r) => setTimeout(r, 2100));

		const j = store.getJob(rec.id)!;
		expect(j.runCount).toBeGreaterThanOrEqual(1);
		expect(typeof j.lastRunAt).toBe("number");

		sch.stop();
		store.close();
	});
});
