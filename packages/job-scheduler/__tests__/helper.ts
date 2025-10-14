import fs from "node:fs";
import path from "node:path";
import { JobStore } from "../src/sqlite";

export const createTempDbPath = (name: string) =>
	path.join(process.cwd(), `__tmp_jobs_${name}.sqlite`);

export const cleanupTempDb = (dbPath: string) => {
	try {
		fs.unlinkSync(dbPath);
	} catch {
		// ignore
	}
};

export const getJobStore = async (name: string) => {
	const dbPath = createTempDbPath(name);
	const store = new JobStore(dbPath);
	await new Promise((r) => setTimeout(r, 5000)); // wait for DB to be ready
	return {
		store,
		clear: () => {
			store.clearAllJob();
		},
		close: () => {
			store.close();
			cleanupTempDb(dbPath);
		},
	};
};
