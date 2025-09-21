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

maybe("useMongoDBAuthState", () => {
	it("throws when no connection and no URI", async () => {
		await expect(useMongoDBAuthState({} as any)).rejects.toThrow(
			/No mongoose connection provided/
		);
	});
	it("connects using URI when provided", async () => {
		const mongod = await MongoMemoryServer.create();
		const uri = mongod.getUri();
		const { state, saveCreds } = await useMongoDBAuthState({
			uri,
			dbName: "surya_test",
			collectionName: "auth_state_uri",
			sessionId: `jest-uri-${Date.now()}`,
		});
		expect(state.creds).toBeDefined();
		await saveCreds();
		await mongoose.disconnect();
		await mongod.stop();
	});
	it("reuses existing ready connection when no URI provided", async () => {
		const mongod = await MongoMemoryServer.create();
		const uri = mongod.getUri();
		await mongoose.connect(uri, { dbName: "surya_test" });
		// Call without connection and without uri -> should reuse global connection
		const { state } = await useMongoDBAuthState({
			collectionName: "auth_state_reuse",
			sessionId: `jest-reuse-${Date.now()}`,
		} as any);
		expect(state.creds).toBeDefined();
		await mongoose.disconnect();
		await mongod.stop();
	});
	it("uses provided connection and reads existing creds from doc", async () => {
		const mongod = await MongoMemoryServer.create();
		const uri = mongod.getUri();
		const conn = await mongoose
			.createConnection(uri, {
				dbName: "surya_test",
			})
			.asPromise();

		const sessionId = `jest-conn-${Date.now()}`;
		const collectionName = "auth_state_conn";
		const first = await useMongoDBAuthState({
			connection: conn as any,
			collectionName,
			sessionId,
		});
		expect(first.state.creds).toBeDefined();
		await first.saveCreds();

		// New instance reads from saved doc path
		const second = await useMongoDBAuthState({
			connection: conn as any,
			collectionName,
			sessionId,
		});
		expect(second.state.creds).toBeDefined();

		await conn.close();
		await mongod.stop();
	});
	it("connects using URI without dbName option", async () => {
		const mongod = await MongoMemoryServer.create();
		const uri = mongod.getUri();

		const out = await useMongoDBAuthState({
			uri,
			collectionName: "auth_state_no_dbname",
			sessionId: `jest-nodb-${Date.now()}`,
		});
		expect(out.state.creds).toBeDefined();

		await mongoose.disconnect();
		await mongod.stop();
	});

	it("initializes and saves creds", async () => {
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

	it("restores Buffers when BufferJSON available", async () => {
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
