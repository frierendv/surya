import { readEnv } from "@surya/core/read-env";
import { Database } from "@surya/database";
import type { DatabaseSchema } from "src/types/database";
import mongoose from "./mongodb";

const dbInstance = new Database<DatabaseSchema>({
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
