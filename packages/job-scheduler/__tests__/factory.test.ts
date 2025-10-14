import { createJobSchedulers, type JobSchedulers } from "../src/factory";
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
describe("Factory", () => {
	let tempDb: string;
	const baseTime = new Date();

	beforeAll(() => {
		jest.useFakeTimers();
		jest.setSystemTime(baseTime);
	});
	beforeEach(() => {
		tempDb = createTempDbPath("factory");
	});
	afterEach(() => {
		cleanupTempDb(tempDb);
	});
	afterAll(() => {
		jest.useRealTimers();
	});

	const advance = async (ms: number) => {
		jest.advanceTimersByTime(ms);
		await Promise.resolve();
	};
	test("creates shared store and autostarts", async () => {
		const api: JobSchedulers = createJobSchedulers({
			dbPath: tempDb,
			autostart: true,
		});
		// all schedulers created
		expect(api.interval).toBeDefined();
		expect(api.time).toBeDefined();
		expect(api.store).toBeDefined();

		let ran = 0;
		api.time.register("k1", async () => {
			ran++;
		});

		api.time.scheduleAt("t1", Date.now() + 50, "k1");

		await advance(60);

		expect(ran).toBe(1);

		api.close();
	});
});
