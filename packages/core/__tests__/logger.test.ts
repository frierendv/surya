import {
	createLogger,
	createPinoDestination,
	createPinoLogger,
} from "../src/logger";

describe("ENV-based log level", () => {
	const OLD_ENV = process.env;

	beforeEach(() => {
		jest.resetModules(); // Clear module cache
		process.env = { ...OLD_ENV }; // Make a copy
	});

	afterEach(() => {
		process.env = OLD_ENV; // Restore old environment
	});

	test("LOG_LEVEL sets default level", () => {
		process.env.LOG_LEVEL = "warn";
		const logger = createLogger();
		expect(logger.level).toBe("warn");
	});

	test("LOG_LEVEL is overridden by explicit level option", () => {
		process.env.LOG_LEVEL = "warn";
		const logger = createLogger({ level: "debug" });
		expect(logger.level).toBe("debug");
	});

	test("Invalid LOG_LEVEL falls back to info", () => {
		process.env.LOG_LEVEL = "notalevel";
		const logger = createLogger();
		expect(logger.level).toBe("info");
	});

	test("No LOG_LEVEL falls back to info", () => {
		delete process.env.LOG_LEVEL;
		const logger = createLogger();
		expect(logger.level).toBe("info");
	});
});

describe("makeLogger basic functionality", () => {
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
	/**
	 * prettyFormat()
	 */
	test("prettyFormat() handles non-Error err arg", () => {
		const logger = createLogger({ level: "debug" });
		logger.error("not an error", { a: 1 }, { not: "an error" });

		expect(errorSpy).toHaveBeenCalled();
		const line = String(errorSpy.mock.calls[0][0]);
		expect(line).toMatch(/not an error/);
		expect(line).toMatch(/{"a":1}/);
		expect(line).toMatch(/{"not":"an error"}/);
	});
});

