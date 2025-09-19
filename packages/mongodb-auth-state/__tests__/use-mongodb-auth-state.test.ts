import { describe, expect, test } from "@jest/globals";
import mongoose from "mongoose";
import { useMongoDBAuthState } from "../src/use-mongodb-auth-state";

// Use mongodb-memory-server when available; otherwise skip the suite.
let MongoMemoryServer: any = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	MongoMemoryServer = require("mongodb-memory-server").MongoMemoryServer;
} catch {
	// module not installed; we'll skip
}

const maybe = MongoMemoryServer ? describe : describe.skip;

maybe("useMongoDBAuthState (memory server)", () => {
	test("initializes and saves creds", async () => {
		const mongod = await MongoMemoryServer.create();
		const uri = mongod.getUri();

		await mongoose.connect(uri, { dbName: "surya_test" });
		const { state, saveCreds } = await useMongoDBAuthState({
			connection: mongoose.connection,
			collectionName: "whatsapp_auth_state_test",
			sessionId: `jest-${Date.now()}`,
		});

		expect(state.creds).toBeDefined();

		await saveCreds();

		await mongoose.disconnect();
		await mongod.stop();
	});

	test("restores Buffers when BufferJSON available", async () => {
		// Attempt to import Baileys Utils (ESM). If not available, skip assertions.
		let bufferJsonOk = false;
		try {
			await import("baileys/lib/Utils");
			bufferJsonOk = true;
		} catch {
			// Not available in this environment; exit test early.
			return;
		}

		const mongod = await MongoMemoryServer.create();
		const uri = mongod.getUri();

		await mongoose.connect(uri, { dbName: "surya_test" });
		const { state } = await useMongoDBAuthState({
			connection: mongoose.connection,
			collectionName: "whatsapp_auth_state_test",
			sessionId: `jest-${Date.now()}`,
		});

		const original = Buffer.from("hello world");
		// Write a key that contains a Buffer
		await state.keys.set({
			// cast to any to satisfy the mapped type without pulling in Baileys types here
			session: {
				"buf-test": { payload: original },
			},
		} as any);

		const out = await state.keys.get("session" as any, ["buf-test"]);
		const restored = (out as any)["buf-test"]?.payload;

		if (bufferJsonOk) {
			expect(Buffer.isBuffer(restored)).toBe(true);
			expect((restored as Buffer).equals(original)).toBe(true);
		}

		await mongoose.disconnect();
		await mongod.stop();
	});
});
