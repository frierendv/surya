import { join } from "node:path";
import mongoose, { Model } from "mongoose";
import { Collection } from "./collection";
import createModel from "./model";
import { DiskStorage } from "./storage";
import type { DatabaseProxy, DBOptions, SchemaMap } from "./types";

export class Database<S extends SchemaMap = any> {
	private storage: DiskStorage;
	private model?: Model<any>;
	private collections = new Map<string, Collection<any>>();

	private proxy: DatabaseProxy<S>;

	constructor(private options: DBOptions = {}) {
		const baseDir = options.file ?? join(__dirname, "db");
		this.storage = new DiskStorage(baseDir);

		// Build proxy for bracket access: db['users'] -> Collection
		const base: any = {
			close: this.close.bind(this),
			collection: this.collection.bind(this),
		};
		this.proxy = new Proxy(base, {
			get: (target, prop: string | symbol) => {
				if (prop in target) {
					return (target as any)[prop as any];
				}
				return this.getCollection(String(prop));
			},
		}) as DatabaseProxy<S>;
	}

	async init(): Promise<void> {
		const opts = this.options;
		if (opts?.mongoConnection || opts?.mongoUri) {
			if (opts.mongoConnection) {
				this.model = createModel(opts.collectionName);
			} else if (opts.mongoUri) {
				await mongoose.connect(opts.mongoUri, opts.mongoOptions || {});
				this.model = createModel(opts.collectionName);
			}
		}
	}

	collection<T = any>(name: string): Collection<T> {
		return this.getCollection(name) as unknown as Collection<T>;
	}

	// Expose the proxy so user code can do db['users']
	get handle(): DatabaseProxy<S> {
		return this.proxy;
	}

	private getCollection(name: string): Collection<any> {
		let col = this.collections.get(name);
		if (!col) {
			col = new Collection(name, this.storage, this.model);
			this.collections.set(name, col);
		}
		return col;
	}

	async close(): Promise<void> {
		if (mongoose.connection.readyState) {
			await mongoose.disconnect();
		}
	}
}

export async function createDatabase<S extends SchemaMap = any>(
	options: DBOptions = {}
): Promise<DatabaseProxy<S>> {
	const db = new Database<S>(options);
	await db.init();
	return db.handle;
}

export default Database;
