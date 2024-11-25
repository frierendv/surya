import { watch } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";
import { logger } from "../shared/logger.js";
import { Trie } from "./feature-handler/trie.js";

export default class FeatureLoader {
	_initialized = false;
	/**
	 * @type {Trie}
	 */
	features;
	/**
	 * @type {Map<string, import("surya").Feature>}
	 */
	_features = new Map();
	/**
	 * @type {string}
	 */
	_path;
	/**
	 *
	 * @param {Object} opts
	 * @param {string} opts.dir
	 */
	constructor(opts) {
		const { dir: folderDir } = opts;
		this._path = folderDir;
		this.features = new Trie();
	}

	async initialize() {
		if (this._initialized) {
			return;
		}
		this._initialized = true;
		await this.loadFeatures();
		await this.watchFeatures();
	}

	async loadFeatures() {
		const files = await readdir(this._path);
		const jsFiles = files.filter((file) => file.endsWith(".js"));
		await Promise.all(jsFiles.map((file) => this.import(file)));
	}

	async watchFeatures() {
		watch(
			this._path,
			/**
			 * @param {import("fs").WatchEventType} event
			 * @param {string | null} file
			 */
			async (event, file) => {
				if (event === "change" && file) {
					await this.import(file);
				}
			}
		);
	}

	/**
	 * @param {string} file
	 */
	async import(file) {
		const filePath = join(
			process.platform === "win32" ? `file:///${this._path}` : this._path,
			file
		);
		logger.info(`Importing ${file}`);

		if (this.features.findOne(file)) {
			logger.info(`Re-importing ${file}`);
			this.features.removeOne(file);
		}

		try {
			const moduleUrl = `${filePath}?t=${Date.now()}`;
			const importedModule = (await import(moduleUrl)).default;

			const feature = this.validateFeature(importedModule);
			if (!feature) {
				return;
			}
			feature.filePath = join(this._path, file);
			const _feature = Object.fromEntries(
				Object.entries(feature).filter(([key]) => key !== "execute")
			);
			this._features.set(
				file,
				// @ts-expect-error
				_feature
			);
			this.features.insertMany(feature.command, feature);
		} catch (error) {
			logger.error(`Failed to import ${file}: ${error}`);
		}
	}

	/**
	 * @param {import("surya").Feature} feature
	 */
	validateFeature(feature) {
		const keys = Object.keys(feature);
		if (!keys.includes("command")) {
			logger.error("Feature is missing a command");
			return null;
		}
		if (!keys.includes("execute")) {
			logger.error("Feature is missing an execute function");
			return null;
		}
		if (typeof feature.command === "string") {
			feature.command = [feature.command];
		} else if (!Array.isArray(feature.command)) {
			logger.error("Command must be a string or an array");
			return null;
		}
		if (typeof feature.execute !== "function") {
			logger.error("Execute must be a function");
			return null;
		}
		return feature;
	}
}
