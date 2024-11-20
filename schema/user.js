export const UserSchema = {
	/**
	 * User name
	 */
	name: String,
	/**
	 * User available limit
	 */
	limit: Number,
	/**
	 * is user premium
	 */
	premium: Boolean,
	/**
	 * User premium expired time
	 */
	premium_expired: Number,
	/**
	 * `true` if this user is banned
	 */
	banned: Boolean,
};
