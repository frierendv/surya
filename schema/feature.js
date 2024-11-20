export const Feature = {
	/**
	 * Command name(s)
	 */
	command: Array,
	/**
	 * Command description
	 */
	description: String,
	/**
	 * Command category
	 */
	category: String,
	/**
	 * Mark as owner only
	 */
	owner: Boolean,
	/**
	 * Mark as admin only
	 */
	admin: Boolean,
	/**
	 * Hide from help command
	 */
	hidden: Boolean,
	/**
	 * Mark as limited
	 */
	limit: Boolean,
	/**
	 * Mark as group only
	 */
	group: Boolean,
	/**
	 * Mark as private only
	 */
	private: Boolean,
	/**
	 * The command execution
	 */
	execute: Function,
	/**
	 * Failed message
	 */
	failed: String,
	/**
	 * Wait message
	 */
	wait: String,
	/**
	 * Done message
	 */
	done: String,
};
