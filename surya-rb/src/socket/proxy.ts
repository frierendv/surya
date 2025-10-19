export const proxyBind = <T extends object>(root: T): T => {
	const seen = new WeakMap<object, any>();

	const wrap = (obj: any): any => {
		if (obj === null || typeof obj !== "object") {
			return obj;
		}
		const cached = seen.get(obj);
		if (cached) {
			return cached;
		}

		const p = new Proxy(obj, {
			get(t, prop, recv) {
				const v = Reflect.get(t, prop, recv);
				if (typeof v === "function") {
					return v.bind(t);
				}
				if (v && typeof v === "object") {
					return wrap(v);
				}
				return v;
			},
		});
		seen.set(obj, p);
		return p;
	};

	return wrap(root);
};
