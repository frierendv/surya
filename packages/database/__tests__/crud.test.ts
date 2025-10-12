import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../src";

describe("database CRUD (disk only)", () => {
	let baseDir: string;

	beforeEach(async () => {
		const prefix = join(tmpdir(), "surya-db-test-");
		// use mkdtemp for a unique per-test directory
		baseDir = await fs.mkdtemp(prefix);
	});

	afterEach(async () => {
		// cleanup temp folder recursively
		await fs.rm(baseDir, { recursive: true, force: true });
	});

	test("get -> mutate -> save -> get persists changes", async () => {
		type Schema = {
			users: { money?: number; name?: string };
		};
		const db = await createDatabase<Schema>({ file: baseDir });

		const u1 = await db["users"].get("user-1");
		expect(u1.money).toBeUndefined();

		u1.money = 1000;
		u1.name = "Alice";
		await u1.save();

		const u1b = await db["users"].get("user-1");
		expect(u1b.money).toBe(1000);
		expect(u1b.name).toBe("Alice");
	});

	test("delete removes document and subsequent get is empty", async () => {
		type Schema = { users: { coins?: number } };
		const db = await createDatabase<Schema>({ file: baseDir });

		const u = await db["users"].get("user-2");
		u.coins = 5;
		await u.save();

		await u.delete();

		const u2 = await db["users"].get("user-2");
		expect(u2.coins).toBeUndefined();
	});

	test("keys and entries reflect current persisted docs", async () => {
		type Schema = { users: { v?: number } };
		const db = await createDatabase<Schema>({ file: baseDir });

		await (await db["users"].get("a")).save();
		const b = await db["users"].get("b");
		b.v = 2;
		await b.save();

		const keys = await db["users"].keys();
		expect(new Set(keys)).toEqual(new Set(["a", "b"]));

		const entries = await db["users"].entries();
		const map = new Map(entries);
		expect(map.get("a")).toEqual({});
		expect(map.get("b")).toEqual({ v: 2 });
	});
});
