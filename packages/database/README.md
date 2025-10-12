# @surya/database

Tiny collection/document store with zero in-memory cache, per-document JSON files on disk, and optional MongoDB sync. Designed for massive datasets with minimal memory usage and an ergonomic, object-like CRUD API.

## Features

- No global in-memory map — each CRUD call hits storage directly (low memory footprint)
- Object-like document editing via a Proxy
  - Example: `const user = await db['users'].get(id); user.money = 1000; await user.save()`
- Pluggable storage adapter (default: disk, per-document JSON files)
- Optional MongoDB sync on save/delete using composite keys (`collection:key`)
- Type-safe collection access using a `SchemaMap` generic
- Small, focused surface area: easy to reason about and maintain

## Install

```bash
npm install @surya/database
# Optional if you plan to use MongoDB sync (mongoose is already a dependency of this package)
npm install mongoose
```

## Quick start

### Disk-only persistence

```ts
import { createDatabase } from '@surya/database';

type Schema = {
 users: { name?: string; money?: number };
};

const db = await createDatabase<Schema>({ file: './data' }); // 'file' is the base directory

const u = await db['users'].get('alice');
u.money = (u.money ?? 0) + 100;
await u.save();

console.log(await db['users'].keys()); // ['alice']
console.log(await db['users'].entries()); // [['alice', { name?: string, money: 100 }]]
```

### With MongoDB sync

```ts
import { createDatabase } from '@surya/database';

type Schema = { users: { name?: string; money?: number } };

const db = await createDatabase<Schema>({
 file: './data',
 mongoUri: 'mongodb://127.0.0.1:27017/mydb',
 collectionName: 'surya_kv',
});

const u = await db['users'].get('bob');
u.name = 'Bob';
u.money = 500;
await u.save(); // persists to disk and upserts to Mongo as key "users:bob"

await db.close(); // disconnects mongoose if connected
```

## API

### createDatabase

```ts
function createDatabase<S extends SchemaMap = any>(options?: DBOptions): Promise<DatabaseProxy<S>>
```

Creates a database instance and returns a proxy handle. The proxy exposes collections through bracket access (`db['users']`).

### DatabaseProxy (generic)

Properties/methods:

- `[collectionName: string]`: `CollectionCrud<T>` — access a collection by name
- `collection<T>(name: string): CollectionCrud<T>` — typed collection accessor
- `close(): Promise<void>` — disconnects MongoDB if connected

### CollectionCrud (generic)

- `get(key: string): Promise<DocumentLike<T>>` — load a document proxy by key (empty object if not present)
- `set(key: string, value: T): Promise<DocumentLike<T>>` — persist and return the document proxy
- `delete(key: string): Promise<void>` — remove document
- `keys(): Promise<string[]>` — list keys in the collection (from disk)
- `entries(): Promise<Array<[string, T]>>` — list `[key, value]` pairs (from disk)

### DocumentLike (generic)

The returned document is a Proxy that:

- Exposes fields of `T` as normal properties you can read/write
- `save(): Promise<void>` — persists to disk and (if configured) upserts to Mongo with `{ key: "collection:key", value, updatedAt }`
- `delete(): Promise<void>` — deletes from disk and (if configured) removes from Mongo
- `toJSON(): T` — returns the raw data

## Configuration (DBOptions)

```ts
interface DBOptions {
 /** Base directory for the per-document JSON files */
 file?: string;
 /** MongoDB connection URI (optional). Enables cloud sync when provided */
 mongoUri?: string;
 /** Use an existing mongoose connection instead of mongoUri */
 mongoConnection?: import('mongoose').Connection;
 /** Mongoose connect options (used when mongoUri is provided) */
 mongoOptions?: import('mongoose').ConnectOptions;
 /** MongoDB collection name for key/value records. Default: 'surya_kv' */
 collectionName?: string;
 /** Reserved for compatibility; not used by the current storage layer */
 debounceMs?: number;
 /** Reserved for compatibility; not used by the current storage layer */
 batchSize?: number;
 /** Optional list of well-known collections for your own typing/autocomplete */
 collections?: string[];
}
```

Notes:

- `file` is a directory path (not a single JSON file). Each document is saved as one JSON file.
- If both `mongoConnection` and `mongoUri` are omitted, only disk storage is used.
- When Mongo is enabled, a composite key `"<collection>:<key>"` is used for upserts/deletes.

## Storage layout (disk)

```txt
<baseDir>/
  <collection>/
    <encodeURIComponent(key)>.json
```

Example: `./data/users/alice%40example.com.json`

## Behavior and edge cases

- `get()` returns a proxy with an empty object when the document doesn’t exist yet
- `delete()` is a no-op if the document doesn’t exist (both disk and Mongo)
- `keys()` and `entries()` read from disk; they don’t query Mongo
- `save()` writes the entire document; partial updates should be applied to the object before calling `save()`
- `updatedAt` is set/updated in Mongo on every `save()`

## Type-safe collections

```ts
type Schema = {
 users: { name: string; money: number };
 groups: { title: string; memberIds: string[] };
};

const db = await createDatabase<Schema>({ file: './data' });
// db['users'] and db['groups'] are now typed
```

## Performance tips

- Avoid holding large objects in memory; read a key, mutate, and save
- Prefer independent operations with `Promise.all` when touching different keys
- `keys()` and `entries()` scan the collection directory — on very large collections, filter by key and call `get()` directly when possible

## Testing examples

The package includes tests for both disk-only and Mongo-backed flows. For Mongo tests we use `mongodb-memory-server`.

```ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createDatabase } from '@surya/database';

const mm = await MongoMemoryServer.create();
const db = await createDatabase({ file: './tmp', mongoUri: mm.getUri(), collectionName: 'surya_kv' });
const u = await db['users'].get('alice');
u.money = 123;
await u.save();
await db.close();
await mm.stop();
```

## License

This package follows the repository license (see top-level `LICENSE`).
