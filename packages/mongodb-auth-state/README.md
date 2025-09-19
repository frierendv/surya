# @surya/mongodb-auth-state

MongoDB-backed Baileys multi-file auth state replacement. Persists creds and signal keys in a single MongoDB collection using Mongoose.

## Install

This package expects Mongoose available as a dependency in the workspace. If you're consuming the built package separately, install:

- mongoose
- baileys (peer/dev as needed)

## Usage

```ts
import { useMongoDBAuthState } from "@surya/mongodb-auth-state";
import { makeWASocket } from "baileys";

async function main() {
 const { state, saveCreds } = await useMongoDBAuthState({
  uri: process.env.MONGO_URI!,
  dbName: process.env.MONGO_DB || "surya",
  collectionName: "whatsapp_auth_state",
  sessionId: "session-1",
 });

 const sock = makeWASocket({ auth: state });
 sock.ev.on("creds.update", saveCreds);
}

main();
```

### Options

- uri: MongoDB connection URI. If omitted, you must pass an existing `connection` or have a global mongoose connection already open.
- dbName: Optional database name when connecting with `uri`.
- collectionName: Collection to store documents in. Defaults to `whatsapp_auth_state`.
- sessionId: Unique identifier to namespace your session. Default `default`.
- connection: Provide an existing mongoose `Connection` instead of creating a new one.
- modelName: Override the model name to avoid clashes when sharing connections.

## Notes

- Keys are batched using `bulkWrite` for efficiency.
- `app-state-sync-key` values are hydrated using `proto.Message.AppStateSyncKeyData.create` when read.
- `saveCreds` persists creds and should be attached to the `creds.update` event.

## Testing with mongodb-memory-server

This package includes a Jest smoke test that uses `mongodb-memory-server` to run without a real Mongo instance.

- If `mongodb-memory-server` is not installed, the test suite is skipped automatically.
- To run the memory-backed test, install the dev dependency and run jest:

```bash
npm i -D mongodb-memory-server
npm test -w @surya/mongodb-auth-state
```

The test will spin up an in-memory MongoDB instance, connect via Mongoose, initialize the auth state, save creds, and tear down cleanly.

## License

This project is licensed under the terms of the [MIT license](https://github.com/frierendv/surya/blob/main/LICENSE).
