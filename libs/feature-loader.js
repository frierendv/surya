import { existsSync, readdirSync, watch } from "fs";
import { join } from "path";
import { logger } from "../shared/logger.js";

export default class FeatureLoader {
	_initialized = false;

	features = {};
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
		const { dir: _folderDir } = opts;

		this._path = _folderDir;
		this.features = {};
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
		// @ts-ignore
		const files = readdirSync(this._path);
		const jsFiles = files.filter((file) => file.endsWith(".js"));
		for (const file of jsFiles) {
			await this.import(file);
		}
	}

	async watchFeatures() {
		watch(
			this._path,
			/**
			 * @param {import("fs").WatchEventType} event
			 * @param {string} file
			 */
			// @ts-ignore
			async (event, file) => {
				if (event === "change") {
					// if file deleted delete from features
					if (!existsSync(join(this._path, file))) {
						logger.info(`Deleting ${file}`);
						delete this.features[file];
						return;
					}
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

		if (this.features[file]) {
			logger.info(`Re-importing ${file}`);
			delete this.features[file];
		}

		try {
			const importedModule = (await import(`${filePath}?t=${Date.now()}`))
				.default;

			const fp = this.s(importedModule);
			if (!fp) {
				return;
			}
			this.features[file] = fp;
			this.features[file].filePath = join(this._path, file);
		} catch (error) {
			logger.error(`Failed to import ${file}: ${error}`);
		}
	}

	/**
	 * @param {import("surya").Feature} fp
	 */
	s(fp) {
		const keys = Object.keys(fp);
		if (!keys.includes("command")) {
			logger.error("Feature is missing a command");
			return null;
		}
		if (!keys.includes("execute")) {
			logger.error("Feature is missing an execute function");
			return null;
		}
		let command = fp.command;
		if (typeof command === "string") {
			fp.command = [command];
		}
		if (!Array.isArray(command)) {
			logger.error("Command must be a string or an array");
			return null;
		}
		return fp;
	}
}
