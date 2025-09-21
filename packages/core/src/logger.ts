import { Writable } from "node:stream";
import { hostname } from "os";
import chalk from "chalk";

type Primitive = string | number | boolean | null | undefined;
type Meta = Record<string, unknown> | unknown[] | Primitive;

export type LogLevelName =
	| "trace"
	| "debug"
	| "info"
	| "success"
	| "warn"
	| "error"
	| "fatal"
	| "silent";

const LEVELS: Record<LogLevelName, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	success: 35,
	warn: 40,
	error: 50,
	fatal: 60,
	silent: 99,
};

export interface PinoDestinationOptions extends Omit<LoggerOptions, "context"> {
	passthroughJson?: boolean;
	/**
	 * Map of custom level names to numbers, e.g. { success: 35 }.
	 * If provided, the pretty destination will map those numbers back to names when formatting.
	 */
	customLevels?: Partial<Record<LogLevelName, number>> &
		Record<string, number>;
}
export type CustomLevelMap = Record<string, number>;
export type LogMethod = (...args: unknown[]) => void;

type MergeLevels<L extends CustomLevelMap | undefined> =
	(L extends CustomLevelMap ? L : Record<never, never>) & {
		success: 35;
	};

type KeysOfMerge<L extends CustomLevelMap | undefined> = keyof MergeLevels<L> &
	string;
export type WithCustomLevels<
	TBase,
	L extends CustomLevelMap | undefined,
> = TBase & {
	[K in KeysOfMerge<L>]: LogMethod;
};

const DEFAULT_LEVEL: LogLevelName =
	(process.env.LOG_LEVEL as LogLevelName) ||
	(process.env.NODE_ENV === "production" ? "info" : "debug");

const levelToNumber = (l: LogLevelName) => LEVELS[l] ?? LEVELS.info;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const isoTs = (d = new Date()) => {
	/**
	 * Compact ISO timestamp
	 */
	const Y = d.getFullYear();
	const M = pad(d.getMonth() + 1);
	const D = pad(d.getDate());
	const h = pad(d.getHours());
	const m = pad(d.getMinutes());
	const s = pad(d.getSeconds());
	const ms = `00${d.getMilliseconds()}`.slice(-3);
	return `${Y}-${M}-${D}T${h}:${m}:${s}.${ms}Z`;
};

const isError = (obj: unknown): obj is Error => {
	return (
		obj instanceof Error ||
		(typeof obj === "object" &&
			obj !== null &&
			typeof (obj as any).stack === "string")
	);
};

const serializeError = (err: unknown) => {
	if (!isError(err)) {
		return err;
	}
	const e = err as Error & Record<string, unknown>;
	return {
		name: e.name,
		message: e.message,
		stack: e.stack,
		...Object.keys(e).reduce<Record<string, unknown>>((acc, k) => {
			if (k !== "name" && k !== "message" && k !== "stack") {
				acc[k] = (e as any)[k];
			}
			return acc;
		}, {}),
	};
};

const safeStringify = (obj: unknown) => {
	const seen = new WeakSet();
	return JSON.stringify(obj, (_, value) => {
		if (typeof value === "object" && value !== null) {
			if (seen.has(value as object)) {
				return "[Circular]";
			}
			seen.add(value as object);
		}
		if (isError(value)) {
			return serializeError(value);
		}
		return value;
	});
};

const prettyFormat = (obj: unknown) => {
	try {
		if (typeof obj === "string") {
			return obj;
		}
		return typeof obj === "object" ? safeStringify(obj) : String(obj);
	} catch {
		return "[Unserializable]";
	}
};

export interface LoggerOptions {
	name?: string;
	level?: LogLevelName;
	context?: Record<string, Meta>;
	/**
	 * Force JSON output even in development
	 */
	prodJson?: boolean;
	/**
	 * Disable timestamp in output (useful when the environment adds its own)
	 */
	disableTimestamp?: boolean;
}

export interface Logger {
	name?: string;
	level: LogLevelName;
	child(opts?: Partial<LoggerOptions>): Logger;
	enabled(level: LogLevelName): boolean;
	time(label: string): () => void;

