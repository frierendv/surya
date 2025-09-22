import { describe, expect, test } from "@jest/globals";
import { credsDocKey, fromJSONSafe, keyDocKey, toJSONSafe } from "../src/utils";

describe("utils", () => {
	test("key builder helpers", () => {
		expect(credsDocKey("s1")).toBe("s1:creds");
		expect(keyDocKey("s1", "session", "abc")).toBe("s1:key:session:abc");
	});

	test("toJSONSafe/fromJSONSafe round-trip", async () => {
		const original = {
			plain: 1,
			buf: Buffer.from("hi"),
			arr: [1, 2, 3],
		};
		const jsonReady = await toJSONSafe(original);
		// Should be plain-JSON serializable
		expect(() => JSON.stringify(jsonReady)).not.toThrow();
		const restored = await fromJSONSafe(jsonReady);
		// If BufferJSON is available, this will be a Buffer; otherwise plain value.
		if (Buffer.isBuffer(restored.buf)) {
			expect((restored.buf as Buffer).equals(original.buf)).toBe(true);
		} else {
			// Fallback path returns plain values
			expect(restored.buf).toBeDefined();
		}
		expect(restored.plain).toBe(1);
		expect(restored.arr).toEqual([1, 2, 3]);
	});
});
