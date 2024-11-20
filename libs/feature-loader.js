import { readdirSync, watch } from "fs";
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
			this.features[file] = importedModule;
			this.features[file].filePath = filePath;
		} catch (error) {
			logger.error(`Failed to import ${file}: ${error}`);
		}
	}
}
