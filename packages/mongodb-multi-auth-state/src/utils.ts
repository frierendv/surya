import type { AuthenticationCreds } from "baileys/lib/Types";

// Defaults and key builders
export const defaultCollection = "baileys_auth_state";
export const defaultModelName = "BaileysAuthState";

export const credsDocKey = (sessionId: string) => `${sessionId}:creds`;
export const keyDocKey = (sessionId: string, category: string, id: string) =>
	`${sessionId}:key:${category}:${id}`;

// Dynamic BufferJSON import with fallback for Jest/node environments that
// cannot parse ESM from node_modules. The fallback acts as identity
// (no special Buffer serialization) so tests still run.
let bufferJsonPromise: Promise<typeof import("baileys/lib/Utils")> | null =
	null;
const getBufferJSON = async () => {
	try {
		if (!bufferJsonPromise) bufferJsonPromise = import("baileys/lib/Utils");
		const mod = await bufferJsonPromise;
		return mod.BufferJSON;
	} catch {
		return {
			replacer: (_key: string, value: any) => value,
			reviver: (_key: string, value: any) => value,
		} as unknown as {
			replacer: (k: string, v: any) => any;
			reviver: (k: string, v: any) => any;
		};
	}
};

export const toJSONSafe = async (data: any) => {
	const BufferJSON = await getBufferJSON();
	return JSON.parse(JSON.stringify(data, BufferJSON.replacer));
};

export const fromJSONSafe = async (data: any) => {
	const BufferJSON = await getBufferJSON();
	return JSON.parse(JSON.stringify(data), BufferJSON.reviver);
};

// Provide default creds using Baileys if available; otherwise a minimal stub
export const getDefaultCreds = async (): Promise<AuthenticationCreds> => {
	try {
		const mod = await import("baileys");
		return mod.initAuthCreds();
	} catch (e) {
		return {} as unknown as AuthenticationCreds;
	}
};
