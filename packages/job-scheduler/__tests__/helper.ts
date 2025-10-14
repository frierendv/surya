import fs from "node:fs";
import path from "node:path";

export const createTempDbPath = (name: string) =>
	path.join(process.cwd(), `__tmp_jobs_${name}.sqlite`);

export const cleanupTempDb = (dbPath: string) => {
	try {
		fs.unlinkSync(dbPath);
	} catch {
		// ignore
	}
};
