import { EventEmitter } from "events";
import { Boom } from "@hapi/boom";
import {
	DisconnectReason,
	fetchLatestBaileysVersion,
	makeCacheableSignalKeyStore,
	default as makeWASocket,
} from "baileys";
import type {
	AuthenticationState,
	BaileysEventMap,
	WASocket as BaileysWASocket,
	UserFacingSocketConfig,
	WABrowserDescription,
} from "baileys";
import type { WASocket as InternalWASocket } from "./internals/types";

export type WASocket = InternalWASocket | (InternalWASocket & BaileysWASocket);

export type AuthProps = {
	state: AuthenticationState;
	saveCreds: () => Promise<void>;
};
export type BaileysAuthProvider = AuthProps | Promise<AuthProps>;

export type CreateBaileysOptions = {
	/** provide an auth state object to maintain the auth state */
	authProvider: BaileysAuthProvider;
	/** override the default socket config */
	socketConfig?: Partial<Omit<UserFacingSocketConfig, "auth">>;
	/** max number of reconnect attempts, 0 = unlimited */
	maxReconnectAttempts?: number;
	/** initial reconnect delay in ms */
	initialReconnectDelayMs?: number;
	/** optional browser description override */
	browser?: WABrowserDescription;
};

export type BaileysSocketHandle = {
	socket: WASocket;
	stop: () => Promise<void>;
};

export type BEvent =
	| "stopped"
	| "logged_out"
	| "reconnecting"
	| "reconnect_exhausted";

const DEFAULT_BROWSER = ["SuryaRB", "Desktop", "1.0.0"] as WABrowserDescription;
const DEFAULT_RECONNECT_DELAY = 2000;
export type Middleware<
	E extends keyof BaileysEventMap = keyof BaileysEventMap,
> = (
	payload: BaileysEventMap[E],
	next: () => Promise<void>,
	meta: { event: E; socket: WASocket }
) => any | Promise<any>;

/**
 * A Baileys socket manager with auto-reconnection and middleware support
 */

export class BaileysSocket extends EventEmitter {
	private options: Required<
		Pick<
			CreateBaileysOptions,
			"initialReconnectDelayMs" | "maxReconnectAttempts"
		>
	> &
		Omit<
			CreateBaileysOptions,
			"initialReconnectDelayMs" | "maxReconnectAttempts"
		>;
	private auth!: AuthProps;
	private _socket: WASocket | null = null;
	private stopped = true;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private middlewareMap = new Map<string, Middleware[]>();

	constructor(options: CreateBaileysOptions) {
		super();
		const {
			authProvider,
			socketConfig = {},
			maxReconnectAttempts = 0,
			initialReconnectDelayMs = DEFAULT_RECONNECT_DELAY,
			browser = DEFAULT_BROWSER,
		} = options;
		this.options = {
			authProvider,
			socketConfig,
			maxReconnectAttempts,
			initialReconnectDelayMs,
			browser,
		};
	}

	/**
	 * Get the current Baileys socket instance, or null if not running
	 */
	get socket(): WASocket | null {
		return this._socket;
	}

	get isRunning(): boolean {
		return !this.stopped;
	}

	use<E extends keyof BaileysEventMap>(
		event: E | "*",
		mw: Middleware<E>
	): this {
		const key = String(event);
		const arr = this.middlewareMap.get(key) || [];
		arr.push(mw as Middleware);
		this.middlewareMap.set(key, arr);
		return this;
	}

	async launch(): Promise<WASocket> {
		if (!this.options.authProvider) {
			throw new Error("authProvider is required");
		}

		// resolve auth provider once
		if (!this.auth) {
			const resolved = await this.options.authProvider;
			if (
				!resolved ||
				typeof resolved.saveCreds !== "function" ||
				!resolved.state
			) {
				throw new Error(
					"authProvider must be an object with state and saveCreds()"
				);
			}
			this.auth = resolved;
		}

		// ensure version is set (safe fallback)
		if (!this.options.socketConfig?.version) {
			try {
				const { version } = await fetchLatestBaileysVersion();
				this.options.socketConfig = {
					...this.options.socketConfig,
					version,
				};
			} catch (err) {
				console.warn(
					"Failed to fetch latest Baileys version, continuing with defaults",
					err
				);
			}
		}

		this.stopped = false;
		this.reconnectAttempts = 0;
		this.clearTimer();
		this._socket = this.createSocketInstance();
		return this._socket;
	}

	async stop(): Promise<void> {
		this.stopped = true;
		this.clearTimer();
		const sock = this._socket;
		if (!sock) {
			return;
		}
		try {
			sock.ev.removeAllListeners?.("creds.update");
			sock.ev.removeAllListeners?.("connection.update");
		} catch {
			// noop
		}
		try {
			if (typeof sock.ws?.close === "function") {
				await sock.ws?.close();
			}
		} catch (err) {
			console.warn("Error while closing Baileys socket:", err);
		}
		this._socket = null;
		this.emit("stopped");
	}

