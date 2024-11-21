import Cronjob from "./cronjob.js";

export default class Support {
	/**
	 * @param {string} name
	 * @param {Record<string, any>} data
	 * @param {Record<string, any>} schema
	 */
	constructor(name, data, schema) {
		this.name = name;
		this[name] = data ?? {};
		this.schema = schema;
		this.cron = new Cronjob(name, this[name], this.schema);
	}

	/**
	 * @param {string | number} key
	 * @returns {Record<string, any>}
	 */
	get(key) {
		return this[this.name][key] ?? null;
	}

	/**
	 * @param {string} key
	 * @returns {Record<string, any>}
	 */
	set(key) {
		if (!this[this.name][key]) {
			this[this.name][key] = {};
		}
		for (const k in this.schema) {
			if (!this[this.name][key][k]) {
				this[this.name][key][k] =
					typeof this.schema[k] === "function"
						? this.schema[k]()
						: this.schema[k];
			}
		}
		return this[this.name][key];
	}

	/**
	 * @param {string | number} key
	 * @returns {boolean}
	 */
	isExist(key) {
		return !!this[this.name][key];
	}

	/**
	 * @param {string | number} key
	 * @returns {void}
	 */
	delete(key) {
		delete this[this.name][key];
	}

	/**
	 * @returns {void}
	 */
	clear() {
		this[this.name] = {};
	}

	/**
	 * @returns {Record<string, any>}
	 */
	get all() {
		return this[this.name];
	}
}
