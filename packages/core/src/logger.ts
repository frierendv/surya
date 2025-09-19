import { hostname } from "os";

type Primitive = string | number | boolean | null | undefined;
type Meta = Record<string, unknown> | unknown[] | Primitive;

export type LogLevelName =
	| "trace"
	| "debug"
	| "info"
	| "warn"
	| "error"
	| "fatal"
	| "silent";

const LEVELS: Record<LogLevelName, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60,
	silent: 99,
};

const DEFAULT_LEVEL: LogLevelName =
	(process.env.LOG_LEVEL as LogLevelName) ||
	(process.env.NODE_ENV === "production" ? "info" : "debug");

const levelToNumber = (l: LogLevelName) => LEVELS[l] ?? LEVELS.info;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const isoTs = (d = new Date()) => {
	// compact but human-readable ISO-ish timestamp
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
	prodJson?: boolean; // force JSON output even in dev
}

export interface Logger {
	name?: string;
	level: LogLevelName;
	setLevel(level: LogLevelName): void;
	child(opts?: Partial<LoggerOptions>): Logger;
	enabled(level: LogLevelName): boolean;
	time(label: string): () => void;

	trace(msg: string, meta?: Meta): void;
	debug(msg: string, meta?: Meta): void;
	info(msg: string, meta?: Meta): void;
	warn(msg: string, meta?: Meta): void;
	error(msg: string, meta?: Meta, err?: unknown): void;
	fatal(msg: string, meta?: Meta, err?: unknown): void;
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
	let currentLevel: LogLevelName = opts.level ?? DEFAULT_LEVEL;
	const name = opts.name;

	const prod =
		process.env.NODE_ENV === "production" || opts.prodJson === true;

	const shouldLog = (level: LogLevelName) =>
		levelToNumber(level) >= levelToNumber(currentLevel) &&
		currentLevel !== "silent";

	const coreLog = (
		level: LogLevelName,
		msg: string,
		meta?: Meta,
		err?: unknown
	) => {
		if (!shouldLog(level)) {
			return;
		}

		const ts = isoTs();
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

		// human friendly output for dev: colorize level minimally
		const levelPad = level.toUpperCase().padEnd(5);
		const timePart = ts;
		const namePart = name ? `[${name}] ` : "";
		const metaPart = meta !== undefined ? ` ${prettyFormat(meta)}` : "";
		const errPart =
			err !== undefined ? `\n${prettyFormat(serializeError(err))}` : "";
		const line = `${timePart} ${levelPad} ${namePart}${msg}${metaPart}${errPart}`;

		switch (level) {
			case "trace":
			case "debug":
				console.debug(line);
				break;
			case "info":
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

	const setLevel = (l: LogLevelName) => {
		currentLevel = l;
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
		setLevel,
		child,
		enabled: shouldLog,
		time,
		trace: (m, meta) => coreLog("trace", m, meta),
		debug: (m, meta) => coreLog("debug", m, meta),
		info: (m, meta) => coreLog("info", m, meta),
		warn: (m, meta) => coreLog("warn", m, meta),
		error: (m, meta, err) => coreLog("error", m, meta, err),
		fatal: (m, meta, err) => coreLog("fatal", m, meta, err),
	};

	return logger;
};

export const createLogger = (opts?: LoggerOptions) => makeLogger(opts);

// default shared logger
const defaultLogger = createLogger({ name: "app" });

export default defaultLogger;
