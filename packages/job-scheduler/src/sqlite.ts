import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";

export type JobKind = "time" | "cron" | "interval";
export type JobStatus =
	| "scheduled"
	| "running"
	| "paused"
	| "completed"
	| "failed"
	| "cancelled";

export interface JobRecord<Payload = unknown> {
	id: string;
	kind: JobKind;
	name?: string | null;
	/** used to look up the registered handler */
	handlerKey: string;
	payload?: Payload;
	/** time jobs (ms epoch) */
	runAt?: number | null; // for time jobs (ms epoch)
	/** for cron jobs */
	cronExpr?: string | null;
	/** for interval jobs */
	intervalMs?: number | null;

	// controls
	/** if `false`, ignore on load */
	active: boolean;
	/** if `true`, do not run until resumed */
	paused: boolean;
	status: JobStatus;

	// execution stats
	attempts: number;
	maxRetries: number;
	/** base backoff for retries */
	backoffMs: number; // base backoff for retries
	lastError?: string | null;
	/** times executed successfully */
	runCount: number;
	/** for interval jobs; null => infinite */
	maxRuns?: number | null;
	lastRunAt?: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface CreateBase {
	id?: string;
	name?: string | null;
	handlerKey: string;
	payload?: unknown;
	maxRetries?: number;
	backoffMs?: number;
}

export interface CreateTimeJob extends CreateBase {
	runAt: number | Date;
}

export interface CreateCronJob extends CreateBase {
	cronExpr: string;
}

export interface CreateIntervalJob extends CreateBase {
	intervalMs: number;
	maxRuns?: number | null;
}

const nowMs = () => Date.now();

const toMs = (v?: number | Date | null) =>
	v == null ? null : typeof v === "number" ? v : v.getTime();

const parseJson = (v: unknown) => {
	if (v == null) {
		return undefined;
	}
	try {
		return JSON.parse(String(v));
	} catch {
		return undefined;
	}
};

export class JobStore {
	private db: DB;

	constructor(dbPath = resolve(process.cwd(), "data/jobs.sqlite")) {
		const file = resolve(dbPath);
		mkdirSync(dirname(file), { recursive: true });
		this.db = new Database(file);
		this.bootstrap();
	}

