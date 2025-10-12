import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createDatabase } from "../src";

// Note: Database.close() will disconnect mongoose default connection

describe("database Mongo integration", () => {
	let mm: MongoMemoryServer;
	let mongoUri: string;
	let baseDir: string;
	const collectionName = "surya_kv_test";

	beforeAll(async () => {
		mm = await MongoMemoryServer.create();
		mongoUri = mm.getUri();
	});

	afterAll(async () => {
		await mm.stop();
	});

	beforeEach(async () => {
		const prefix = join(tmpdir(), "surya-db-mongo-");
		baseDir = await fs.mkdtemp(prefix);
	});

	afterEach(async () => {
		await fs.rm(baseDir, { recursive: true, force: true });
	});

	test("save() writes document to Mongo with composite key", async () => {
		type Schema = { users: { money?: number } };
		const db = await createDatabase<Schema>({
			file: baseDir,
			mongoUri,
			collectionName,
		});

		const user = await db["users"].get("alice");
		user.money = 100;
		await user.save();

		const coll = mongoose.connection.db!.collection(collectionName);
		const doc = await coll.findOne({ key: "users:alice" });
		expect(doc).toBeTruthy();
		expect(doc?.value).toEqual({ money: 100 });
		expect(typeof doc?.updatedAt).toBe("object");

		await db.close();
	});

	test("delete() removes document from Mongo", async () => {
		type Schema = { users: { coins?: number } };
		const db = await createDatabase<Schema>({
			file: baseDir,
			mongoUri,
			collectionName,
		});

		const u = await db["users"].get("bob");
		u.coins = 1;
		await u.save();
		await u.delete();

		const coll = mongoose.connection.db!.collection(collectionName);
		const doc = await coll.findOne({ key: "users:bob" });
		expect(doc).toBeNull();

		await db.close();
	});

	test("collection.set persists to Mongo", async () => {
		type Schema = { users: { name?: string } };
		const db = await createDatabase<Schema>({
			file: baseDir,
			mongoUri,
			collectionName,
		});

		await db["users"].set("carol", { name: "Carol" });

		const coll = mongoose.connection.db!.collection(collectionName);
		const doc = await coll.findOne({ key: "users:carol" });
		expect(doc?.value).toEqual({ name: "Carol" });

		await db.close();
	});

	test("rapid consecutive saves persist last value", async () => {
		type Schema = { users: { v?: number } };
		const db = await createDatabase<Schema>({
			file: baseDir,
			mongoUri,
			collectionName,
		});

		const u = await db["users"].get("rapid");
		for (let i = 1; i <= 5; i++) {
			u.v = i;
			// rapid sequential saves
			await u.save();
		}

		const coll = mongoose.connection.db!.collection(collectionName);
		const doc = await coll.findOne({ key: "users:rapid" });
		expect(doc?.value).toEqual({ v: 5 });

		await db.close();
	});

	test("delete on non-existent document is a no-op", async () => {
		type Schema = { users: { any?: string } };
		const db = await createDatabase<Schema>({
			file: baseDir,
			mongoUri,
			collectionName,
		});

		const ghost = await db["users"].get("ghost");
		await expect(ghost.delete()).resolves.toBeUndefined();

		const coll = mongoose.connection.db!.collection(collectionName);
		const doc = await coll.findOne({ key: "users:ghost" });
		expect(doc).toBeNull();

		await db.close();
	});

	test("entries() reflect persisted docs; corresponding Mongo docs exist", async () => {
		type Schema = { users: { n?: number } };
		const db = await createDatabase<Schema>({
			file: baseDir,
			mongoUri,
			collectionName,
		});

		const a = await db["users"].get("ea");
		a.n = 1;
		await a.save();
		await db["users"].set("eb", { n: 2 });

		const entries = await db["users"].entries();
		const map = new Map(entries);
		expect(map.get("ea")).toEqual({ n: 1 });
		expect(map.get("eb")).toEqual({ n: 2 });

		const coll = mongoose.connection.db!.collection(collectionName);
		const [docA, docB] = await Promise.all([
			coll.findOne({ key: "users:ea" }),
			coll.findOne({ key: "users:eb" }),
		]);
		expect(docA?.value).toEqual({ n: 1 });
		expect(docB?.value).toEqual({ n: 2 });

		await db.close();
	});
});
