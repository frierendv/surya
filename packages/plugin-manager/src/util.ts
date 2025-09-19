import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { IPlugin } from "./types";

export const toFileUrl = (filePath: string, cacheBust?: boolean): string => {
	const base = pathToFileURL(resolve(filePath)).href;
	if (!cacheBust) {
		return base;
	}
	return `${base}?t=${Date.now()}`;
};

export const isPlugin = (obj: unknown): obj is IPlugin => {
	const o = obj as any;
	return (
		o &&
		typeof o === "object" &&
		typeof o.name === "string" &&
		(typeof o.command === "string" || Array.isArray(o.command)) &&
		typeof o.execute === "function"
	);
};
