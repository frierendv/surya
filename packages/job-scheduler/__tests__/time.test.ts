import fs from "node:fs";
import path from "node:path";
import { JobStore } from "../src/sqlite";
import { TimeScheduler } from "../src/time-scheduler";

const tmpDb = () => path.join(process.cwd(), "__tmp_jobs_time.sqlite");

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
	afterEach(() => {
		try {
			fs.unlinkSync(tmpDb());
		} catch {
			// ignore
		}
	});

	test("scheduleAt executes and deactivates", async () => {
		const store = new JobStore(tmpDb());
		const sch = new TimeScheduler(store);

		let ran = 0;
		sch.register("t", async (payload: any) => {
			expect(payload.hello).toBe("world");
			ran++;
		});

		const rec = sch.scheduleAt("test", Date.now() + 50, "t", {
			hello: "world",
		});

		sch.start();

		await new Promise((r) => setTimeout(r, 200));

		expect(ran).toBe(1);
		const j = store.getJob(rec.id)!;
		expect(j.active).toBe(false);
		store.close();
	});

	test("scheduleCron keeps running", async () => {
		const store = new JobStore(tmpDb());
		const sch = new TimeScheduler(store);

		let cnt = 0;
		sch.register("cron", async () => {
			cnt++;
		});

		sch.scheduleCron("every-second", "* * * * * *", "cron");

		sch.start();

		await new Promise((r) => setTimeout(r, 2100));

		expect(cnt).toBeGreaterThanOrEqual(2);

		sch.stop();
		store.close();
	});
});
