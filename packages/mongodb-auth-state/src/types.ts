import type { AuthenticationCreds, SignalDataTypeMap } from "baileys";
import type { Connection, Model } from "mongoose";

export type KeyCategory = keyof SignalDataTypeMap;

export type AuthKV = {
	docKey: string;
	sessionId: string;
	type: "creds" | "key";
	category?: string;
	keyId?: string;
	data: any;
};

export type MongoAuthStateOptions = {
	/**
	 * MongoDB connection URI.
	 * If not provided, a connection must be supplied via `connection`.
	 */
	uri?: string;
	/**
	 * Optional database name to use in the connection.
	 * */
	dbName?: string;
	/**
	 * Name of the MongoDB collection to store authentication data.
	 * Default is "baileys_auth_state".
	 * */
	collectionName?: string;
	/**
	 * Identifier for the session. Default is "default".
	 *
	 */
	sessionId?: string;
	/**
	 * An existing Mongoose connection.
	 * If not provided, a new connection will be created using `uri`.
	 */
	connection?: Connection;
	/**
	 * Name of the Mongoose model to use. Default is "BaileysAuthState".
	 */
	modelName?: string;
};

export type KVModel = Model<AuthKV, object, object>;

export type CredsAndModel = {
	creds: AuthenticationCreds;
	KV: KVModel;
};
