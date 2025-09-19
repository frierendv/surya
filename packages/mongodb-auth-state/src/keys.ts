import type { SignalDataTypeMap } from "baileys";
import type { KeyCategory, KVModel } from "./types";
import { fromJSONSafe, keyDocKey, toJSONSafe } from "./utils";

// FIX: errors (“Unexpected token export” or “Cannot use import outside a module”)
// imports with dynamic ones that Jest won’t parse at module load time.
let waProtoPromise: Promise<typeof import("baileys/WAProto")> | null = null;
const getProto = async () => {
	if (!waProtoPromise) {
		waProtoPromise = import("baileys/WAProto");
	}
	const mod = await waProtoPromise;
	return mod.proto;
};

export const readKeysBatch = async (
	KV: KVModel,
	sessionId: string,
	type: keyof SignalDataTypeMap,
	ids: string[]
): Promise<{ [id: string]: any }> => {
	const data: { [id: string]: any } = {};
	if (!ids.length) {
		return data;
	}

	const docKeys = ids.map((id) => keyDocKey(sessionId, type, id));
	const docs = await KV.find({ docKey: { $in: docKeys } })
		.lean()
		.exec();
	const byKey = new Map(docs.map((d) => [d.docKey, d]));

	for (const id of ids) {
		const doc = byKey.get(keyDocKey(sessionId, type, id));
		let value = (doc?.data ?? null) as any;
		if (value) {
			value = await fromJSONSafe(value);
		}
		if (type === "app-state-sync-key" && value) {
			const proto = await getProto();
			value = proto.Message.AppStateSyncKeyData.create(value);
		}
		data[id] = value;
	}

	return data as { [x: string]: SignalDataTypeMap[typeof type] };
};

export const writeKeys = async (
	KV: KVModel,
	sessionId: string,
	data: { [K in KeyCategory]?: { [id: string]: any } }
) => {
	const ops: any[] = [];
	for (const category in data) {
		const valueById = data[category as KeyCategory] as
			| Record<string, any>
			| undefined;
		if (!valueById) {
			continue;
		}

		for (const id in valueById) {
			const value = valueById[id];
			const docKey = keyDocKey(sessionId, category, id);
			if (value) {
				ops.push({
					updateOne: {
						filter: { docKey },
						update: {
							$set: {
								docKey,
								sessionId,
								type: "key",
								category,
								keyId: id,
								data: await toJSONSafe(value),
							},
						},
						upsert: true,
					},
				});
			} else {
				ops.push({ deleteOne: { filter: { docKey } } });
			}
		}
	}

	if (ops.length) {
		await KV.bulkWrite(ops, { ordered: false });
	}
};
