import type { TDatabase } from "@/types/database";
import { readEnv } from "@surya/core/read-env";
import { Database } from "@surya/database";
import mongoose from "./mongodb";

const dbInstance = new Database<TDatabase>({
	file: readEnv("SR_DB_DIR", { defaultValue: "./database" }),
	mongoConnection: mongoose.connection,
});

const db = dbInstance.handle;

export const initDatabase = async (): Promise<void> => {
	await dbInstance.init();
};

export const closeDatabase = async (): Promise<void> => {
	await dbInstance.close();
};

export default db;
