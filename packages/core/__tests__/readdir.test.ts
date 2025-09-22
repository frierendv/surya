import { opendir as realOpenDir, readFile as realReadFile } from "fs/promises";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { __setFsForTest, readDirFiles, walkDirFiles } from "../src/readdir";

const makeTmp = () => mkdtempSync(join(tmpdir(), "core-readdir-"));

describe("readdir", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmp();
		mkdirSync(join(dir, "sub"));
		writeFileSync(join(dir, "a.txt"), "A");
		writeFileSync(join(dir, "b.md"), "B");
		writeFileSync(join(dir, "sub", "c.txt"), "C");
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test("readDirFiles reads and filters recursively", async () => {
		const results = await readDirFiles(dir, {
			recursive: true,
			encoding: "utf8",
			filter: (name) => name.endsWith(".txt"),
		});

		const entries = Array.from(results.entries());
		expect(entries.length).toBe(2);
		const contents = entries.map(([, v]) => v).sort();
		expect(contents).toEqual(["A", "C"]);
	});

	test("walkDirFiles iterates files and respects ignore", async () => {
		const paths: string[] = [];
		await walkDirFiles(dir, {
			recursive: true,
			onPath: (p) => {
				paths.push(p);
			},
			ignore: (abs, name) => name === "b.md",
		});
		expect(paths.some((p) => p.endsWith("a.txt"))).toBe(true);
		// cross-platform check for file in sub directory
		expect(paths.map((p) => basename(p)).includes("c.txt")).toBe(true);
		expect(paths.some((p) => p.endsWith("b.md"))).toBe(false);
	});

	test("walkDirFiles non-recursive skips nested files", async () => {
		const paths: string[] = [];
		await walkDirFiles(dir, {
			recursive: false,
			onPath: (p) => paths.push(basename(p)),
		});
		// Should include only top-level files
		expect(paths.includes("a.txt")).toBe(true);
		expect(paths.includes("b.md")).toBe(true);
		// Should NOT include subdirectory file when recursive=false
		expect(paths.includes("c.txt")).toBe(false);
	});

	test("readDirFiles with encoding=null returns Buffers and onFile can throw without failing", async () => {
		const errs: Array<{ err: unknown; ctx?: string }> = [];
		const seen: string[] = [];
		const results = await readDirFiles(dir, {
			recursive: true,
			encoding: null,
			onFile: (p, _buf) => {
				seen.push(basename(p));
				// intentionally throw for one file to ensure it's swallowed
				if (p.endsWith("a.txt")) {
					throw new Error("onFile boom");
				}
			},
			onError: (err, ctx) => errs.push({ err, ctx }),
		});
		// should still include both .txt files
		const vals = Array.from(results.entries()).map(([k, v]) => [
			basename(k),
			v,
		]);
		const bufferValues = vals.filter(([, v]) => Buffer.isBuffer(v));
		expect(bufferValues.length).toBeGreaterThanOrEqual(2);
		// onFile throwing didn't cause global failure
		expect(seen.includes("a.txt")).toBe(true);
		// no directory iteration/open errors expected
		expect(errs.length).toBe(0);
	});

	test("readDirFiles on non-existent directory triggers onError and returns empty map", async () => {
		const fake = join(dir, "does-not-exist");
		const errs: Array<{ err: unknown; ctx?: string }> = [];
		const results = await readDirFiles(fake, {
			recursive: true,
			onError: (err, ctx) => errs.push({ err, ctx }),
		});
		expect(results.size).toBe(0);
		expect(errs.length).toBeGreaterThanOrEqual(1);
		// context should be the attempted directory path
		expect(errs[0]?.ctx).toBeDefined();
	});

	test("walkDirFiles awaits async onPath promises", async () => {
		const seen: string[] = [];
		await walkDirFiles(dir, {
			recursive: true,
			onPath: async (p) => {
				await new Promise((r) => setTimeout(r, 5));
				seen.push(basename(p));
			},
		});
		// ensure async handler collected multiple entries
		expect(seen.length).toBeGreaterThanOrEqual(3);
	});

	test("walkDirFiles captures onPath throw via onError with context path", async () => {
		const errs: Array<{ err: unknown; ctx?: string }> = [];
		await walkDirFiles(dir, {
			recursive: true,
			onPath: (p) => {
				if (p.endsWith("b.md")) {
					throw new Error("handler failed");
				}
			},
			onError: (err, ctx) => errs.push({ err, ctx }),
		});
		const ctxs = errs.map((e) => e.ctx).filter(Boolean) as string[];
		expect(ctxs.some((c) => c.endsWith("b.md"))).toBe(true);
	});
});

describe("readdir iteration error handling", () => {
	afterEach(() => {
		__setFsForTest({ opendir: realOpenDir, readFile: realReadFile });
	});

	test("walkDirFiles swallows iteration errors and reports via onError", async () => {
		const iterError = new Error("iter boom");
		const fakeHandle = {
			[Symbol.asyncIterator]() {
				return {
					async next() {
						throw iterError;
					},
				} as AsyncIterator<unknown>;
			},
			async close() {
				/* noop */
			},
		} as any;
		__setFsForTest({ opendir: async () => fakeHandle });

		const errs: Array<{ err: unknown; ctx?: string }> = [];
		await walkDirFiles("/any/dir", {
			recursive: true,
			onPath: () => {
				// not reached
			},
			onError: (err, ctx) => errs.push({ err, ctx }),
		});
		expect(errs.length).toBeGreaterThanOrEqual(1);
		expect((errs[0]?.err as Error)?.message).toContain("iter boom");
	});

	test("readDirFiles rejects when iteration errors occur", async () => {
		const iterError = new Error("iter boom");
		const fakeHandle = {
			[Symbol.asyncIterator]() {
				return {
					async next() {
						throw iterError;
					},
				} as AsyncIterator<unknown>;
			},
			async close() {
				/* noop */
			},
		} as any;
		__setFsForTest({ opendir: async () => fakeHandle });

		await expect(
			readDirFiles("/any/dir", { recursive: true })
		).rejects.toThrow(/iter boom/);
	});
});
