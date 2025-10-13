import fs from "node:fs";
import path from "node:path";
import createJobSchedulers from "../src/factory";

const tmpDb = () => path.join(process.cwd(), "__tmp_jobs_factory.sqlite");

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
describe("Factory", () => {
	afterEach(() => {
		try {
			fs.unlinkSync(tmpDb());
		} catch {
			// ignore
		}
	});

	test("creates shared store and autostarts", async () => {
		const api = createJobSchedulers({ dbPath: tmpDb(), autostart: true });

		let ran = 0;
		api.time.register("k1", async () => {
			ran++;
		});

		api.time.scheduleAt("t1", Date.now() + 50, "k1");

		await new Promise((r) => setTimeout(r, 200));

		expect(ran).toBe(1);

		api.close();
	});
});
