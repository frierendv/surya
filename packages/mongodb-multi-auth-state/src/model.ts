import { Schema, type Connection, type Model } from "mongoose";
import type { AuthKV } from "./types";

export const getKVModel = (
	conn: Connection,
	collectionName: string,
	modelName: string
): Model<AuthKV> => {
	const existing = conn.models?.[modelName] as Model<AuthKV> | undefined;
	if (existing) return existing;

	const schema = new Schema<AuthKV>(
		{
			docKey: { type: String, required: true, index: true, unique: true },
			sessionId: { type: String, required: true, index: true },
			type: { type: String, enum: ["creds", "key"], required: true },
			category: { type: String },
			keyId: { type: String },
			data: { type: Schema.Types.Mixed },
		},
		{ collection: collectionName, timestamps: true }
	);

	schema.index({ sessionId: 1, type: 1, category: 1, keyId: 1 });

	return conn.model<AuthKV>(modelName, schema);
};
