import type { Plugin } from "./types";
import {
	getModuleDefault,
	importModuleFromFile,
	isPlugin,
	normalizePluginManifest,
} from "./util";

export type LoadOptions = {
	cacheBust?: boolean;
	validate?: (obj: unknown) => obj is Plugin;
};

/**
 * Load a plugin module from file, validate its shape, and normalize the manifest in-place.
 * Throws if the module cannot be imported or does not export a valid plugin.
 */
export const loadPluginFromFile = async (
	abs: string,
	opts: LoadOptions
): Promise<Plugin> => {
	const mod = await importModuleFromFile(abs, opts.cacheBust);
	const exp = getModuleDefault(mod);
	const validate = opts.validate ?? isPlugin;
	if (!validate(exp)) {
		throw new Error(`File does not export a valid plugin: ${abs}`);
	}
	const plugin: Plugin = exp as Plugin;
	normalizePluginManifest(plugin);
	return plugin;
};
