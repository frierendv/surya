import Cronjob from "./cronjob.js";

export default class Support {
	/**
	 * @param {string} name
	 * @param {{}} data
	 * @param {Record<string, unknown>} schema
	 */
	constructor(name, data, schema) {
		this.name = name;
		this[name] = data ?? {};
		this.schema = schema;
		this.cron = new Cronjob(name, this[name], this.schema);
	}

	/**
	 * @param {string | number} key
	 */
	get(key) {
		return this[this.name][key] ?? null;
	}

	/**
	 * @param {string} key
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
	 */
	isExist(key) {
		return !!this[this.name][key];
	}

	/**
	 * @param {string | number} key
	 */
	delete(key) {
		delete this[this.name][key];
	}

	clear() {
		this[this.name] = {};
	}

	get all() {
		return this[this.name];
	}
}
