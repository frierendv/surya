import { stat } from "node:fs/promises";
import path, { resolve } from "node:path";
import { debounce } from "@surya/core/debounce";
import { EventEmitter } from "./event";

export type FileWatcherOptions = {
	rootDir: string;
	extensions?: string[];
	/** Optional ignore predicate given an absolute file path and basename */
	ignore?: (absPath: string, direntName: string) => boolean;
	/** Debounce milliseconds for burst changes */
	debounceMs?: number;
	/** Try to use chokidar for watching if available */
	useChokidar?: boolean;
};

export type FileWatcherEvents = {
	add: (filePath: string) => void;
	change: (filePath: string) => void;
	unlink: (filePath: string) => void;
	error: (error: unknown) => void;
};

export class FileWatcher extends EventEmitter<FileWatcherEvents> {
	private readonly options: Required<FileWatcherOptions>;
	private readonly extSet: Set<string>;
	private stopper?: () => Promise<void> | void;

	constructor(opts: FileWatcherOptions) {
		super();
		this.options = {
			extensions: [".js"],
			debounceMs: 100,
			ignore: () => false,
			useChokidar: true,
			...opts,
			rootDir: resolve(opts.rootDir),
		} as Required<FileWatcherOptions>;
		this.extSet = new Set(this.options.extensions);
	}

	async start(): Promise<void> {
		if (this.stopper) {
			return;
		}
		if (this.options.useChokidar) {
			try {
				const chokidarMod = await import("chokidar");
				const chokidar = (chokidarMod as any).default ?? chokidarMod;
				await this.startChokidar(chokidar);
				return;
			} catch {
				// fall back
				console.warn(
					"chokidar not available, file watching may be less efficient"
				);
			}
		}
		await this.startFsWatch();
	}

	async stop(): Promise<void> {
		if (this.stopper) {
			await this.stopper();
			this.stopper = undefined;
		}
	}

	private async startChokidar(chokidar: any): Promise<void> {
		const watcher = chokidar.watch(this.options.rootDir, {
			ignoreInitial: true,
			ignored: (fp: string, s: unknown) =>
				this.shouldIgnorePath(fp, !!(s as any)?.isFile?.()),
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
				if (this.shouldIgnorePath(abs, true)) {
					return;
				}
				try {
					if (type === "unlink") {
						this.emit("unlink", abs);
						return;
					}
					this.emit(type, abs);
				} catch (e) {
					this.emit("error", e);
				}
			},
			this.options.debounceMs
		);

		watcher.on("add", (fp: string) => debounced("add", fp));
		watcher.on("change", (fp: string) => debounced("change", fp));
		watcher.on("unlink", (fp: string) => debounced("unlink", fp));
		watcher.on("error", (err: unknown) => this.emit("error", err));

		this.stopper = async () => {
			await watcher.close();
		};
	}

	private async startFsWatch(): Promise<void> {
		const { watch } = await import("node:fs");
		const recursive =
			process.platform === "win32" || process.platform === "darwin";
		const watcher = watch(this.options.rootDir, { recursive });

		const debounced = debounce(async (_evt: string, filename?: string) => {
			if (!filename) {
				return;
			}
			const full = this.toAbs(filename);
			if (this.shouldIgnorePath(full, true)) {
				return;
			}
			if (!this.extSet.has(path.extname(full))) {
				return;
			}
			try {
				const st = await stat(full).catch(() => undefined);
				if (!st || !st.isFile()) {
					this.emit("unlink", full);
					return;
				}
				this.emit("change", full);
			} catch (e) {
				this.emit("error", e);
			}
		}, this.options.debounceMs);

		watcher.on("change", (evt, fn) => debounced(evt, fn?.toString()));
		watcher.on("error", (err) => this.emit("error", err));

		this.stopper = () => watcher.close();
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
		if (isFileGuess && !this.extSet.has(path.extname(abs))) {
			return true;
		}
		return false;
	}
}
