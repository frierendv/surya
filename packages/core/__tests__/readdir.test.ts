import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { readDirFiles, walkDirFiles } from "../src/readdir";

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
});
