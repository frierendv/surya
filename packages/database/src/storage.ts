import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import type { RecordValue } from "./types";

export interface StorageAdapter {
	get(collection: string, key: string): Promise<RecordValue | undefined>;
	set(collection: string, key: string, value: RecordValue): Promise<void>;
	delete(collection: string, key: string): Promise<void>;
	keys(collection: string): Promise<string[]>;
	entries(collection: string): Promise<Array<[string, RecordValue]>>;
}

const encodeKey = (key: string) => encodeURIComponent(key);
const decodeKey = (fileStem: string) => decodeURIComponent(fileStem);

export class DiskStorage implements StorageAdapter {
	constructor(private baseDir: string) {}

	private filePath(collection: string, key: string) {
		return join(this.baseDir, collection, `${encodeKey(key)}.json`);
	}

	private dirFor(collection: string) {
		return join(this.baseDir, collection);
	}

	async get(
		collection: string,
		key: string
	): Promise<RecordValue | undefined> {
		const fp = this.filePath(collection, key);
		try {
			const buf = await fs.readFile(fp, "utf8");
			return JSON.parse(buf);
		} catch (err: any) {
			if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
				return undefined;
			}
			throw err;
		}
	}

	async set(
		collection: string,
		key: string,
		value: RecordValue
	): Promise<void> {
		const fp = this.filePath(collection, key);
		await fs.mkdir(dirname(fp), { recursive: true });
		await fs.writeFile(fp, JSON.stringify(value), "utf8");
	}

	async delete(collection: string, key: string): Promise<void> {
		const fp = this.filePath(collection, key);
		try {
			await fs.unlink(fp);
		} catch (err: any) {
			if (err && err.code === "ENOENT") {
				return;
			}
			throw err;
		}
	}

	async keys(collection: string): Promise<string[]> {
		const dir = this.dirFor(collection);
		try {
			const files = await fs.readdir(dir);
			return files
				.filter((f) => f.endsWith(".json"))
				.map((f) => decodeKey(f.slice(0, -5)));
		} catch (err: any) {
			if (err && err.code === "ENOENT") {
				return [];
			}
			throw err;
		}
	}

	async entries(collection: string): Promise<Array<[string, RecordValue]>> {
		const ks = await this.keys(collection);
		const out: Array<[string, RecordValue]> = [];
		for (const k of ks) {
			const v = await this.get(collection, k);
			if (v !== undefined) {
				out.push([k, v]);
			}
		}
		return out;
	}
}

export default DiskStorage;
