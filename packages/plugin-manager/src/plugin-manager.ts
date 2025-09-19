import { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import { cpus } from "node:os";
import path, { resolve } from "node:path";
import { debounce } from "@surya/core/debounce";
import { walkDirFiles } from "@surya/core/readdir";
import type { IPlugin } from "./types";
import { isPlugin, toFileUrl } from "./util";

export type PluginManagerEvents = {
	loaded: (filePath: string, plugin: IPlugin) => void;
	updated: (filePath: string, plugin: IPlugin) => void;
	removed: (filePath: string, previous?: IPlugin) => void;
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
	validate?: (obj: unknown) => obj is IPlugin;
};

export class PluginManager {
	private options: Required<PluginManagerOptions>;
	private byName = new Map<string, IPlugin>();
	private byFile = new Map<string, IPlugin>();
	private commands = new Map<string, Set<string>>(); // command -> plugin names
	private emitter = new EventEmitter();
	private watcherStop?: () => Promise<void> | void;
	private extSet: Set<string>;
	private inFlight = new Map<string, Promise<void>>();
	private maxConcurrency: number;
	private active = 0;
	private queue: Array<() => void> = [];

	constructor(opts: PluginManagerOptions) {
		this.options = {
			extensions: [".js"],
			recursive: true,
			cacheBust: true,
			useChokidar: true,
			debounceMs: 100,
			ignore: () => false,
			validate: isPlugin,
			concurrency: Math.max(2, cpus()?.length ?? 2),
			...opts,
			rootDir: resolve(opts.rootDir),
		};

		this.extSet = new Set(this.options.extensions);
		this.maxConcurrency = this.options.concurrency;
	}

	// ---- Event API ----
	on<K extends keyof PluginManagerEvents>(
		event: K,
		listener: PluginManagerEvents[K]
	): this {
		this.emitter.on(event, listener as any);
		return this;
	}
	off<K extends keyof PluginManagerEvents>(
		event: K,
		listener: PluginManagerEvents[K]
	): this {
		this.emitter.off(event, listener as any);
		return this;
	}

	// ---- Public getters ----
	get(name: string): IPlugin | undefined {
		return this.byName.get(name);
	}
	list(): IPlugin[] {
		return Array.from(this.byName.values());
	}
	findByCommand(cmd: string): IPlugin[] {
		const key = cmd.toLowerCase();
		const names = this.commands.get(key);
		if (!names) {
			return [];
		}
		const out: IPlugin[] = [];
		for (const n of names) {
			const p = this.byName.get(n);
			if (p) {
				out.push(p);
			}
		}
		return out;
	}

	// ---- Loading ----
	async loadAll(): Promise<void> {
		await walkDirFiles(this.options.rootDir, {
			recursive: this.options.recursive,
			filter: (name: string) => this.extSet.has(path.extname(name)),
			ignore: this.options.ignore,
			onPath: (fp: string) =>
				this.runLimited(() => this.loadFromFile(fp)).catch(
					(e: unknown) => this.emitError(e, fp)
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
		const fileUrl = toFileUrl(abs, this.options.cacheBust);
		let mod: any;
		try {
			mod = await import(fileUrl);
		} catch (e) {
			this.emitError(e, abs);
			this.inFlight.delete(abs);
			resolveInflight?.();
			return;
		}
		const exp = mod?.default ?? mod;
		const validate = this.options.validate ?? isPlugin;
		if (!validate(exp)) {
			this.emitError(
				new Error(`File does not export a valid plugin: ${abs}`),
				abs
			);
			this.inFlight.delete(abs);
			resolveInflight?.();
			return;
		}
		const plugin: IPlugin = exp;

		// If we had a previous plugin for this file, unindex it first
		const prev = this.byFile.get(abs);
		if (prev) {
			this.unindexCommands(prev);
			// Only delete byName if it still points to the same previous plugin
			const currentByName = this.byName.get(prev.name);
			if (currentByName === prev) {
				this.byName.delete(prev.name);
			}
		}

		// Store new plugin and (re)index
		this.byFile.set(abs, plugin);
		this.byName.set(plugin.name, plugin);
		this.indexCommands(plugin);

		this.emitter.emit(isReload ? "updated" : "loaded", abs, plugin);
		this.inFlight.delete(abs);
		resolveInflight?.();
	}

	removeByFile(filePath: string): void {
		const abs = resolve(filePath);
		const plugin = this.byFile.get(abs);
		if (!plugin) {
			return;
		}
		this.byFile.delete(abs);
		this.byName.delete(plugin.name);
		this.unindexCommands(plugin);
		this.emitter.emit("removed", abs, plugin);
	}

	// ---- Watch ----
	async watch(): Promise<void> {
		if (this.watcherStop) {
			return; // already watching
		}

		const { useChokidar } = this.options;
		if (useChokidar) {
			try {
				const chokidar = await import("chokidar").then(
					(m) => m.default || m
				);
				await this.startChokidar(chokidar);
				return;
			} catch {
				// fallback to fs.watch
			}
		}
		await this.startFsWatch();
	}

	async stop(): Promise<void> {
		if (this.watcherStop) {
			await this.watcherStop();
			this.watcherStop = undefined;
		}
	}

	// ---- Internals ----
	private indexCommands(plugin: IPlugin): void {
		const cmds = Array.isArray(plugin.command)
			? plugin.command
			: [plugin.command];
		for (const c of cmds) {
			const key = String(c).toLowerCase();
			if (!this.commands.has(key)) {
				this.commands.set(key, new Set());
			}
			this.commands.get(key)!.add(plugin.name);
		}
	}
	private unindexCommands(plugin: IPlugin): void {
		const cmds = Array.isArray(plugin.command)
			? plugin.command
			: [plugin.command];
		for (const c of cmds) {
			const key = String(c).toLowerCase();
			const set = this.commands.get(key);
			if (!set) {
				continue;
			}
			set.delete(plugin.name);
			if (set.size === 0) {
				this.commands.delete(key);
			}
		}
	}

	private emitError(error: unknown, filePath?: string) {
		this.emitter.emit("error", error, filePath);
	}

	private async startChokidar(chokidar: any): Promise<void> {
		const patterns = this.options.extensions.map((ext) =>
			path.join(
				this.options.rootDir,
				this.options.recursive ? `**/*${ext}` : `*${ext}`
			)
		);
		const watcher = chokidar.watch(patterns, {
			ignoreInitial: true,
			cwd: undefined,
			awaitWriteFinish: {
				stabilityThreshold: this.options.debounceMs,
				pollInterval: 50,
			},
		});

		const debounced = debounce(
			async (type: "add" | "change" | "unlink", fp: string) => {
				const abs = path.isAbsolute(fp)
					? fp
					: resolve(this.options.rootDir, fp);
				try {
					if (type === "unlink") {
						this.removeByFile(abs);
						return;
					}
					// For add/change, (re)load
					await this.reloadFromFile(abs);
				} catch (e) {
					this.emitError(e, abs);
				}
			},
			this.options.debounceMs
		);

		watcher.on("add", (fp: string) => debounced("add", fp));
		watcher.on("change", (fp: string) => debounced("change", fp));
		watcher.on("unlink", (fp: string) => debounced("unlink", fp));
		watcher.on("error", (err: unknown) => this.emitError(err));

		this.watcherStop = async () => {
			await watcher.close();
		};
	}

	private async startFsWatch(): Promise<void> {
		// Minimal fallback for platforms without chokidar. On Windows/macOS, recursive works.
		const { watch } = await import("node:fs");
		const recursive =
			process.platform === "win32" || process.platform === "darwin";
		const watcher = watch(this.options.rootDir, {
			recursive,
		});
		const exts = this.extSet;
		const debounced = debounce(async (evt: string, filename?: string) => {
			if (!filename) {
				return;
			}
			const full = resolve(this.options.rootDir, filename);
			if (!exts.has(path.extname(full))) {
				return;
			}
			try {
				const st = await stat(full).catch(() => undefined);
				if (!st || !st.isFile()) {
					// removed or not a file anymore
					this.removeByFile(full);
					return;
				}
				await this.reloadFromFile(full);
			} catch (e) {
				this.emitError(e, full);
			}
		}, this.options.debounceMs);

		watcher.on("change", (evt, fn) => debounced(evt, fn?.toString()));
		watcher.on("error", (err) => this.emitError(err));

		this.watcherStop = async () => {
			watcher.close();
		};
	}
	// Simple concurrency limiter to avoid import() spikes
	private runLimited<T>(task: () => Promise<T>): Promise<T> {
		if (this.active < this.maxConcurrency) {
			this.active++;
			return task().finally(() => {
				this.active--;
				const next = this.queue.shift();
				if (next) {
					next();
				}
			});
		}
		return new Promise<T>((resolve, reject) => {
			this.queue.push(() => {
				this.active++;
				task()
					.then(resolve, reject)
					.finally(() => {
						this.active--;
						const next = this.queue.shift();
						if (next) {
							next();
						}
					});
			});
		});
	}
}
