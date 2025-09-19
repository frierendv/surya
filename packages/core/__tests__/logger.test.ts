import { createLogger } from "../src/logger";

describe("logger", () => {
	let logSpy: jest.SpyInstance;
	let debugSpy: jest.SpyInstance;
	let warnSpy: jest.SpyInstance;
	let errorSpy: jest.SpyInstance;

	beforeEach(() => {
		logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
		debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
		warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
		debugSpy.mockRestore();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});

	test("level gating works (trace suppressed at info)", () => {
		const logger = createLogger({ level: "info" });
		logger.trace("t1");
		logger.debug("d1");
		logger.info("i1");

		expect(debugSpy).toHaveBeenCalledTimes(0);
		expect(logSpy).toHaveBeenCalledTimes(1); // info printed via log
	});

	test("prod JSON formatting and error serialization", () => {
		const logger = createLogger({
			name: "unit",
			prodJson: true,
			level: "debug",
		});
		const err: any = new Error("boom");
		err.code = "EBOOM";
		logger.error("failed", { step: 1 }, err);

		expect(logSpy).toHaveBeenCalled();
		const line = String(logSpy.mock.calls[0][0]);
		const obj = JSON.parse(line);
		expect(obj.level).toBe("error");
		expect(obj.name).toBe("unit");
		expect(obj.msg).toBe("failed");
		expect(obj.meta).toEqual({ step: 1 });
		expect(obj.err.name).toBe("Error");
		expect(obj.err.message).toBe("boom");
		expect(obj.err.code).toBe("EBOOM");
	});

	test("child logger inherits context and name (JSON mode)", () => {
		const base = createLogger({
			name: "base",
			prodJson: true,
			level: "debug",
			context: { a: 1 },
		});
		const child = base.child({ context: { b: 2 }, name: "child" });

		child.info("msg", { c: 3 });
		const obj = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}"));
		expect(obj.name).toBe("child");
		expect(obj.a).toBe(1);
		expect(obj.b).toBe(2);
		expect(obj.meta).toEqual({ c: 3 });
	});

	test("time() helper logs elapsed time", async () => {
		jest.useFakeTimers();
		const logger = createLogger({ prodJson: true, level: "debug" });
		const end = logger.time("work");
		jest.advanceTimersByTime(15);
		end();
		jest.useRealTimers();

		expect(logSpy).toHaveBeenCalled();
		const obj = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}"));
		expect(obj.level).toBe("debug");
		expect(obj.msg).toMatch(/work - \d+ms/);
		// meta is undefined because end() takes no args per the Logger type
		expect(obj.meta).toBeUndefined();
	});
});
