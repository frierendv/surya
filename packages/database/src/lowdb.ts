import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import type { RecordValue } from "./types";

export const createLow = (filePath: string) => {
	const adapter = new JSONFile<{ data: Record<string, RecordValue> }>(
		filePath
	);
	const db = new Low(adapter, { data: {} });
	return db;
};

export default createLow;
