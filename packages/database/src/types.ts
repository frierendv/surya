import type { Connection, ConnectOptions } from "mongoose";

export type RecordValue = any;

export interface DBOptions {
	/** path to JSON file for lowdb. If not provided, defaults to ./db.json in package dir */
	file?: string;
	/** optional mongo connection URI. If provided, the module will connect and enable cloud sync */
	mongoUri?: string;
	/** alternatively, pass an existing mongoose connection to use */
	mongoConnection?: Connection;
	/** optional mongoose connect options (used with mongoUri) */
	mongoOptions?: ConnectOptions;
	/** collection name to use in MongoDB */
	collectionName?: string;
	/** debounce time in ms before flushing pending local changes to MongoDB */
	debounceMs?: number;
	/** maximum number of operations per bulk write */
	batchSize?: number;
	/** optional list of top-level collections to expose, e.g., ["users","groups","settings"] */
	collections?: string[];
}

export type PendingOp =
	| { type: "set"; value: RecordValue }
	| { type: "delete" };

// New generic typing for collection-based API
export type SchemaMap = Record<string, any>;

export type DocumentLike<T> = T & {
	save(): Promise<void>;
	delete(): Promise<void>;
};

export interface CollectionCrud<T = any> {
	get(key: string): Promise<DocumentLike<T>>;
	set(key: string, value: T): Promise<DocumentLike<T>>;
	delete(key: string): Promise<void>;
	keys(): Promise<string[]>;
	entries(): Promise<Array<[string, T]>>;
}

export type DatabaseProxy<S extends SchemaMap = any> = {
	[K in keyof S]: CollectionCrud<S[K]>;
} & {
	[k: string]: CollectionCrud<any>;
} & {
	close(): Promise<void>;
	collection<T = any>(name: string): CollectionCrud<T>;
};

// no default export — prefer named exports for types