	private bootstrap() {
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("foreign_keys = ON");
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS jobs (
				id TEXT PRIMARY KEY,
				kind TEXT NOT NULL CHECK(kind IN ('time','cron','interval')),
				name TEXT,
				handler_key TEXT NOT NULL,
				payload TEXT,
				run_at INTEGER,
				cron_expr TEXT,
				interval_ms INTEGER,
				active INTEGER NOT NULL DEFAULT 1,
				paused INTEGER NOT NULL DEFAULT 0,
				status TEXT NOT NULL DEFAULT 'scheduled',
				attempts INTEGER NOT NULL DEFAULT 0,
				max_retries INTEGER NOT NULL DEFAULT 0,
				backoff_ms INTEGER NOT NULL DEFAULT 0,
				last_error TEXT,
				run_count INTEGER NOT NULL DEFAULT 0,
				max_runs INTEGER,
				last_run_at INTEGER,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(active);
			CREATE INDEX IF NOT EXISTS idx_jobs_kind ON jobs(kind);
			CREATE INDEX IF NOT EXISTS idx_jobs_paused ON jobs(paused);
		`);
	}

	close() {
		this.db.close();
	}

	private mapRow(row: any): JobRecord | undefined {
		if (!row) {
			return undefined;
		}
		const rec: JobRecord = {
			id: row.id,
			kind: row.kind,
			name: row.name ?? null,
			handlerKey: row.handler_key,
			payload: parseJson(row.payload),
			runAt: row.run_at ?? null,
			cronExpr: row.cron_expr ?? null,
			intervalMs: row.interval_ms ?? null,
			active: !!row.active,
			paused: !!row.paused,
			status: row.status,
			attempts: row.attempts,
			maxRetries: row.max_retries,
			backoffMs: row.backoff_ms,
			lastError: row.last_error ?? null,
			runCount: row.run_count,
			maxRuns: row.max_runs ?? null,
			lastRunAt: row.last_run_at ?? null,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
		return rec;
	}

	getJob(id: string): JobRecord | undefined {
		const stmt = this.db.prepare("SELECT * FROM jobs WHERE id = ?");
		return this.mapRow(stmt.get(id));
	}

	getActiveJobs(kinds?: JobKind[]): JobRecord[] {
		if (kinds && kinds.length) {
			const placeholders = kinds.map(() => "?").join(",");
			const stmt = this.db.prepare(
				`SELECT * FROM jobs WHERE active = 1 AND kind IN (${placeholders})`
			);
			return stmt
				.all(...kinds)
				.map((r) => this.mapRow(r)!) as JobRecord[];
		}
		const stmt = this.db.prepare("SELECT * FROM jobs WHERE active = 1");
		return stmt.all().map((r) => this.mapRow(r)!) as JobRecord[];
	}

	createTimeJob(data: CreateTimeJob): JobRecord {
		const id = data.id ?? randomUUID();
		const ts = nowMs();
		const runAt = toMs(data.runAt)!;
		const payload =
			data.payload == null ? null : JSON.stringify(data.payload);
		const stmt = this.db.prepare(`
			INSERT INTO jobs (
				id, kind, name, handler_key, payload, run_at, cron_expr, interval_ms,
				active, paused, status, attempts, max_retries, backoff_ms, last_error,
				run_count, max_runs, last_run_at, created_at, updated_at
			) VALUES (
				@id, 'time', @name, @handler_key, @payload, @run_at, NULL, NULL,
				1, 0, 'scheduled', 0, @max_retries, @backoff_ms, NULL,
				0, NULL, NULL, @created_at, @updated_at
			)
		`);
		stmt.run({
			id,
			name: data.name ?? null,
			handler_key: data.handlerKey,
			payload,
			run_at: runAt,
			max_retries: data.maxRetries ?? 0,
			backoff_ms: data.backoffMs ?? 0,
			created_at: ts,
			updated_at: ts,
		});
		return this.getJob(id)!;
	}

	createCronJob(data: CreateCronJob): JobRecord {
		const id = data.id ?? randomUUID();
		const ts = nowMs();
		const payload =
			data.payload == null ? null : JSON.stringify(data.payload);
		const stmt = this.db.prepare(`
			INSERT INTO jobs (
				id, kind, name, handler_key, payload, run_at, cron_expr, interval_ms,
				active, paused, status, attempts, max_retries, backoff_ms, last_error,
				run_count, max_runs, last_run_at, created_at, updated_at
			) VALUES (
				@id, 'cron', @name, @handler_key, @payload, NULL, @cron_expr, NULL,
				1, 0, 'scheduled', 0, @max_retries, @backoff_ms, NULL,
				0, NULL, NULL, @created_at, @updated_at
			)
		`);
		stmt.run({
			id,
			name: data.name ?? null,
			handler_key: data.handlerKey,
			payload,
			cron_expr: data.cronExpr,
			max_retries: data.maxRetries ?? 0,
			backoff_ms: data.backoffMs ?? 0,
			created_at: ts,
			updated_at: ts,
		});
		return this.getJob(id)!;
	}

	createIntervalJob(data: CreateIntervalJob): JobRecord {
		const id = data.id ?? randomUUID();
		const ts = nowMs();
		const payload =
			data.payload == null ? null : JSON.stringify(data.payload);
		const stmt = this.db.prepare(`
			INSERT INTO jobs (
				id, kind, name, handler_key, payload, run_at, cron_expr, interval_ms,
				active, paused, status, attempts, max_retries, backoff_ms, last_error,
				run_count, max_runs, last_run_at, created_at, updated_at
			) VALUES (
				@id, 'interval', @name, @handler_key, @payload, NULL, NULL, @interval_ms,
				1, 0, 'scheduled', 0, @max_retries, @backoff_ms, NULL,
				0, @max_runs, NULL, @created_at, @updated_at
			)
		`);
		stmt.run({
			id,
			name: data.name ?? null,
			handler_key: data.handlerKey,
			payload,
			interval_ms: data.intervalMs,
			max_retries: data.maxRetries ?? 0,
			backoff_ms: data.backoffMs ?? 0,
			max_runs: data.maxRuns ?? null,
			created_at: ts,
			updated_at: ts,
		});
		return this.getJob(id)!;
	}

	setPaused(id: string, paused: boolean) {
		const ts = nowMs();
		this.db
			.prepare("UPDATE jobs SET paused = ?, updated_at = ? WHERE id = ?")
			.run(paused ? 1 : 0, ts, id);
	}

	setActive(id: string, active: boolean, status?: JobStatus) {
		const ts = nowMs();
		if (status) {
			this.db
				.prepare(
					"UPDATE jobs SET active = ?, status = ?, updated_at = ? WHERE id = ?"
				)
				.run(active ? 1 : 0, status, ts, id);
		} else {
			this.db
				.prepare(
					"UPDATE jobs SET active = ?, updated_at = ? WHERE id = ?"
				)
				.run(active ? 1 : 0, ts, id);
		}
	}

	updateRunAt(id: string, when: number) {
		const ts = nowMs();
		this.db
			.prepare("UPDATE jobs SET run_at = ?, updated_at = ? WHERE id = ?")
			.run(when, ts, id);
	}

	markRunning(id: string) {
		const ts = nowMs();
		this.db
			.prepare(
				"UPDATE jobs SET status = 'running', attempts = attempts + 1, updated_at = ? WHERE id = ?"
			)
			.run(ts, id);
	}

	bumpAttempts(id: string) {
		const ts = nowMs();
		this.db
			.prepare(
				"UPDATE jobs SET attempts = attempts + 1, updated_at = ? WHERE id = ?"
			)
			.run(ts, id);
	}

	markSuccess(id: string) {
		const ts = nowMs();
		this.db
			.prepare(
				"UPDATE jobs SET status = 'scheduled', last_error = NULL, run_count = run_count + 1, last_run_at = ?, updated_at = ? WHERE id = ?"
			)
			.run(ts, ts, id);
	}

	completeAndDeactivate(id: string) {
		const ts = nowMs();
		this.db
			.prepare(
				"UPDATE jobs SET status = 'completed', active = 0, last_error = NULL, run_count = run_count + 1, last_run_at = ?, updated_at = ? WHERE id = ?"
			)
			.run(ts, ts, id);
	}

	markFailure(id: string, errorMsg: string) {
		const ts = nowMs();
		this.db
			.prepare(
				"UPDATE jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?"
			)
			.run(errorMsg, ts, id);
	}

	setStatus(id: string, status: JobStatus) {
		const ts = nowMs();
		this.db
			.prepare("UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?")
			.run(status, ts, id);
	}

	removeJob(id: string) {
		this.db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
	}
}
