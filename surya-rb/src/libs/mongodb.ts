import { readEnv } from "@surya/core/read-env";
import mongoose from "mongoose";

type MongooseType = typeof mongoose;

declare global {
	var __mongoose:
		| {
				conn: MongooseType | null;
				promise: Promise<MongooseType> | null;
		  }
		| undefined;
}

const cached = (globalThis.__mongoose ??= { conn: null, promise: null });

const uri = readEnv("SR_MONGODB_URI", { required: true });
const dbName = readEnv("SR_MONGODB_DB_NAME", { defaultValue: "surya-rb" });

/**
 * Returns a shared mongoose connection. Safe to call from multiple modules.
 */
export async function connectToDatabase(): Promise<MongooseType> {
	if (cached.conn) {
		return cached.conn;
	}

	if (!cached.promise) {
		cached.promise = mongoose
			.connect(uri, { dbName })
			.then((m) => {
				cached.conn = m;
				return m;
			})
			.catch((err) => {
				// allow retries on next call
				cached.promise = null;
				throw err;
			});
	}

	return cached.promise;
}

/**
 * Disconnects the mongoose connection and clears the cache.
 * In many serverless environments you don't want to call this between requests.
 */
export async function disconnectFromDatabase(): Promise<void> {
	if (cached.conn) {
		await mongoose.disconnect();
		cached.conn = null;
		cached.promise = null;
	}
}

export default mongoose;
