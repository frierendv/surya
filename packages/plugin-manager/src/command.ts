import type { Plugin } from "./types";

const extractCommandKeys = (plugin: Plugin): string[] => {
	const cmds = Array.isArray(plugin.command)
		? plugin.command
		: [plugin.command];
	return cmds.map((c) => String(c).toLowerCase());
};

/**
 * Maintains an index from command key -> set of plugin names.
 * Keeps only names, so consumers can resolve against their own name->plugin map.
 */
export class Command {
	private readonly map = new Map<string, Set<string>>();

	add(plugin: Plugin): void {
		for (const key of extractCommandKeys(plugin)) {
			let set = this.map.get(key);
			if (!set) {
				set = new Set<string>();
				this.map.set(key, set);
			}
			set.add(plugin.name);
		}
	}

	remove(plugin: Plugin): void {
		for (const key of extractCommandKeys(plugin)) {
			const set = this.map.get(key);
			if (!set) {
				continue;
			}
			set.delete(plugin.name);
			if (set.size === 0) {
				this.map.delete(key);
			}
		}
	}

	/** Return the set of plugin names for a command key (case-insensitive). */
	getNamesByCommand(cmd: string): ReadonlySet<string> | undefined {
		return this.map.get(String(cmd).toLowerCase());
	}
}
