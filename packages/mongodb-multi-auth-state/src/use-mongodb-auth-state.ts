import type { AuthenticationCreds } from "baileys/lib/Types";
import {
	connect as mongooseConnect,
	connection as mongooseConnection,
	type Connection,
} from "mongoose";
import { readKeysBatch, writeKeys } from "./keys";
import { getKVModel } from "./model";
import type { MongoAuthStateOptions, UseAuthStateResult } from "./types";
import {
	credsDocKey,
	defaultCollection,
	defaultModelName,
	fromJSONSafe,
	getDefaultCreds,
	toJSONSafe,
} from "./utils";

/**
 * A MongoDB-based authentication state manager for Baileys.
 * @param options Configuration options for MongoDB connection and session.
 * @returns An object containing the authentication state and a function to save credentials.
 */
export const useMongoDBAuthState = async (
	options: MongoAuthStateOptions
): Promise<UseAuthStateResult> => {
	const {
		uri,
		dbName,
		collectionName = defaultCollection,
		sessionId = "default",
		connection,
		modelName = defaultModelName,
	} = options || {};

	// Ensure a mongoose connection is available
	let conn: Connection;
	if (connection) {
		conn = connection;
	} else {
		if (!uri) {
			if (mongooseConnection?.readyState === 1) {
				conn = mongooseConnection as unknown as Connection;
			} else {
				throw new Error(
					"No mongoose connection provided and no URI specified to connect."
				);
			}
		} else {
			await mongooseConnect(uri, dbName ? { dbName } : undefined);
			conn = mongooseConnection as unknown as Connection;
		}
	}

	const KV = getKVModel(conn, collectionName, modelName);

	// Load or initialize creds
	const doc = await KV.findOne({ docKey: credsDocKey(sessionId) })
		.lean()
		.exec();
	const creds: AuthenticationCreds =
		doc?.data && Object.keys(doc.data).length > 0
			? await fromJSONSafe(doc.data)
			: await getDefaultCreds();

	return {
		state: {
			creds,
			keys: {
				get: async (type, ids) =>
					readKeysBatch(KV, sessionId, type, ids),
				set: async (data) => writeKeys(KV, sessionId, data),
			},
		},
		saveCreds: async () => {
			const docKey = credsDocKey(sessionId);
			await KV.updateOne(
				{ docKey },
				{
					$set: {
						docKey,
						sessionId,
						type: "creds",
						data: await toJSONSafe(creds),
					},
				},
				{ upsert: true }
			).exec();
		},
	};
};

export default useMongoDBAuthState;
