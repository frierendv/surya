import { createDatabase, Database } from "./database";

export type {
	DBOptions,
	RecordValue,
	SchemaMap,
	DatabaseProxy,
	CollectionCrud,
} from "./types";
export { createModel } from "./model";
export { Database, createDatabase };
export { Collection } from "./collection";
export { Document } from "./document";
export default Database;
