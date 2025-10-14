import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../src";

// @ts-expect-error read only property is not assignable
Symbol.asyncDispose ??= Symbol("Symbol.asyncDispose");

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

	test("collection() method returns same instance as bracket access", async () => {
		type Schema = { items: { x?: number } };
		const db = await createDatabase<Schema>({ file: baseDir });

		const c1 = db.collection("items");
		const c2 = db["items"];
		expect(c1).toBe(c2);
	});

	test("close() can be called multiple times without error", async () => {
		const db = await createDatabase({ file: baseDir });
		await db.close();
		await db.close();
	});

	test("await using with document auto-saves on scope exit", async () => {
		type Schema = { users: { money?: number } };
		const db = await createDatabase<Schema>({ file: baseDir });

		const updated = async () => {
			await using user = await db["users"].get("alice");
			user.money = 10;
		};
		await updated();

		const u2 = await db["users"].get("alice");
		expect(u2.money).toBe(10);
	});

	test("await using with database auto-closes on scope exit", async () => {
		type Schema = { users: { money?: number } };
		let closed = false;

		await using db = await createDatabase<Schema>({
			file: baseDir,
		});
		const origClose = db.close.bind(db);
		db.close = async () => {
			closed = true;
			await origClose();
		};

		const u1 = await db["users"].get("u1");
		u1.money = 20;
		await u1.save();

		expect(closed).toBe(false);
	});
});
