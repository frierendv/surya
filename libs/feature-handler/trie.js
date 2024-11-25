class TrieNode {
	constructor() {
		this.children = {};
		this.isEndOfWord = false;
		this.value = null;
	}
}

export class Trie {
	constructor() {
		this.root = new TrieNode();
	}

	/**
	 * @param {string} key
	 * @param {any} value
	 */
	insertOne(key, value) {
		let node = this.root;
		for (const char of key) {
			if (!node.children[char]) {
				node.children[char] = new TrieNode();
			}
			node = node.children[char];
		}
		node.isEndOfWord = true;
		node.value = value;
	}
	/**
	 * @param {string[]} keys
	 * @param {any} value
	 */
	insertMany(keys, value) {
		for (const key of keys) {
			this.insertOne(key, value);
		}
	}
	/**
	 * @param {string} key
	 * @returns {any}
	 */
	findOne(key) {
		let node = this.root;
		for (const char of key) {
			if (!node.children[char]) {
				return null;
			}
			node = node.children[char];
		}
		return node.isEndOfWord ? node.value : null;
	}
	/**
	 *
	 * @param {string[]} keys
	 * @returns {any[]}
	 */
	findMany(keys) {
		return keys.map((key) => this.findOne(key));
	}
	/**
	 * @param {string} key
	 */
	removeOne(key) {
		this._remove(this.root, key, 0);
	}

	/**
	 * @param {TrieNode} node
	 * @param {string} key
	 * @param {number} depth
	 * @returns {boolean}
	 */
	_remove(node, key, depth) {
		if (!node) {
			return false;
		}

		if (depth === key.length) {
			if (!node.isEndOfWord) {
				return false;
			}
			node.isEndOfWord = false;
			node.value = null;
			return Object.keys(node.children).length === 0;
		}

		const char = key[depth];
		if (this._remove(node.children[char], key, depth + 1)) {
			delete node.children[char];
			return Object.keys(node.children).length === 0 && !node.isEndOfWord;
		}

		return false;
	}
}
