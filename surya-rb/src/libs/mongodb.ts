import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
// process.env.MONGODB_URI ?? "mongodb://localhost:27017/surya-rb";

if (!MONGODB_URI) {
	throw new Error("Please define the MONGODB_URI environment variable");
}

type MongooseType = typeof mongoose;

declare global {
	// allow globalThis to cache mongoose connection across module reloads (useful in dev/serverless)
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace NodeJS {
		interface Global {
			__mongoose?: {
				conn?: MongooseType | null;
				promise?: Promise<MongooseType> | null;
			};
		}
	}
}

const globalWithMongoose = global as NodeJS.Global;

if (!globalWithMongoose.__mongoose) {
	globalWithMongoose.__mongoose = { conn: null, promise: null };
}

/**
 * Returns a shared mongoose connection. Safe to call from multiple modules.
 */
export async function connectToDatabase(): Promise<MongooseType> {
	if (!MONGODB_URI) {
		throw new Error("Please define the MONGODB_URI environment variable");
	}

	if (globalWithMongoose.__mongoose!.conn) {
		return globalWithMongoose.__mongoose!.conn as MongooseType;
	}

	if (!globalWithMongoose.__mongoose!.promise) {
		// create and cache the promise
		globalWithMongoose.__mongoose!.promise = mongoose
			.connect(MONGODB_URI)
			.then((m) => {
				globalWithMongoose.__mongoose!.conn = m;
				return m;
			});
	}

	return globalWithMongoose.__mongoose!.promise as Promise<MongooseType>;
}

/**
 * Disconnects the mongoose connection and clears the cache.
 * In many serverless environments you don't want to call this between requests.
 */
export async function disconnectFromDatabase(): Promise<void> {
	if (globalWithMongoose.__mongoose?.conn) {
		await mongoose.disconnect();
		globalWithMongoose.__mongoose = { conn: null, promise: null };
	}
}

export default mongoose;
