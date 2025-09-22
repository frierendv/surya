import { EventEmitter } from "node:events";
import path from "node:path";
import { PluginManager } from "../src";
import type { IPlugin } from "../src/types";

const makePM = (
	over: Partial<ConstructorParameters<typeof PluginManager>[0]> = {}
) =>
	new PluginManager({
		rootDir: path.resolve(__dirname, "../__fixtures__/plugins"),
		extensions: [".ts", ".js"],
		cacheBust: true,
		useChokidar: false,
		...over,
	});

describe("PluginManager", () => {
	const rootDir = path.resolve(__dirname, "../__fixtures__/plugins");

	test("constructor without rootDir throws", () => {
		// @ts-expect-error rootDir missing
		expect(() => new PluginManager({})).toThrow(/rootDir is required/);
	});

	test("loadAll loads plugins and indexes commands", async () => {
		const pm = new PluginManager({
			rootDir,
			extensions: [".ts"],
			cacheBust: true,
			useChokidar: false,
		});
		pm.on("error", () => {});
		const loaded: Array<{ fp: string; plugin: IPlugin }> = [];
		pm.on("loaded", (fp, p) => loaded.push({ fp, plugin: p }));

		await pm.loadAll();

		expect(loaded.length).toBeGreaterThanOrEqual(1);
		const byName = pm.get("fake-1");
		expect(byName?.name).toBe("fake-1");

		const byCmd = pm.findByCommand("FAKE1");
		expect(byCmd.find((p) => p.name === "fake-1")).toBeTruthy();
	});

	test("reloadFromFile replaces and reindexes", async () => {
		const pm = new PluginManager({
			rootDir,
			extensions: [".ts"],
			cacheBust: true,
			useChokidar: false,
		});
		pm.on("error", () => {});
		await pm.loadAll();

		const pluginPath = path.join(rootDir, "fake-1.ts");
		await pm.reloadFromFile(pluginPath);
		const after = pm.get("fake-1");

		expect(after).toBeTruthy();
		const byCmd = pm.findByCommand("fake1");
		expect(byCmd.some((p) => p.name === "fake-1")).toBe(true);
	});

	test("removeByFile removes mappings and command index", async () => {
		const pm = new PluginManager({
			rootDir,
			extensions: [".ts"],
			cacheBust: true,
			useChokidar: false,
		});
		pm.on("error", () => {});
		await pm.loadAll();
		const pluginPath = path.join(rootDir, "fake-1.ts");

		expect(pm.get("fake-1")).toBeTruthy();
		pm.removeByFile(pluginPath);
		expect(pm.get("fake-1")).toBeUndefined();
		expect(pm.findByCommand("fake1")).toHaveLength(0);
	});

	test("list() returns current plugins", async () => {
		const pm = makePM();
		pm.on("error", () => {});
		await pm.loadAll();
		const arr = pm.list();
		expect(Array.isArray(arr)).toBe(true);
		expect(arr.find((p) => p.name === "fake-1")).toBeTruthy();
	});

	test("loadFromFile dedupes in-flight concurrent calls", async () => {
		const pm = makePM();
		const file = path.resolve(
			__dirname,
			"../__fixtures__/plugins/fake-1.ts"
		);
		// Kick off multiple reloads concurrently; should not import same file twice concurrently
		await Promise.all([
			pm.loadFromFile(file),
			pm.loadFromFile(file),
			pm.loadFromFile(file),
		]);
		expect(pm.get("fake-1")).toBeTruthy();
	});

	test("loadFromFile: validate false path emits error", async () => {
		const pm = makePM({
			validate: (_obj: unknown): _obj is any => false,
		});
		const errors: any[] = [];
		pm.on("error", (e) => errors.push(e));
		await pm.loadFromFile(
			path.resolve(__dirname, "../__fixtures__/plugins/fake-1.ts")
		);
		expect(errors.length).toBeGreaterThan(0);
	});

	test("loadFromFile: import error triggers catch and emitError", async () => {
		const pm = makePM();
		const errors: any[] = [];
		pm.on("error", (e) => errors.push(e));
		await pm.loadFromFile(
			path.resolve(__dirname, "../__fixtures__/plugins/boom.ts")
		);
		expect(errors.length).toBeGreaterThan(0);
	});

	test("loadFromFile: duplicate plugin name across different files emits error", async () => {
		const pm = makePM();
		const errors: any[] = [];
		pm.on("error", (e) => errors.push(e));
		const a = path.resolve(
			__dirname,
			"../__fixtures__/plugins/duplicate-a.ts"
		);
		const b = path.resolve(
			__dirname,
			"../__fixtures__/plugins/duplicate-b.ts"
		);
		await pm.loadFromFile(a);
		await pm.loadFromFile(b);
		expect(errors.length).toBeGreaterThan(0);
		// Ensure original still present
		expect(pm.get("dup")).toBeTruthy();
	});

	test("removeByFile when not present is a no-op", () => {
		const pm = makePM();
		// Should not throw
		pm.removeByFile(
			path.resolve(__dirname, "../__fixtures__/plugins/does-not-exist.ts")
		);
	});

	test("unindexCommands handles missing set branch", async () => {
		const pm = makePM();
		(pm as any).unindexCommands({
			name: "zzz",
			command: "not-indexed",
			description: "",
			category: "test",
			execute: () => {},
		});
	});

	test("watch() path uses chokidar when available and wires handlers", async () => {
		// Mock chokidar module and debounce to be synchronous
		jest.mock("chokidar", () => ({
			__esModule: true,
			default: {
				watch: jest.fn(() => {
					const ee = new EventEmitter();
					// Return object with on() and close()
					(ee as any).close = jest.fn();
					return ee;
				}),
			},
		}));
		jest.mock("@surya/core/debounce", () => ({
			__esModule: true,
			debounce: (fn: any) => fn,
		}));
		const { default: chokidar } = await import("chokidar");
		const pm = makePM({ useChokidar: true });
		pm.on("error", () => {});
		await pm.watch();
		// Emit events on the mocked watcher
		const watcher = (chokidar as any).watch.mock.results[0]
			.value as EventEmitter;
		// Use relative path to execute toAbs branch
		watcher.emit("add", "fake-1.ts");
		watcher.emit("change", "fake-1.ts");
		watcher.emit("unlink", "fake-1.ts");
		watcher.emit("error", new Error("werr"));
		await pm.stop();
		jest.resetModules();
	});

	test("watch() falls back to fs.watch when chokidar missing", async () => {
		jest.resetModules();
		// Simulate import failure for chokidar by ensuring it is not resolvable
		// and mock node:fs watch API
		jest.mock("node:fs", () => ({
			__esModule: true,
			watch: jest.fn(() => {
				const ee = new EventEmitter();
				(ee as any).close = jest.fn();
				return ee;
			}),
		}));
		jest.mock("@surya/core/debounce", () => ({
			__esModule: true,
			debounce: (fn: any) => fn,
		}));
		jest.spyOn(console, "warn").mockImplementation(() => {});
		const pm = makePM({ useChokidar: true });
		await pm.watch();
		await pm.stop();
		(jest.spyOn(console, "warn").mock as any).mockRestore?.();
		jest.resetModules();
	});

	test("fs.watch handler filters by extension, handles not-a-file and errors", async () => {
		jest.resetModules();
		const events: any[] = [];
		jest.mock("node:fs", () => ({
			__esModule: true,
			watch: jest.fn(() => {
				const ee = new EventEmitter();
				(ee as any).close = jest.fn();
				return ee;
			}),
		}));
		jest.mock("node:fs/promises", () => ({
			__esModule: true,
			stat: jest.fn(async (fp: string) => ({
				isFile: () => !fp.includes("not-a-file"),
			})),
		}));
		jest.mock("@surya/core/debounce", () => ({
			__esModule: true,
			debounce: (fn: any) => fn,
		}));
		const { watch } = await import("node:fs");
		const pm = makePM({ useChokidar: false });
		pm.on("error", (e, fp) => events.push({ e, fp }));
		await pm.watch();
		const watcher = (watch as any).mock.results[0].value as EventEmitter;
		const jsIgnored = path.resolve(
			__dirname,
			"../__fixtures__/plugins/ignored.js"
		);
		const tsFile = path.resolve(
			__dirname,
			"../__fixtures__/plugins/fake-1.ts"
		);
		const noName: any = undefined;
		watcher.emit("change", "change", noName);
		watcher.emit("change", "change", jsIgnored);
		watcher.emit("change", "change", tsFile);
		const notFile = path.resolve(
			__dirname,
			"../__fixtures__/plugins/not-a-file.ts"
		);
		watcher.emit("change", "change", notFile);
		watcher.emit("error", new Error("fs-err"));
		await pm.stop();
		jest.resetModules();
	});

	test("multi-command plugin indexes both commands", async () => {
		const pm = makePM();
		await pm.loadFromFile(
			path.resolve(__dirname, "../__fixtures__/plugins/multi.ts")
		);
		const arr1 = pm.findByCommand("M1");
		const arr2 = pm.findByCommand("m2");
		expect(arr1[0]?.name).toBe("multi");
		expect(arr2[0]?.name).toBe("multi");
	});

	test("cpu fallback branch (cpus().length || 2)", async () => {
		jest.resetModules();
		jest.doMock("node:os", () => ({
			__esModule: true,
			cpus: () => [],
		}));
		const { PluginManager } = await import("../src");
		const pm = new PluginManager({
			rootDir: rootDir,
			extensions: [".ts"],
			useChokidar: false,
		});
		// Just ensure it constructed and can stop safely
		await pm.stop();
		jest.resetModules();
	});

	test("loadAll onPath catch when validate throws", async () => {
		jest.resetModules();
		const { PluginManager } = await import("../src");
		const pm = new PluginManager({
			rootDir: rootDir,
			extensions: [".ts"],
			cacheBust: true,
			useChokidar: false,
			validate: (_: unknown): _ is any => {
				throw new Error("validate boom");
			},
		});
		const errors: any[] = [];
		pm.on("error", (e, fp) => errors.push({ e, fp }));
		await pm.loadAll();
		expect(errors.length).toBeGreaterThan(0);
	});

	test("walkDirFiles onError handler emits error", async () => {
		jest.resetModules();
		// Mock walkDirFiles to call onError directly
		jest.doMock("@surya/core/readdir", () => ({
			__esModule: true,
			walkDirFiles: async (
				_root: string,
				opts: {
					onError?: (err: unknown, ctx?: string) => void;
				}
			) => {
				opts.onError?.(new Error("walk-error"), "CTX");
			},
		}));
		const { PluginManager } = await import("../src");
		const pm = new PluginManager({
			rootDir: rootDir,
			extensions: [".ts"],
			useChokidar: false,
		});
		const errors: any[] = [];
		pm.on("error", (e, ctx) => errors.push({ e, ctx }));
		await pm.loadAll();
		expect(errors[0]?.e).toBeInstanceOf(Error);
		expect(errors[0]?.ctx).toBe("CTX");
		jest.resetModules();
	});

	test("chokidar ignored callback runs shouldIgnorePath/toAbs", async () => {
		jest.resetModules();
		// Debounce immediate
		jest.doMock("@surya/core/debounce", () => ({
			__esModule: true,
			debounce: (fn: any) => fn,
		}));
		// Mock chokidar and capture options
		const watchMock = jest.fn((_dir: string, _opts: any) => {
			const ee = new EventEmitter();
			(ee as any).close = jest.fn();
			return ee;
		});
		jest.doMock("chokidar", () => ({
			__esModule: true,
			default: { watch: watchMock },
		}));
		const { default: chokidar } = await import("chokidar");
		const { PluginManager } = await import("../src");
		const pm = new PluginManager({
			rootDir: rootDir,
			extensions: [".ts", ".js"],
			cacheBust: true,
			useChokidar: true,
			// Ignore predicate blocks .block.ts by name
			ignore: (_abs: string, name: string) => name.includes(".block."),
		});
		await pm.watch();
		const opts = (chokidar as any).watch.mock.calls[0][1];
		const ignoredFn: (
			fp: string,
			st?: { isFile?: () => boolean }
		) => boolean = opts.ignored;
		// Relative path to ensure toAbs resolves
		expect(
			ignoredFn("relative/file.block.ts", { isFile: () => true })
		).toBe(true);
		// Non-ignored extension and name
		expect(ignoredFn("relative/fake-1.ts", { isFile: () => true })).toBe(
			false
		);
		await pm.stop();
		jest.resetModules();
	});

	test("once() triggers once and off() removes listener", async () => {
		jest.resetModules();
		const { PluginManager } = await import("../src");
		const pm = new PluginManager({
			rootDir: rootDir,
			extensions: [".ts"],
			cacheBust: true,
			useChokidar: false,
		});
		let count = 0;
		pm.once("loaded", () => {
			count++;
		});
		const file = path.resolve(rootDir, "fake-1.ts");
		await pm.loadFromFile(file);
		await pm.loadFromFile(file);
		expect(count).toBe(1);

		const fn = jest.fn();
		pm.on("loaded", fn);
		pm.off("loaded", fn);
		await pm.loadFromFile(file);
		expect(fn).not.toHaveBeenCalled();
	});

	test("watch() early return when already watching (fs.watch)", async () => {
		jest.resetModules();
		// Mock fs.watch
		const fsWatch = jest.fn(() => {
			const ee = new EventEmitter();
			(ee as any).close = jest.fn();
			return ee;
		});
		jest.doMock("node:fs", () => ({
			__esModule: true,
			watch: fsWatch,
		}));
		jest.doMock("@surya/core/debounce", () => ({
			__esModule: true,
			debounce: (fn: any) => fn,
		}));
		const { PluginManager } = await import("../src");
		const pm = new PluginManager({
			rootDir: rootDir,
			extensions: [".ts"],
			useChokidar: false,
		});
		await pm.watch();
		await pm.watch();
		expect(fsWatch).toHaveBeenCalledTimes(1);
		await pm.stop();
		jest.resetModules();
	});

	test("watch() falls back when chokidar import fails and warns", async () => {
		jest.resetModules();
		// Force dynamic import to throw
		jest.doMock("chokidar", () => {
			throw new Error("no-chokidar");
		});
		// Mock fs.watch for fallback
		jest.doMock("node:fs", () => ({
			__esModule: true,
			watch: jest.fn(() => {
				const ee = new EventEmitter();
				(ee as any).close = jest.fn();
				return ee as any;
			}),
		}));
		jest.doMock("@surya/core/debounce", () => ({
			__esModule: true,
			debounce: (fn: any) => fn,
		}));
		const warnSpy = jest
			.spyOn(console, "warn")
			.mockImplementation(() => {});
		const { PluginManager } = await import("../src");
		const pm = new PluginManager({
			rootDir: rootDir,
			extensions: [".ts"],
			useChokidar: true,
		});
		await pm.watch();
		await pm.stop();
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
		jest.resetModules();
	});
});
