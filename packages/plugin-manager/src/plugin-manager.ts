import { cpus } from "node:os";
import path, { resolve } from "node:path";
import { EventEmitter } from "@surya/core/events";
import { walkDirFiles } from "@surya/core/readdir";
import { Semaphore } from "@surya/core/semaphore";
import { loadPluginFromFile } from "./loader";
import { PluginRegistry } from "./registry";
import type { Plugin } from "./types";
import { isPlugin } from "./util";
import { FileWatcher } from "./watcher";

export type PluginManagerEvents = {
	loaded: (filePath: string, plugin: Plugin) => void;
	updated: (filePath: string, plugin: Plugin) => void;
	removed: (filePath: string, previous?: Plugin) => void;
	error: (error: unknown, filePath?: string) => void;
};

export type PluginManagerOptions = {
	/** Root directory to search for plugin files */
	rootDir: string;
	/** File extensions to include */
	extensions?: string[];
	/** Recurse into subdirectories */
	recursive?: boolean;
	/** Optional ignore predicate given an absolute file path */
	ignore?: (absPath: string, direntName: string) => boolean;
	/** Add cache-busting query to dynamic import to force reload */
	cacheBust?: boolean;
	/** Try to use chokidar for watching if available */
	useChokidar?: boolean;
	/** Debounce milliseconds for burst changes */
	debounceMs?: number;
	/**
	 * Max number of concurrent reads.
	 * Default: half the CPU count, min 2
	 */
	concurrency?: number;
	/**
	 * Optionally validate if an object is a plugin.
	 */
	validate?: (obj: unknown) => obj is Plugin;
};

export class PluginManager extends EventEmitter<PluginManagerEvents> {
	private readonly options: Required<PluginManagerOptions>;
	private readonly registry = new PluginRegistry();
	private watcherStop?: () => Promise<void> | void;
	private readonly extSet: Set<string>;
	private readonly inFlight = new Map<string, Promise<void>>();
	private readonly semaphore: Semaphore;
	private readonly watcher: FileWatcher;

	constructor(opts: PluginManagerOptions) {
		super();
		if (!opts.rootDir) {
			throw new Error("PluginManager: rootDir is required");
		}

		const cpuCount = cpus().length || 2;
		const defaultConcurrency = Math.max(2, Math.floor(cpuCount / 2));

		this.options = {
			extensions: [".js"],
			recursive: true,
			cacheBust: true,
			useChokidar: true,
			debounceMs: 100,
			ignore: () => false,
			validate: isPlugin,
			concurrency: defaultConcurrency,
			...opts,
			rootDir: resolve(opts.rootDir),
		};

		this.extSet = new Set(this.options.extensions);
		this.semaphore = new Semaphore(this.options.concurrency);
		this.watcher = new FileWatcher({
			rootDir: this.options.rootDir,
			extensions: this.options.extensions,
			debounceMs: this.options.debounceMs,
			ignore: this.options.ignore,
			useChokidar: this.options.useChokidar,
		});
	}

	/**
	 * Load all plugins from the rootDir
	 */
	async load(): Promise<void> {
		await walkDirFiles(this.options.rootDir, {
			recursive: this.options.recursive,
			filter: (name: string) => this.extSet.has(path.extname(name)),
			ignore: this.options.ignore,
			onPath: (fp: string) =>
				this.runLimited(() => this.loadFromFile(fp)).catch((e) =>
					this.emitError(e, fp)
				),
			onError: (err: unknown, ctx?: string) => this.emitError(err, ctx),
		});
	}

	async reloadFromFile(filePath: string): Promise<void> {
		await this.runLimited(() => this.loadFromFile(filePath, true));
	}

	async loadFromFile(filePath: string, isReload = false): Promise<void> {
		const abs = resolve(filePath);

		// de-duplicate concurrent loads for the same file
		const existing = this.inFlight.get(abs);
		if (existing) {
			await existing;
			return;
		}

		let resolveInflight: (() => void) | undefined;
		const inflight = new Promise<void>((res) => {
			resolveInflight = res;
		});
		this.inFlight.set(abs, inflight);

		try {
			let plugin: Plugin;
			try {
				plugin = await loadPluginFromFile(abs, {
					cacheBust: this.options.cacheBust,
					validate: this.options.validate ?? isPlugin,
				});
			} catch (e) {
				this.emitError(e, abs);
				return;
			}

			// Check duplicate plugin name across different files
			const registeredFile = this.registry.getFileForName(plugin.name);
			if (registeredFile && registeredFile !== abs) {
				this.emitError(
					new Error(
						`Duplicate plugin name '${plugin.name}' from ${abs}; already loaded from ${registeredFile}`
					),
					abs
				);
				return;
			}

			// If we had a previous plugin for this file, delete it from registry first
			const prev = this.registry.getExistingByFile(abs);
			if (prev) {
				this.registry.unindex(prev);
			}

			// Store new plugin (registry.set indexes internally)
			this.registry.set(abs, plugin);

			this.emit(isReload ? "updated" : "loaded", abs, plugin);
		} finally {
			this.inFlight.delete(abs);
			resolveInflight?.();
		}
	}

	removeByFile(filePath: string): void {
		const abs = resolve(filePath);
		const removed = this.registry.removeByFile(abs);
		if (!removed) {
			return;
		}
		this.emit("removed", abs, removed);
	}

	/**
	 * Start watching for file changes
	 */
	async watch(): Promise<void> {
		if (this.watcherStop) {
			return;
		}

		this.watcher.on("add", async (abs) => {
			try {
				await this.reloadFromFile(abs);
			} catch (e) {
				this.emitError(e, abs);
			}
		});
		this.watcher.on("change", async (abs) => {
			try {
				await this.reloadFromFile(abs);
			} catch (e) {
				this.emitError(e, abs);
			}
		});
		this.watcher.on("unlink", (abs) => {
			this.removeByFile(abs);
		});
		this.watcher.on("error", (err) => this.emitError(err));

		await this.watcher.start();
		this.watcherStop = () => this.watcher.stop();
	}

	/**
	 * Stop watching for file changes
	 */
	async stop(): Promise<void> {
		if (this.watcherStop) {
			await this.watcherStop();
			this.watcherStop = undefined;
		}
	}

	private emitError(error: unknown, filePath?: string) {
		this.emit("error", error, filePath);
	}

	// Concurrency limiter to avoid import() spikes
	private async runLimited<T>(task: () => Promise<T>): Promise<T> {
		await this.semaphore.acquire();
		try {
			return await task();
		} finally {
			this.semaphore.release();
		}
	}

	// Lightweight query surface used by external API
	get(name: string): Plugin | undefined {
		return this.registry.getByName(name);
	}
	list(): Plugin[] {
		return this.registry.list();
	}
	findByCommand(cmd: string): Plugin[] {
		return this.registry.findByCommand(cmd);
	}
	find(opts: import("./registry").FindOptions): Plugin[] {
		return this.registry.find(opts);
	}
}
