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

const levelToNumber = (l: LogLevelName) => LEVELS[l] ?? LEVELS.info;
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const isoTs = (d = new Date()) => {
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
		/* v8 ignore next 8 */
		if (typeof obj === "string") {
			return obj;
		}
		return typeof obj === "object" ? safeStringify(obj) : String(obj);
	} catch {
		return "[Unserializable]";
	}
};

const resolveEnvLevel = (): LogLevelName => {
	const raw = (process.env.LOG_LEVEL ?? "").toLowerCase();
	const validLevels = Object.keys(LEVELS).map((level) => level.toLowerCase());
	return validLevels.includes(raw) ? (raw as LogLevelName) : "info";
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

const makeLogger = (opts: LoggerOptions = {}): Logger => {
	const { name, prodJson, context } = opts;

	const prod = process.env.NODE_ENV === "production" || prodJson === true;
	const effectiveLevel = opts.level ?? resolveEnvLevel();

	// Ensure 'silent' never logs and never reports enabled
	const shouldLog = (level: LogLevelName) => {
		if (level === "silent" || effectiveLevel === "silent") {
			return false;
		}
		return levelToNumber(level) >= levelToNumber(effectiveLevel);
	};

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
		/* v8 ignore next 5 */
		const color =
			COLORS[level as Exclude<LogLevelName, "silent">] ?? "#999999";
		const textColor =
			BG_TEXT[level as Exclude<LogLevelName, "silent">] ?? "black";
		const symbol = SYMBOLS[level as Exclude<LogLevelName, "silent">] ?? "!";
		const label = labelFor(level);
		const padded = ` ${label} `;
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
		/* v8 ignore next 2 */
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

		const ts = opts.disableTimestamp ? undefined : isoTs();
		const entry: Record<string, unknown> = {
			level,
			msg,
			pid: process?.pid,
			hostname: hostname(),
			name,
			...context,
		};
		if (ts) {
			entry.time = ts;
		}
		if (meta !== undefined) {
			entry.meta = meta;
		}
		if (err !== undefined) {
			entry.err = serializeError(err);
		}
		/* v8 ignore start */
		if (prod) {
			try {
				console.log(safeStringify(entry));
			} catch {
				console.log(
					'{"level":"error","msg":"failed to stringify log"}'
				);
			}
			return;
		}
		/* v8 ignore stop */

		const line = prettyLine(level, msg, meta, err, ts, name);

		switch (level) {
			case "trace":
			case "debug":
				console.debug(line);
				break;
			case "info":
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
			/* v8 ignore next 2 */
			default:
				console.log(line);
		}
	};

	const child = (childOpts: Partial<LoggerOptions> = {}): Logger => {
		const combined: LoggerOptions = {
			/* v8 ignore next */
			name: childOpts.name ?? name,
			level: childOpts.level ?? effectiveLevel,
			context: { ...context, ...(childOpts.context ?? {}) },
			prodJson: childOpts.prodJson ?? prod,
			disableTimestamp:
				childOpts.disableTimestamp ?? opts.disableTimestamp,
		};
		return makeLogger(combined);
	};

	const time = (label: string) => {
		const start = Date.now();
		let ended = false;
		return function end(meta?: Meta) {
			/* v8 ignore next 3 */
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
			return effectiveLevel;
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
	/* v8 ignore start */
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
/* v8 ignore stop */

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
		/* v8 ignore next */
		return Object.keys(out).length ? out : undefined;
	})();
	/* v8 ignore start */
	const route = (obj: PinoLikeLine) => {
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
		const meta = (Object.keys(rest).length ? rest : undefined) as
			| Meta
			| undefined;

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
	};

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
						route(obj);
					} catch {
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
					route(obj);
				} catch {
					local.info(buffer);
				}
			}
			cb();
		},
	});
	/* v8 ignore stop */
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
		...customLevels,
	} as Record<string, number>;
	const dest = createPinoDestination({
		...rest,
		customLevels: mergedCustomLevels,
	});
	const pinoOpts = {
		...pinoOptions,
		customLevels: mergedCustomLevels,
	};
	return pinoFactory(pinoOpts, dest);
};

// default shared logger
const defaultLogger = createLogger({ name: "app" });

export default defaultLogger;