	async restart(): Promise<WASocket> {
		await this.stop();
		return this.launch();
	}

	// INTERNALS
	private clearTimer() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private createSocketInstance() {
		const sock = makeWASocket({
			browser: this.options.browser ?? DEFAULT_BROWSER,
			shouldSyncHistoryMessage: () => false,
			syncFullHistory: false,
			generateHighQualityLinkPreview: true,
			logger: this.options.socketConfig?.logger,
			...this.options.socketConfig,
			auth: {
				creds: this.auth.state.creds,
				keys: makeCacheableSignalKeyStore(this.auth.state.keys),
			},
		}) as WASocket;

		// batch processing improves throughput
		sock.ev.process(async (events) => {
			// run creds update
			if (events["creds.update"]) {
				await this.auth.saveCreds();
				await this.handle("creds.update", events["creds.update"], sock);
			}

			if (events["connection.update"]) {
				const update = events["connection.update"];
				await this.handle("connection.update", update, sock);

				const { connection, lastDisconnect } = update;
				if (connection === "close" && !this.stopped) {
					const isLoggedOut =
						(lastDisconnect?.error as Boom)?.output?.statusCode ===
						DisconnectReason.loggedOut;
					if (isLoggedOut) {
						this.emit("logged_out");
						return; // do not reconnect
					}
					this.reconnectAttempts += 1;
					const { maxReconnectAttempts, initialReconnectDelayMs } =
						this.options;
					if (
						maxReconnectAttempts > 0 &&
						this.reconnectAttempts > maxReconnectAttempts
					) {
						this.emit(
							"reconnect_exhausted",
							this.reconnectAttempts
						);
						return;
					}
					const delay = Math.min(
						initialReconnectDelayMs *
							Math.pow(
								2,
								Math.min(this.reconnectAttempts - 1, 5)
							),
						30_000
					);
					this.emit("reconnecting", {
						attempt: this.reconnectAttempts,
						delay,
					});
					this.clearTimer();
					this.reconnectTimer = setTimeout(() => {
						if (!this.stopped) {
							try {
								this._socket = this.createSocketInstance();
							} catch (err) {
								console.error(
									"Reconnection attempt failed to create new socket:",
									err
								);
							}
						}
					}, delay);
				} else if (connection === "open") {
					this.reconnectAttempts = 0;
				}
			}

			// forward remaining events generically
			for (const key in events) {
				if (key === "connection.update" || key === "creds.update") {
					continue;
				}
				const payload = (events as any)[key];
				if (payload !== undefined) {
					await this.handle(
						key as keyof BaileysEventMap,
						payload,
						sock
					);
				}
			}
		});

		return sock as WASocket;
	}

	private async handle<E extends keyof BaileysEventMap>(
		event: E,
		payload: BaileysEventMap[E],
		sock: WASocket
	) {
		// run middleware chain: [global,*] then [specific,event]
		const chain: Middleware[] = [
			...(this.middlewareMap.get("*") || []),
			...(this.middlewareMap.get(String(event)) || []),
		];

		let idx = -1;
		const dispatch = async (i: number): Promise<void> => {
			if (i <= idx) {
				return Promise.reject(
					new Error("next() called multiple times")
				);
			}
			idx = i;
			const fn = chain[i];
			if (!fn) {
				return;
			}
			await fn(payload as any, () => dispatch(i + 1), {
				event: event as any,
				socket: sock,
			});
		};

		try {
			await dispatch(0);
		} catch (err) {
			// middleware error shouldn't crash the pipeline
			console.error(`Middleware error for event ${String(event)}:`, err);
		}

		// emit for consumers
		this.emit(String(event), payload);
	}

	override removeAllListeners<E extends keyof BaileysEventMap | BEvent>(
		event?: E
	): this {
		const key = event ? String(event) : null;
		if (key && this.middlewareMap.has(key)) {
			this.middlewareMap.delete(key);
		} else if (!key) {
			this.middlewareMap.clear();
		}
		return super.removeAllListeners(event as any);
	}
	override on<E extends keyof BaileysEventMap>(
		event: E,
		listener: (payload: BaileysEventMap[E]) => void
	): this {
		return super.on(event, listener);
	}
	override off<E extends keyof BaileysEventMap>(
		event: E,
		listener: (payload: BaileysEventMap[E]) => void
	): this {
		return super.off(event, listener);
	}
	override once<E extends keyof BaileysEventMap>(
		event: E,
		listener: (payload: BaileysEventMap[E]) => void
	): this {
		return super.once(event, listener);
	}
}
