import { opendir as _opendir, readFile as _readFile } from "fs/promises";
import os from "os";
import * as path from "path";
import { Semaphore } from "./semaphore";

/** Internals */
let fsOps = { opendir: _opendir, readFile: _readFile };
/** Internals */
export const __setFsForTest = (overrides: Partial<typeof fsOps>) => {
	fsOps = { ...fsOps, ...overrides };
};

export type BaseWalkOpts = {
	/** If true, walk directories recursively */
	recursive?: boolean;
	/** Filter files by name (simple predicate). If omitted, all files are visited. */
	filter?: (name: string) => boolean;
	/** Optional ignore predicate given an absolute file path. */
	ignore?: (absPath: string, direntName: string) => boolean;
	/** Called when opening a directory fails */
	onOpenDirError?: (error: unknown, dir: string) => void;
	/** If true, iteration errors are swallowed and forwarded to onIterError; otherwise they are thrown */
	swallowIterErrors?: boolean;
	/** Called when iterating a directory errors */
	onIterError?: (error: unknown, dir: string) => void;
};

async function* walkFilePaths(
	startDir: string,
	opts: BaseWalkOpts = {}
): AsyncGenerator<string, void, void> {
	const {
		recursive = false,
		filter,
		ignore,
		onOpenDirError,
		swallowIterErrors = false,
		onIterError,
	} = opts;
	const dirs: string[] = [path.resolve(startDir)];

	while (dirs.length) {
		const dir = dirs.pop()!;
		let handle: any;
		try {
			handle = await fsOps.opendir(dir);
		} catch (err) {
			onOpenDirError?.(err, dir);
			continue;
		}
		try {
			try {
				for await (const dirent of handle) {
					const name = dirent.name;
					const fullPath = path.join(dir, name);

					if (ignore && ignore(fullPath, name)) {
						continue;
					}
					if (dirent.isDirectory()) {
						if (recursive) {
							dirs.push(fullPath);
						}
						continue;
					}
					/* c8 ignore start */
					if (!dirent.isFile()) {
						continue;
					}
					/* c8 ignore stop */
					if (filter && !filter(name)) {
						continue;
					}
					yield fullPath;
				}
			} catch (err) {
				if (swallowIterErrors) {
					onIterError?.(err, dir);
				} else {
					throw err;
				}
			}
		} finally {
			try {
				if (typeof (handle as any)?.close === "function") {
					await (handle as any).close();
				}
			} catch {
				/** noop */
			}
		}
	}
}

type ReadResult = Buffer | string;
export interface IReadDirOptions
	extends Pick<BaseWalkOpts, "filter" | "ignore" | "recursive"> {
	/** Encoding for read files, or null for Buffer */
	encoding?: BufferEncoding | null; // null => Buffer
	/**
	 * Max number of concurrent reads.
	 * Default: half the CPU count, min 2
	 */
	concurrency?: number;
	/**
	 * If provided, called for each file as soon as it's read.
	 * Returning a value from onFile is ignored. If onFile throws/rejects,
	 * that file will be treated as failed.
	 */
	onFile?: (
		filePath: string,
		content: ReadResult
	) => unknown | Promise<unknown>;
	/** Optional error reporter for directory open/iteration errors. */
	onError?: (error: unknown, contextPath?: string) => void;
}

/**
 * Fast read all files in a directory using the opendir API.
 */
export const readDirFiles = async (
	startDir: string,
	opts: IReadDirOptions = {}
): Promise<Map<string, ReadResult>> => {
	const {
		recursive = false,
		encoding = null,
		concurrency = Math.max(2, Math.floor(os.cpus().length / 2)),
		onFile,
		onError,
	} = opts;

	const sem = new Semaphore(concurrency);
	const results = new Map<string, ReadResult>();
	const readPromises: Promise<void>[] = [];

	for await (const fullPath of walkFilePaths(startDir, {
		recursive,
		filter: opts.filter,
		ignore: opts.ignore,
		swallowIterErrors: false,
		onOpenDirError: onError,
		onIterError: onError,
	})) {
		const task = (async () => {
			await sem.acquire();
			try {
				const data = await fsOps.readFile(
					fullPath,
					encoding ?? undefined
				);
				results.set(fullPath, data as ReadResult);
				if (onFile) {
					await onFile(fullPath, data as ReadResult);
				}
			} finally {
				sem.release();
			}
		})();
		readPromises.push(task);
	}

	await Promise.allSettled(readPromises);

	return results;
};

export interface IWalkDirOptions
	extends Pick<BaseWalkOpts, "filter" | "ignore" | "recursive"> {
	/** Called for each file path discovered. */
	onPath: (absPath: string) => unknown | Promise<unknown>;
	/** Optional error reporter for directory open/iteration errors. */
	onError?: (error: unknown, contextPath?: string) => void;
}

/**
 * Fast directory walker that calls back for each file path found.
 */
export const walkDirFiles = async (
	startDir: string,
	opts: IWalkDirOptions
): Promise<void> => {
	const { recursive = false, onPath, onError } = opts;

	const pending: Promise<unknown>[] = [];

	for await (const fullPath of walkFilePaths(startDir, {
		recursive,
		filter: opts.filter,
		ignore: opts.ignore,
		swallowIterErrors: true,
		onOpenDirError: onError,
		onIterError: onError,
	})) {
		try {
			const maybe = onPath(fullPath);
			if (maybe && typeof (maybe as any).then === "function") {
				pending.push(maybe as Promise<unknown>);
			}
		} catch (err) {
			onError?.(err, fullPath);
		}
	}

	if (pending.length) {
		await Promise.allSettled(pending);
	}
};