	trace(msg: string, meta?: Meta): void;
	debug(msg: string, meta?: Meta): void;
	info(msg: string, meta?: Meta): void;
	success(msg: string, meta?: Meta): void;
	warn(msg: string, meta?: Meta): void;
	error(msg: string, meta?: Meta, err?: unknown): void;
	fatal(msg: string, meta?: Meta, err?: unknown): void;
	show(...args: unknown[]): void;
}

const getPid = () =>
	typeof process !== "undefined" && typeof process.pid === "number"
		? process.pid
		: undefined;

const getHostname = () => {
	try {
		return hostname();
	} catch {
		return undefined;
	}
};

const makeLogger = (opts: LoggerOptions = {}): Logger => {
	const baseContext = opts.context ? { ...opts.context } : {};
	const currentLevel: LogLevelName = opts.level ?? DEFAULT_LEVEL;
	const name = opts.name;

	const prod =
		process.env.NODE_ENV === "production" || opts.prodJson === true;

	const shouldLog = (level: LogLevelName) =>
		levelToNumber(level) >= levelToNumber(currentLevel) &&
		currentLevel !== "silent";

	/**
	 * Pretty formatting setup (inspired by log-beautify)
	 */
	const SYMBOLS: Record<Exclude<LogLevelName, "silent">, string> = {
		trace: "🔍",
		debug: "🐛",
		info: "ℹ️",
		success: "✅",
		warn: "⚠️",
		error: "❌",
		fatal: "☠️",
	} as const;

	const COLORS: Record<Exclude<LogLevelName, "silent">, string> = {
		trace: "#9E9E9E",
		debug: "#00BCD4",
		info: "#4CAF50",
		success: "#8BC34A",
		warn: "#FFC107",
		error: "#F44336",
		fatal: "#B71C1C",
	} as const;

	const BG_TEXT: Partial<
		Record<Exclude<LogLevelName, "silent">, "black" | "white">
	> = {
		trace: "black",
		debug: "black",
		info: "black",
		warn: "black",
		error: "white",
		fatal: "white",
	};

	const labelFor = (level: LogLevelName) => level.toUpperCase();

	const prettyPrefix = (level: LogLevelName) => {
		const color =
			COLORS[level as Exclude<LogLevelName, "silent">] ?? "#999999";
		const textColor =
			BG_TEXT[level as Exclude<LogLevelName, "silent">] ?? "black";
		const symbol = SYMBOLS[level as Exclude<LogLevelName, "silent">] ?? "!";
		const label = labelFor(level);
		const padded = ` ${label} `;
		// background block
		const bgBlock =
			`${symbol} ` +
			(textColor === "white"
				? chalk.bgHex(color).white(padded)
				: chalk.bgHex(color).black(padded));
		return { bgBlock, colorize: chalk.hex(color) };
	};

	const prettyLine = (
		level: LogLevelName,
		msg: string,
		meta?: Meta,
		err?: unknown,
		ts?: string,
		loggerName?: string
	) => {
		const { bgBlock, colorize } = prettyPrefix(level);
		const parts: string[] = [];
		if (bgBlock) {
			parts.push(bgBlock);
		}
		const namePart = loggerName ? chalk.dim(` [${loggerName}]`) : "";
		const timePart = ts ? chalk.dim(ts) : "";
		parts.push(` ${timePart}${namePart} ${colorize(msg)}`);
		if (meta !== undefined) {
			parts.push(" " + prettyFormat(meta));
		}
		if (err !== undefined) {
			parts.push("\n" + prettyFormat(serializeError(err)));
		}
		return parts.join("");
	};

	const coreLog = (
		level: LogLevelName,
		msg: string,
		meta?: Meta,
		err?: unknown
	) => {
		if (!shouldLog(level)) {
			return;
		}

		const ts = opts.disableTimestamp ? "" : isoTs();
		const entry: Record<string, unknown> = {
			time: ts,
			level,
			msg,
			pid: getPid(),
			hostname: getHostname(),
			name,
			...baseContext,
		};

		if (meta !== undefined) {
			entry.meta = meta;
		}
		if (err !== undefined) {
			entry.err = serializeError(err);
		}

		if (prod) {
			// JSON one-line for structured logging in production
			try {
				console.log(safeStringify(entry));
			} catch {
				console.log(
					'{"time":"unknown","level":"error","msg":"failed to stringify log"}'
				);
			}
			return;
		}

		// human friendly output for dev: colorful block prefix + message
		const line = prettyLine(level, msg, meta, err, ts, name);

		switch (level) {
			case "trace":
			case "debug":
				console.debug(line);
				break;
			case "info":
				console.log(line);
				break;
			case "success":
				console.log(line);
				break;
			case "warn":
				console.warn(line);
				break;
			case "error":
			case "fatal":
				console.error(line);
				break;
			default:
				console.log(line);
		}
	};

	const child = (childOpts: Partial<LoggerOptions> = {}): Logger => {
		const combined: LoggerOptions = {
			name: childOpts.name ?? name,
			level: childOpts.level ?? currentLevel,
			context: { ...baseContext, ...(childOpts.context ?? {}) },
			prodJson: childOpts.prodJson ?? prod,
		};
		return makeLogger(combined);
	};

	const time = (label: string) => {
		const start = Date.now();
		let ended = false;
		return function end(meta?: Meta) {
			if (ended) {
				return;
			}
			ended = true;
			const elapsed = Date.now() - start;
			coreLog("debug", `${label} - ${elapsed}ms`, meta);
		};
	};

	const logger: Logger = {
		name,
		get level() {
			return currentLevel;
		},
		child,
		enabled: shouldLog,
		time,
		trace: (m, meta) => coreLog("trace", m, meta),
		debug: (m, meta) => coreLog("debug", m, meta),
		info: (m, meta) => coreLog("info", m, meta),
		success: (m, meta) => coreLog("success", m, meta),
		warn: (m, meta) => coreLog("warn", m, meta),
		error: (m, meta, err) => coreLog("error", m, meta, err),
		fatal: (m, meta, err) => coreLog("fatal", m, meta, err),
		show: console.log,
	};

	return logger;
};

