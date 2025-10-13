import type { Plugin } from "./types";

const extractCategoryKeys = (plugin: Plugin): string[] => {
	const cats = Array.isArray(plugin.category)
		? plugin.category
		: [plugin.category];
	// Categories are normalized to Capitalized in normalizePluginManifest;
	// we store keys in lowercase for case-insensitive lookup.
	return cats.map((c) => String(c).toLowerCase());
};

/**
 * Maintains an index from category key -> set of plugin names.
 * Keeps only names, so consumers can resolve against their own name->plugin map.
 */
export class Category {
	private readonly map = new Map<string, Set<string>>();

	add(plugin: Plugin): void {
		for (const key of extractCategoryKeys(plugin)) {
			let set = this.map.get(key);
			if (!set) {
				set = new Set<string>();
				this.map.set(key, set);
			}
			set.add(plugin.name);
		}
	}

	remove(plugin: Plugin): void {
		for (const key of extractCategoryKeys(plugin)) {
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

	/** Return the set of plugin names for a category key (case-insensitive). */
	getNamesByCategory(cat: string): ReadonlySet<string> | undefined {
		return this.map.get(String(cat).toLowerCase());
	}
}
