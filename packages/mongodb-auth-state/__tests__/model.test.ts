import { describe, expect, test } from "@jest/globals";
import mongoose from "mongoose";
import { getKVModel } from "../src/model";

// Use mongodb-memory-server when available; otherwise skip the suite.
let MongoMemoryServer: any = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	MongoMemoryServer = require("mongodb-memory-server").MongoMemoryServer;
} catch {
	// module not installed; we'll skip
}

const maybe = MongoMemoryServer ? describe : describe.skip;

maybe("model.getKVModel existing", () => {
	test("returns existing model on second call", async () => {
		const mongod = await MongoMemoryServer.create();
		const uri = mongod.getUri();

		await mongoose.connect(uri, { dbName: "surya_test" });
		const conn = mongoose.connection;
		const first = getKVModel(conn as any, "kv_test", "KVTestModel");
		const second = getKVModel(conn as any, "kv_test", "KVTestModel");
		expect(second).toBe(first);

		await mongoose.disconnect();
		await mongod.stop();
	});
});
