import cron from "node-cron";

export default class Cronjob {
	/**
	 * @param {string} name
	 * @param {{}} schema
	 */
	constructor(name, data = {}, schema) {
		this.name = name;
		this[name] = data;
		this.schema = schema;
	}

	/**
	 * @param {string} expression
	 */
	validate(expression) {
		return cron.validate(expression);
	}

	/**
	 * @param {string} expression
	 * @param {(arg0: any) => void | PromiseLike<void>} fun
	 * @param {cron.ScheduleOptions | undefined} options
	 */
	schedule(expression, fun, options) {
		if (!this.validate(expression)) {
			throw new Error("Invalid cron expression");
		}
		cron.schedule(expression, async () => fun(this[this.name]), options);
	}

	get tasks() {
		return cron.getTasks();
	}
}
