export const debounce = <T extends (...args: any[]) => any>(
	fn: T,
	ms: number
): T => {
	let t: any;
	const wrapped = ((...args: any[]) => {
		if (t) {
			clearTimeout(t);
		}
		t = setTimeout(() => fn(...args), ms);
	}) as T;
	return wrapped;
};
