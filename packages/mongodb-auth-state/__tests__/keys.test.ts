import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { readKeysBatch, writeKeys } from "../src/keys";

// Minimal in-memory KV mock implementing the chained API used by keys.ts
type KVDoc = { docKey: string; data: any };

describe("KV", () => {
	let store: Map<string, KVDoc>;
	let lastBulkOps: any[] | null;

	const makeKV = () => {
		return {
			find: (query: any) => {
				const keys: string[] = query?.docKey?.$in ?? [];
				const rows = keys
					.map((k) => store.get(k))
					.filter((v): v is KVDoc => !!v);
				return {
					lean: () => ({
						exec: async () => rows,
					}),
				};
			},
			bulkWrite: jest.fn(async (ops: any[]) => {
				lastBulkOps = ops;
				// Apply the ops to our store to simulate persistence
				for (const op of ops) {
					if (op.updateOne) {
						const docKey = op.updateOne.filter.docKey as string;
						const data = op.updateOne.update.$set.data;
						store.set(docKey, { docKey, data });
					} else if (op.deleteOne) {
						const docKey = op.deleteOne.filter.docKey as string;
						store.delete(docKey);
					}
				}
			}),
		} as any;
	};

	beforeEach(() => {
		store = new Map<string, KVDoc>();
		lastBulkOps = null;
	});

	test("readKeysBatch returns empty object for empty ids", async () => {
		const KV = makeKV();
		const out = await readKeysBatch(KV, "sess", "session" as any, []);
		expect(out).toEqual({});
	});

	test("readKeysBatch maps found docs to ids", async () => {
		const KV = makeKV();
		// Preload two docs
		store.set("sess:key:session:a", {
			docKey: "sess:key:session:a",
			data: { foo: 1 },
		});
		store.set("sess:key:session:b", {
			docKey: "sess:key:session:b",
			data: { bar: 2 },
		});

		const res = await readKeysBatch(KV, "sess", "session" as any, [
			"a",
			"b",
			"c",
		]);
		expect(res).toEqual({
			a: { foo: 1 },
			b: { bar: 2 },
			c: null,
		});
	});

	test("writeKeys performs upsert and delete ops", async () => {
		const KV = makeKV();
		await writeKeys(KV, "sess", {
			// cast as any to avoid pulling Baileys types
			session: {
				keep: { hello: "world" },
				drop: undefined as any,
			},
		} as any);

		expect(lastBulkOps).toBeTruthy();
		// Should contain one updateOne and one deleteOne
		const kinds = lastBulkOps!.map((op) =>
			op.updateOne ? "updateOne" : "deleteOne"
		);
		expect(kinds.sort()).toEqual(["deleteOne", "updateOne"]);

		// And store should reflect the upsert and delete
		expect(store.get("sess:key:session:keep")?.data).toEqual({
			hello: "world",
		});
		expect(store.has("sess:key:session:drop")).toBe(false);
	});
});
