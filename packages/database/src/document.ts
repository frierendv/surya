import type { Model } from "mongoose";
import type { StorageAdapter } from "./storage";
import type { RecordValue } from "./types";

const compositeKey = (collection: string, key: string) =>
	`${collection}:${key}`;

export class Document<T extends RecordValue = any> {
	private data: T;
	private dirty = false;

	constructor(
		private collection: string,
		private key: string,
		initial: T,
		private storage: StorageAdapter,
		private model?: Model<any>
	) {
		this.data = initial ?? ({} as T);
	}

	static async load<T extends RecordValue = any>(
		collection: string,
		key: string,
		storage: StorageAdapter,
		model?: Model<any>
	): Promise<
		Document<T> & T & { save(): Promise<void>; delete(): Promise<void> }
	> {
		const existing = (await storage.get(collection, key)) as T | undefined;
		const doc = new Document<T>(
			collection,
			key,
			existing ?? ({} as T),
			storage,
			model
		);
		return createDocumentProxy(doc);
	}

	toJSON(): T {
		return this.data;
	}

	async save(): Promise<void> {
		await this.storage.set(this.collection, this.key, this.data);
		if (this.model) {
			const now = new Date();
			await this.model
				.updateOne(
					{ key: compositeKey(this.collection, this.key) },
					{ $set: { value: this.data, updatedAt: now } },
					{ upsert: true }
				)
				.exec();
		}
		this.dirty = false;
	}

	async delete(): Promise<void> {
		await this.storage.delete(this.collection, this.key);
		if (this.model) {
			await this.model
				.deleteOne({ key: compositeKey(this.collection, this.key) })
				.exec();
		}
	}

	// Internal API for proxy access
	_getData(): T {
		return this.data;
	}
	_setData(next: T) {
		this.data = next;
	}
	_markDirty() {
		this.dirty = true;
	}

	async [Symbol.asyncDispose](): Promise<void> {
		if (this.dirty) {
			await this.save();
		}
	}
}

function createDocumentProxy<T extends RecordValue>(
	doc: Document<T>
): Document<T> & T & { save(): Promise<void>; delete(): Promise<void> } {
	return new Proxy(doc as any, {
		get(target, prop, receiver) {
			if (prop in target) {
				return Reflect.get(target, prop, receiver);
			}
			const data = target._getData();
			return (data as any)[prop as any];
		},
		set(target, prop, value, receiver) {
			if (prop in target) {
				return Reflect.set(target, prop, value, receiver);
			}
			const data = { ...target._getData(), [prop as any]: value };
			target._setData(data);
			target._markDirty();
			return true;
		},
		deleteProperty(target, prop) {
			const data = { ...target._getData() };
			// Only mark dirty if the property existed
			if (Object.prototype.hasOwnProperty.call(data, prop)) {
				delete (data as any)[prop as any];
				target._setData(data);
				target._markDirty();
			}
			return true;
		},
		has(target, prop) {
			return prop in target || prop in target._getData();
		},
		ownKeys(target) {
			return Reflect.ownKeys(target._getData()).concat(
				Reflect.ownKeys(target)
			);
		},
		getOwnPropertyDescriptor(target, prop) {
			if (prop in target) {
				return Object.getOwnPropertyDescriptor(target, prop);
			}
			return Object.getOwnPropertyDescriptor(
				target._getData(),
				prop as any
			);
		},
	});
}

export default Document;
