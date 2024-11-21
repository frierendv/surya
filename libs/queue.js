// File://home/rose/BOT/SuryaRB/Libs/Queue.js
class User {
	constructor() {
		this.list = {};
	}
}
class Queue {
	constructor() {
		this.queue = new User();
	}
	/**
	 * @param {string | number} jid
	 * @param {string} feature
	 */
	add(jid, feature) {
		if (!this.queue.list[jid]) {
			this.queue.list[jid] = [];
		}
		this.queue.list[jid].push(feature);
	}
	/**
	 * @param {string | number} jid
	 * @param {string} feature
	 */
	exist(jid, feature) {
		if (!this.queue.list[jid]) {
			return false;
		}
		return this.queue.list[jid].includes(feature);
	}
	/**
	 * @param {string | number} jid
	 * @param {string} feature
	 */
	remove(jid, feature) {
		if (!this.queue.list[jid]) {
			return;
		}
		this.queue.list[jid].splice(this.queue.list[jid].indexOf(feature), 1);
	}
	get list() {
		return this.queue.list;
	}
}
const queue = new Queue();
export default queue;
