import type { Model } from "mongoose";
import { Document } from "./document";
import type { StorageAdapter } from "./storage";
import type { RecordValue } from "./types";

const compositeKey = (collection: string, key: string) =>
	`${collection}:${key}`;

export class Collection<T extends RecordValue = any> {
	constructor(
		private name: string,
		private storage: StorageAdapter,
		private model?: Model<any>
	) {}

	async get(key: string) {
		return Document.load<T>(this.name, key, this.storage, this.model);
	}

	async set(key: string, value: T) {
		await this.storage.set(this.name, key, value);
		if (this.model) {
			const now = new Date();
			await this.model
				.updateOne(
					{ key: compositeKey(this.name, key) },
					{ $set: { value, updatedAt: now } },
					{ upsert: true }
				)
				.exec();
		}
		return Document.load<T>(this.name, key, this.storage, this.model);
	}

	async delete(key: string) {
		await this.storage.delete(this.name, key);
		if (this.model) {
			await this.model
				.deleteOne({ key: compositeKey(this.name, key) })
				.exec();
		}
	}

	async keys() {
		return this.storage.keys(this.name);
	}

	async entries() {
		return this.storage.entries(this.name);
	}
}

export default Collection;