describe("makeLogger extras", () => {
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
		jest.useRealTimers();
	});

	test("enabled() gating returns correct booleans", () => {
		const logger = createLogger({ level: "info" });
		expect(logger.enabled("trace")).toBe(false);
		expect(logger.enabled("debug")).toBe(false);
		expect(logger.enabled("info")).toBe(true);
		expect(logger.enabled("error")).toBe(true);
		expect(logger.enabled("silent")).toBe(false);
	});

	test("time() accepts meta in implementation (prod JSON) and records elapsed + meta", () => {
		jest.useFakeTimers();
		const logger = createLogger({ prodJson: true, level: "debug" });
		const end = logger.time("work");
		jest.advanceTimersByTime(20);
		// @ts-expect-error: implementation accepts an optional meta arg
		end({ done: true });
		jest.useRealTimers();

		expect(logSpy).toHaveBeenCalled();
		const raw = String(logSpy.mock.calls.at(-1)?.[0] ?? "{}");
		const obj = JSON.parse(raw);
		expect(obj.msg).toMatch(/work - \d+ms/);
		expect(obj.meta).toEqual({ done: true });
	});

	test("safeStringify handles circular references in prod JSON output", () => {
		const logger = createLogger({ prodJson: true, level: "debug" });
		const circular: any = { name: "root" };
		circular.self = circular;
		logger.info("circ", circular);

		expect(logSpy).toHaveBeenCalled();
		const raw = String(logSpy.mock.calls.at(-1)?.[0] ?? "{}");
		const obj = JSON.parse(raw);
		expect(obj.meta).toBeDefined();
		expect((obj.meta as any).name).toBe("root");
		expect((obj.meta as any).self).toBe("[Circular]");
	});

	test("createPinoDestination routes numeric levels and echoes non-JSON lines", async () => {
		const dest = createPinoDestination({});

		// numeric level mapped to "success" (35)
		const successLine =
			JSON.stringify({ level: 35, msg: "yay", foo: "bar" }) + "\n";
		dest.write(Buffer.from(successLine));
		// plain text should be echoed as info
		const plain = "plain text line\n";
		dest.write(Buffer.from(plain));

		// Writable write is synchronous but handlers may schedule work; wait a tick
		await new Promise((r) => setImmediate(r));

		// We should have logged both the structured and the plain line (both use console.log)
		expect(logSpy).toHaveBeenCalled();
		const calls = logSpy.mock.calls.map((c) => String(c[0]));
		const joined = calls.join("\n");
		expect(joined).toMatch(/yay/);
		expect(joined).toMatch(/bar/);
		expect(joined).toMatch(/plain text line/);
	});

	test("child logger inherits/overrides name and level correctly", () => {
		const base = createLogger({
			name: "base",
			level: "debug",
			prodJson: true,
		});
		const child = base.child({ name: "child", level: "info" });

		expect(base.name).toBe("base");
		expect(child.name).toBe("child");
		expect(child.level).toBe("info");
		// base level remains unchanged
		expect(base.level).toBe("debug");
	});

	test("console method routing in pretty mode per level", () => {
		const logger = createLogger({ level: "trace" }); // pretty mode by default in tests
		logger.trace("t");
		logger.debug("d");
		logger.info("i");
		logger.success("s");
		logger.warn("w");
		logger.error("e");
		logger.fatal("f");

		// trace and debug -> console.debug
		expect(debugSpy).toHaveBeenCalled();
		// info and success -> console.log
		expect(logSpy).toHaveBeenCalled();
		// warn -> console.warn
		expect(warnSpy).toHaveBeenCalled();
		// error and fatal -> console.error
		expect(errorSpy).toHaveBeenCalled();
	});

	test("show() forwards directly to console.log", () => {
		const logger = createLogger({ level: "trace" });
		logger.show("hello", 123, { a: 1 });
		expect(logSpy).toHaveBeenCalledWith("hello", 123, { a: 1 });
	});

	test("disableTimestamp removes time field in prod JSON", () => {
		const logger = createLogger({
			prodJson: true,
			level: "info",
			disableTimestamp: true,
		});
		logger.info("no time");
		const raw = String(logSpy.mock.calls.at(-1)?.[0] ?? "{}");
		const obj = JSON.parse(raw);
		expect(obj.time).toBeUndefined();
	});

	test("timestamp present by default in prod JSON", () => {
		const logger = createLogger({ prodJson: true, level: "info" });
		logger.info("has time");
		const raw = String(logSpy.mock.calls.at(-1)?.[0] ?? "{}");
		const obj = JSON.parse(raw);
		expect(typeof obj.time === "string").toBe(true);
	});

	test("silent level gates all logs", () => {
		const logger = createLogger({ level: "silent" });
		logger.trace("t");
		logger.debug("d");
		logger.info("i");
		logger.warn("w");
		logger.error("e");
		logger.fatal("f");
		expect(debugSpy).not.toHaveBeenCalled();
		expect(logSpy).not.toHaveBeenCalled();
		expect(warnSpy).not.toHaveBeenCalled();
		expect(errorSpy).not.toHaveBeenCalled();
	});

	test("error-like object (with stack string) is serialized as err", () => {
		const logger = createLogger({ prodJson: true, level: "error" });
		const fakeErr: any = {
			name: "X",
			message: "m",
			stack: "stacktrace",
			extra: 1,
		};
		logger.error("boom", undefined, fakeErr);
		const raw = String(logSpy.mock.calls.at(-1)?.[0] ?? "{}");
		const obj = JSON.parse(raw);
		expect(obj.err).toMatchObject({
			name: "X",
			message: "m",
			stack: "stacktrace",
			extra: 1,
		});
	});

	test("Error inside meta is safely stringified", () => {
		const logger = createLogger({ prodJson: true, level: "info" });
		const metaErr = new Error("inner");
		logger.info("meta error", { e: metaErr });
		const raw = String(logSpy.mock.calls.at(-1)?.[0] ?? "{}");
		const obj = JSON.parse(raw);
		expect(obj.meta?.e?.name).toBe("Error");
		expect(obj.meta?.e?.message).toBe("inner");
		// stack exists but format may vary; just ensure it's a string
		expect(typeof obj.meta?.e?.stack === "string").toBe(true);
	});

	test("createPinoLogger merges customLevels and routes via destination", async () => {
		const fakeFactory = (opts: any, dest: NodeJS.WritableStream) => {
			return {
				// custom level method should exist; simulate writing into dest
				success(msg: string, meta?: any) {
					const obj: any = { level: 35, msg };
					if (meta) {
						Object.assign(obj, meta);
					}
					dest.write(JSON.stringify(obj) + "\n");
				},
				// normal method too
				info(msg: string) {
					dest.write(JSON.stringify({ level: 30, msg }) + "\n");
				},
			};
		};
		const logger: any = createPinoLogger(fakeFactory as any, {
			pinoOptions: { base: null },
			customLevels: { ok: 31 },
		});

		logger.success("yay", { foo: "bar" });
		logger.info("hello");
		await new Promise((r) => setImmediate(r));

		// pretty mode routes success/info to console.log
		expect(logSpy).toHaveBeenCalled();
		const calls = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(calls).toMatch(/yay/);
		expect(calls).toMatch(/hello/);
	});

	test("pino destination handles string numeric level and final() buffer", async () => {
		const dest = createPinoDestination({});
		// write without trailing newline (will be flushed on final())
		dest.write(
			Buffer.from(JSON.stringify({ level: "40", msg: "warn str" }))
		);
		// also write a partial then newline to ensure normal path still works
		dest.write(Buffer.from("\n"));
		(dest as any).end?.();
		await new Promise((r) => setImmediate(r));

		expect(warnSpy).toHaveBeenCalledTimes(1);
		const all = [
			...logSpy.mock.calls.map((c) => String(c[0])),
			...warnSpy.mock.calls.map((c) => String(c[0])),
			...errorSpy.mock.calls.map((c) => String(c[0])),
			...debugSpy.mock.calls.map((c) => String(c[0])),
		].join("\n");
		expect(all).toMatch(/warn str/);
	});
});