export const createLogger = (opts?: LoggerOptions) => makeLogger(opts);

type PinoLikeLine = {
	level?: number | string;
	time?: string | number;
	msg?: string;
	name?: string;
	err?: unknown;
	stack?: unknown;
	[k: string]: unknown;
};

const pinoNumToName = (
	n: number,
	customNumToName?: Record<number, LogLevelName>
): LogLevelName => {
	if (customNumToName && customNumToName[n]) {
		return customNumToName[n];
	}
	if (n >= 60) {
		return "fatal";
	}
	if (n >= 50) {
		return "error";
	}
	if (n >= 40) {
		return "warn";
	}
	if (n >= 30) {
		return "info";
	}
	if (n >= 20) {
		return "debug";
	}
	if (n >= 10) {
		return "trace";
	}
	return "info";
};

/**
 * Create a Node.js Writable stream that pretty-prints Pino JSON lines using this module's formatter.
 *
 * Important: this returns a stream, not a Logger. Use it as the destination argument for Pino:
 *   const p = pino({}, createPinoDestination());
 */
export type PinoDestination = Writable;

export const createPinoDestination = (
	opts: PinoDestinationOptions = {}
): PinoDestination => {
	const local = createLogger({ ...opts });
	// Invert customLevels to a number->name map limited to our LogLevelName keys where possible
	const customNumToName: Record<number, LogLevelName> | undefined = (() => {
		const src = opts.customLevels;
		if (!src) {
			return undefined;
		}
		const out: Record<number, LogLevelName> = {} as any;
		for (const [name, num] of Object.entries(src)) {
			if (typeof num === "number") {
				const key = name as LogLevelName;
				if (
					key === "trace" ||
					key === "debug" ||
					key === "info" ||
					key === "success" ||
					key === "warn" ||
					key === "error" ||
					key === "fatal"
				) {
					out[num] = key;
				}
			}
		}
		return Object.keys(out).length ? out : undefined;
	})();
	let buffer = "";
	const stream = new Writable({
		write(chunk, _enc, cb) {
			try {
				buffer += chunk.toString();
				let idx: number;
				while ((idx = buffer.indexOf("\n")) !== -1) {
					const line = buffer.slice(0, idx);
					buffer = buffer.slice(idx + 1);
					if (!line.trim()) {
						continue;
					}
					try {
						const obj: PinoLikeLine = JSON.parse(line);
						const n =
							typeof obj.level === "string"
								? Number(obj.level)
								: (obj.level ?? 30);
						const level =
							typeof n === "number" && !isNaN(n)
								? pinoNumToName(n, customNumToName)
								: ((obj.level as LogLevelName) ?? "info");
						const msg = obj.msg ?? "";
						const err = obj.err ?? obj.stack;
						// Meta: include everything except known fields to keep context rich in dev
						const {
							level: _l,
							time: _t,
							msg: _m,
							name: _n,
							err: _e,
							stack: _s,
							...rest
						} = obj as any;
						// Route to the correct local logger method
						const meta = (
							Object.keys(rest).length ? rest : undefined
						) as Meta | undefined;
						switch (level) {
							case "trace":
								local.trace(msg as string, meta);
								break;
							case "debug":
								local.debug(msg as string, meta);
								break;
							case "info":
								local.info(msg as string, meta);
								break;
							case "success":
								local.success(msg as string, meta);
								break;
							case "warn":
								local.warn(msg as string, meta);
								break;
							case "error":
								local.error(msg as string, meta, err);
								break;
							case "fatal":
								local.fatal(msg as string, meta, err);
								break;
							default:
								local.info(msg as string, meta);
						}
					} catch {
						// Not JSON – just echo as info
						local.info(line);
					}
				}
				cb();
			} catch (e) {
				try {
					local.error("pino stream error", undefined, e);
				} finally {
					cb();
				}
			}
		},
		final(cb) {
			if (buffer.trim()) {
				try {
					const obj: PinoLikeLine = JSON.parse(buffer);
					const n =
						typeof obj.level === "string"
							? Number(obj.level)
							: (obj.level ?? 30);
					const level =
						typeof n === "number" && !isNaN(n)
							? pinoNumToName(n, customNumToName)
							: ((obj.level as LogLevelName) ?? "info");
					const msg = obj.msg ?? "";
					const err = obj.err ?? obj.stack;
					const {
						level: _l,
						time: _t,
						msg: _m,
						name: _n,
						err: _e,
						stack: _s,
						...rest
					} = obj as any;
					const meta = (
						Object.keys(rest).length ? rest : undefined
					) as Meta | undefined;
					switch (level) {
						case "trace":
							local.trace(msg as string, meta);
							break;
						case "debug":
							local.debug(msg as string, meta);
							break;
						case "info":
							local.info(msg as string, meta);
							break;
						case "success":
							local.success(msg as string, meta);
							break;
						case "warn":
							local.warn(msg as string, meta);
							break;
						case "error":
							local.error(msg as string, meta, err);
							break;
						case "fatal":
							local.fatal(msg as string, meta, err);
							break;
						default:
							local.info(msg as string, meta);
					}
				} catch {
					local.info(buffer);
				}
			}
			cb();
		},
	});
	return stream;
};

type CreatePinoLogger = <
	T extends (...args: any[]) => any,
	L extends CustomLevelMap | undefined = undefined,
>(
	pinoFactory: T,
	opts?: Omit<PinoDestinationOptions, "customLevels"> & {
		pinoOptions?: any;
		customLevels?: L;
	}
) => WithCustomLevels<ReturnType<T>, L>;
export const createPinoLogger: CreatePinoLogger = (pinoFactory, opts = {}) => {
	const { pinoOptions, customLevels, ...rest } = opts as any;
	// Merge custom levels so Pino exposes methods like `success`
	const mergedCustomLevels = {
		success: 35,
		...(pinoOptions?.customLevels ?? {}),
		...(customLevels ?? {}),
	} as Record<string, number>;
	const dest = createPinoDestination({
		...rest,
		customLevels: mergedCustomLevels,
	});
	const pinoOpts = {
		...(pinoOptions ?? {}),
		customLevels: mergedCustomLevels,
	};
	return pinoFactory(pinoOpts, dest);
};

// default shared logger
const defaultLogger = createLogger({ name: "app" });

export default defaultLogger;
