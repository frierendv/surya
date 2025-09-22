/**
 * Capitalize the first character of a string.
 */
export const capitalize = (
	input: string,
	options?: { locale?: string | string[]; lowerRest?: boolean }
): string => {
	const { locale, lowerRest = false } = options ?? {};

	if (typeof input !== "string") {
		return input;
	}
	if (input.length === 0) {
		return input;
	}

	const [first, ...rest] = Array.from(input);
	const head = first?.toLocaleUpperCase(locale);
	const tail = rest.join("")
		? lowerRest
			? rest.join("").toLocaleLowerCase(locale)
			: rest.join("")
		: "";

	return head + tail;
};
