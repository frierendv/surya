import { resolve } from "node:path";
import { Category } from "./category";
import { Command } from "./command";
import type { Plugin } from "./types";

export type FindOptions = {
	/** Case-insensitive command key to match. */
	command?: string;
	/** Case-insensitive category to match. */
	category?: string;
	/** Include disabled plugins in results. Default false. */
	includeDisabled?: boolean;
	/**
	 * Additional flags to filter common options quickly without executing predicates.
	 */
	ownerOnly?: boolean;
	adminOnly?: boolean;
	privateChatOnly?: boolean;
	groupChatOnly?: boolean;
	/** Optional custom predicate applied last to the candidate set. */
	where?: (p: Plugin) => boolean;
};

export class PluginRegistry {
	private readonly byName = new Map<string, Plugin>();
	private readonly byFile = new Map<string, Plugin>();
	private readonly nameToFile = new Map<string, string>();
	private readonly cmd = new Command();
	private readonly cat = new Category();

	getByName(name: string): Plugin | undefined {
		return this.byName.get(name);
	}

	list(): Plugin[] {
		return Array.from(this.byName.values());
	}

	findByCommand(cmd: string): Plugin[] {
		const names = this.cmd.getNamesByCommand(cmd);
		if (!names) {
			return [];
		}
		const out: Plugin[] = [];
		for (const n of names) {
			const p = this.byName.get(n);
			if (p) {
				out.push(p);
			}
		}
		return out;
	}

	/** Advanced, fast lookup with pre-index seeding. */
	find(opts: FindOptions): Plugin[] {
		let candidates: Plugin[] | undefined;
		if (opts.command) {
			candidates = this.findByCommand(opts.command);
		}
		if (opts.category) {
			const cn = this.cat.getNamesByCategory(opts.category);
			const arr: Plugin[] = [];
			if (cn) {
				for (const n of cn) {
					const p = this.byName.get(n);
					if (p) {
						arr.push(p);
					}
				}
			}
			candidates = candidates
				? candidates.filter((p) => arr.includes(p))
				: arr;
		}
		if (!candidates) {
			candidates = this.list();
		}

		// fast flags
		if (!opts.includeDisabled) {
			candidates = candidates.filter((p) => !p.disabled);
		}
		if (opts.ownerOnly != null) {
			candidates = candidates.filter(
				(p) => !!p.ownerOnly === !!opts.ownerOnly
			);
		}
		if (opts.adminOnly != null) {
			candidates = candidates.filter(
				(p) => !!p.adminOnly === !!opts.adminOnly
			);
		}
		if (opts.privateChatOnly != null) {
			candidates = candidates.filter(
				(p) => !!p.privateChatOnly === !!opts.privateChatOnly
			);
		}
		if (opts.groupChatOnly != null) {
			candidates = candidates.filter(
				(p) => !!p.groupChatOnly === !!opts.groupChatOnly
			);
		}

		if (opts.where) {
			candidates = candidates.filter(opts.where);
		}
		return candidates;
	}

	getFileForName(name: string): string | undefined {
		return this.nameToFile.get(name);
	}

	set(absFile: string, plugin: Plugin): void {
		const prev = this.byFile.get(absFile);
		if (prev) {
			// Remove previous indices and mappings if replacing
			this.cmd.remove(prev);
			this.cat.remove(prev);
			if (this.byName.get(prev.name) === prev) {
				this.byName.delete(prev.name);
			}
			if (this.nameToFile.get(prev.name) === absFile) {
				this.nameToFile.delete(prev.name);
			}
		}
		this.byFile.set(absFile, plugin);
		this.byName.set(plugin.name, plugin);
		this.nameToFile.set(plugin.name, absFile);
		this.cmd.add(plugin);
		this.cat.add(plugin);
	}

	removeByFile(filePath: string): Plugin | undefined {
		const abs = resolve(filePath);
		const plugin = this.byFile.get(abs);
		if (!plugin) {
			return undefined;
		}
		this.byFile.delete(abs);
		this.byName.delete(plugin.name);
		if (this.nameToFile.get(plugin.name) === abs) {
			this.nameToFile.delete(plugin.name);
		}
		this.cmd.remove(plugin);
		this.cat.remove(plugin);
		return plugin;
	}

	getExistingByFile(absFile: string): Plugin | undefined {
		return this.byFile.get(absFile);
	}

	// Minimal surface for indexing (kept internal but callable by manager)
	index(plugin: Plugin): void {
		this.cmd.add(plugin);
		this.cat.add(plugin);
	}
	unindex(plugin: Plugin): void {
		this.cmd.remove(plugin);
		this.cat.remove(plugin);
	}
}
