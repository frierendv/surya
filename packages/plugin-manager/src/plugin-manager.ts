import { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import { cpus } from "node:os";
import path, { resolve } from "node:path";
import { debounce } from "@surya/core/debounce";
import { walkDirFiles } from "@surya/core/readdir";
import { Semaphore } from "@surya/core/semaphore";
import type { IPlugin } from "./types";
import { isPlugin, normalizePluginManifest, toFileUrl } from "./util";

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

export class PluginManager extends EventEmitter {
	private readonly options: Required<PluginManagerOptions>;
	private readonly byName = new Map<string, IPlugin>();
	private readonly byFile = new Map<string, IPlugin>();
	private readonly nameToFile = new Map<string, string>();
	private readonly commands = new Map<string, Set<string>>();
	private watcherStop?: () => Promise<void> | void;
	private readonly extSet: Set<string>;
	private readonly inFlight = new Map<string, Promise<void>>();
	private readonly semaphore: Semaphore;

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

	/**
	 * Load all plugins from the rootDir
	 */
	async loadAll(): Promise<void> {
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
			const fileUrl = toFileUrl(abs, this.options.cacheBust);

			let mod: unknown;
			try {
				mod = await import(fileUrl);
			} catch (e) {
				this.emitError(e, abs);
				return;
			}

			const exp = (mod as any)?.default ?? mod;
			const validate = this.options.validate ?? isPlugin;
			if (!validate(exp)) {
				this.emitError(
					new Error(`File does not export a valid plugin: ${abs}`),
					abs
				);
				return;
			}
			const plugin: IPlugin = exp;

			// Check duplicate plugin name across different files
			const registeredFile = this.nameToFile.get(plugin.name);
			if (registeredFile && registeredFile !== abs) {
				this.emitError(
					new Error(
						`Duplicate plugin name '${plugin.name}' from ${abs}; already loaded from ${registeredFile}`
					),
					abs
				);
				return;
			}

			// Normalize plugin manifest values
			normalizePluginManifest(plugin);

			// If we had a previous plugin for this file, unindex it first
			const prev = this.byFile.get(abs);
			if (prev) {
				this.unindexCommands(prev);
				// Only delete byName if it still points to the same previous plugin
				const currentByName = this.byName.get(prev.name);
				if (currentByName === prev) {
					this.byName.delete(prev.name);
				}
				// Clean name->file mapping if it pointed to this file
				if (this.nameToFile.get(prev.name) === abs) {
					this.nameToFile.delete(prev.name);
				}
			}

			// Store new plugin and (re)index
			this.byFile.set(abs, plugin);
			this.byName.set(plugin.name, plugin);
			this.nameToFile.set(plugin.name, abs);
			this.indexCommands(plugin);

			this.emit(isReload ? "updated" : "loaded", abs, plugin);
		} finally {
			this.inFlight.delete(abs);
			resolveInflight?.();
		}
	}

	removeByFile(filePath: string): void {
		const abs = resolve(filePath);
		const plugin = this.byFile.get(abs);
		if (!plugin) {
			return;
		}
		this.byFile.delete(abs);
		this.byName.delete(plugin.name);
		if (this.nameToFile.get(plugin.name) === abs) {
			this.nameToFile.delete(plugin.name);
		}
		this.unindexCommands(plugin);
		this.emit("removed", abs, plugin);
	}

	/**
	 * Start watching for file changes
	 */
	async watch(): Promise<void> {
		if (this.watcherStop) {
			return;
		} // already watching

		const { useChokidar } = this.options;
		if (useChokidar) {
			try {
				const chokidarMod = await import("chokidar");
				const chokidar = (chokidarMod as any).default ?? chokidarMod;
				await this.startChokidar(chokidar);
				return;
			} catch (_err) {
				console.warn(
					"chokidar not available, file watching may be less efficient"
				);
				// fallback to fs.watch
			}
		}
		await this.startFsWatch();
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

	// ---- Internals ----
	private indexCommands(plugin: IPlugin): void {
		for (const key of this.getPluginCommands(plugin)) {
			if (!this.commands.has(key)) {
				this.commands.set(key, new Set());
			}
			this.commands.get(key)!.add(plugin.name);
		}
	}
	private unindexCommands(plugin: IPlugin): void {
		for (const key of this.getPluginCommands(plugin)) {
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

	private getPluginCommands(plugin: IPlugin): string[] {
		const cmds = Array.isArray(plugin.command)
			? plugin.command
			: [plugin.command];
		return cmds.map((c) => String(c).toLowerCase());
	}

	private emitError(error: unknown, filePath?: string) {
		this.emit("error", error, filePath);
	}

	private async startChokidar(chokidar: any): Promise<void> {
		const watcher = chokidar.watch(this.options.rootDir, {
			ignoreInitial: true,
			ignored: (fp: string, stat: unknown) =>
				this.shouldIgnorePath(fp, !!(stat as any)?.isFile?.()),
			persistent: true,
			cwd: undefined,
			awaitWriteFinish: {
				stabilityThreshold: this.options.debounceMs,
				pollInterval: 50,
			},
		});

		const debounced = debounce(
			async (type: "add" | "change" | "unlink", fp: string) => {
				const abs = this.toAbs(fp);
				// Respect ignore predicate here too (in case "ignored" didn't catch it)
				if (this.shouldIgnorePath(abs, true)) {
					return;
				}
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
			const full = this.toAbs(filename);
			if (this.shouldIgnorePath(full, true)) {
				return;
			}
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

	// Concurrency limiter to avoid import() spikes
	private async runLimited<T>(task: () => Promise<T>): Promise<T> {
		await this.semaphore.acquire();
		try {
			return await task();
		} finally {
			this.semaphore.release();
		}
	}

	private toAbs(fp: string): string {
		return path.isAbsolute(fp) ? fp : resolve(this.options.rootDir, fp);
	}
	private shouldIgnorePath(fp: string, isFileGuess: boolean): boolean {
		const abs = this.toAbs(fp);
		const name = path.basename(abs);
		if (this.options.ignore(abs, name)) {
			return true;
		}
		// Only filter by extension for files
		if (isFileGuess && !this.extSet.has(path.extname(abs))) {
			return true;
		}
		return false;
	}

	override on<Ev extends keyof PluginManagerEvents>(
		event: Ev,
		listener: PluginManagerEvents[Ev]
	): this {
		return super.on(event, listener);
	}
	override once<Ev extends keyof PluginManagerEvents>(
		event: Ev,
		listener: PluginManagerEvents[Ev]
	): this {
		return super.once(event, listener);
	}
	override off<Ev extends keyof PluginManagerEvents>(
		event: Ev,
		listener: PluginManagerEvents[Ev]
	): this {
		return super.off(event, listener);
	}
	override emit<Ev extends keyof PluginManagerEvents>(
		event: Ev,
		...args: Parameters<PluginManagerEvents[Ev]>
	): boolean {
		return super.emit(event, ...args);
	}
}
