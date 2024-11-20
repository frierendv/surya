import { Mutex } from "async-mutex";
import { existsSync, readFileSync, writeFileSync } from "fs";
import mongoose from "mongoose";
import config from "../config.js";
import * as Schema from "../schema/index.js";
import Support from "./database/support.js";

export class Database {
	#initialized = false;
	_mutex = new Mutex();
	/**
	 * @type {import("mongoose").Model | null}
	 */
	_model = null;

	path = "./database.json";
	data = { users: {}, groups: {}, settings: {} };

	// read-only properties
	/**
	 * @type {Support}
	 */
	users;
	/**
	 * @type {Support}
	 */
	groups;
	/**
	 * @type {Support}
	 */
	settings;

	/**
	 * @param {{ mongo_url: any; schemas: any; path?: any; debug?: any; }} options
	 */
	constructor(options) {
		const { path, debug, mongo_url, schemas } = options;
		this.path = path ?? this.path;
		this.debug = debug ?? false;
		this.mongo_url = mongo_url ?? false;
		this.schemas = schemas ?? {};
	}

	async _write() {
		await this._mutex.runExclusive(async () => {
			try {
				if (this.mongo_url && this._model) {
					await this._model.updateOne({}, this.data, {
						upsert: true,
					});
				}
				writeFileSync(this.path, JSON.stringify(this.data, null, 2));
			} catch (e) {
				console.error(e);
			}
		});
	}

	async initialize() {
		if (this.hasInitialized) {
			return;
		}

		if (this.mongo_url) {
			await this.initializeMongoDB();
		}
		if (!existsSync(this.path) || !this.isValidJsonFile()) {
			await this.createJsonFile();
		}
		this.data = JSON.parse(readFileSync(this.path, "utf-8"));
		this.data.users = this.data.users ?? {};
		this.data.groups = this.data.groups ?? {};
		this.data.settings = this.data.settings ?? {};

		this.users = new Support("users", this.data.users, this.schemas.user);
		this.groups = new Support(
			"groups",
			this.data.groups,
			this.schemas.groups
		);
		this.settings = new Support(
			"settings",
			this.data.settings,
			this.schemas.settings
		);

		this.saveDataPeriodically();
		this.#initialized = true;
	}

	async initializeMongoDB() {
		try {
			await mongoose.connect(this.mongo_url);
			const DataSchema = new mongoose.Schema({
				users: Object,
				groups: Object,
				settings: Object,
			});
			this._model = mongoose.model("data", DataSchema);
		} catch (e) {
			throw new Error(e);
		}
	}

	isValidJsonFile() {
		try {
			JSON.parse(readFileSync(this.path, "utf-8"));
			return true;
		} catch {
			return false;
		}
	}

	async createJsonFile() {
		if (this.mongo_url && this._model) {
			const data = await this._model.findOne();
			if (data) {
				writeFileSync(this.path, JSON.stringify(data, null, 2));
				return;
			}
		}
		writeFileSync(this.path, JSON.stringify({}));
	}

	saveDataPeriodically() {
		if (this.hasInitialized) {
			return;
		}
		setInterval(() => this._write(), 10_000);
	}

	get hasInitialized() {
		return this.#initialized;
	}

	get __test__() {
		return { write: this._write };
	}
}

const database = new Database({
	mongo_url: config?.database?.mongo_url,
	schemas: {
		user: Schema.UserSchema,
		group: Schema.GroupSchema,
		settings: Schema.SettingsSchema,
	},
});

export default database;
