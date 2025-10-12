import mongoose, { Model, Schema } from "mongoose";

export const createModel = (collectionName = "surya_kv") => {
	const schema = new Schema(
		{
			key: { type: String, required: true, index: true, unique: true },
			value: { type: Schema.Types.Mixed },
			updatedAt: { type: Date, default: Date.now },
		},
		{ collection: collectionName }
	);

	if ((mongoose as any).models && (mongoose as any).models[collectionName]) {
		return (mongoose as any).models[collectionName] as Model<any>;
	}
	return mongoose.model(collectionName, schema);
};

export default createModel;
