import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { capitalize } from "@surya/core/string";
import type { Plugin } from "./types";

/**
 * Normalize a plugin manifest in place
 */
export const normalizePluginManifest = (plugin: Plugin): void => {
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

/**
 * Dynamically import a module from a file path with optional cache-busting.
 */
export const importModuleFromFile = async (
	absPath: string,
	cacheBust?: boolean
): Promise<unknown> => {
	const url = toFileUrl(absPath, cacheBust);
	return import(url);
};

/** Return the module's default export if present, otherwise the module itself. */
export const getModuleDefault = (mod: unknown): unknown =>
	(mod as any)?.default ?? mod;

const isStringArray = (v: unknown): v is string[] => {
	if (!Array.isArray(v)) {
		return false;
	}
	for (let i = 0; i < v.length; i++) {
		if (typeof v[i] !== "string") {
			return false;
		}
	}
	return true;
};
/**
 * Type guard to check if an object is a Plugin.
 */
export const isPlugin = (obj: unknown): obj is Plugin => {
	if (obj == null || typeof obj !== "object") {
		return false;
	}
	const o = obj as any;

	if (typeof o.name !== "string") {
		return false;
	}

	const cmd = o.command;
	if (!(typeof cmd === "string" || isStringArray(cmd))) {
		return false;
	}

	const cat = o.category;
	if (!(typeof cat === "string" || isStringArray(cat))) {
		return false;
	}

	return true;
};
