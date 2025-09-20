import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { capitalize } from "@surya/core/string";
import type { IPlugin } from "./types";

/**
 * Normalize a plugin manifest in place
 */
export const normalizePluginManifest = (plugin: IPlugin): void => {
	// Normalize categories
	if (Array.isArray(plugin.category)) {
		plugin.category = plugin.category.map((c) => capitalize(c));
	} else {
		plugin.category = capitalize(plugin.category);
	}

	// Normalize command(s)
	if (Array.isArray(plugin.command)) {
		plugin.command = plugin.command.map((c) => String(c).toLowerCase());
	} else {
		plugin.command = String(plugin.command).toLowerCase();
	}
};

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
