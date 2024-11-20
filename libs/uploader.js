// @ts-nocheck
import { fileTypeFromBuffer } from "file-type";
import { request } from "undici";

class Provider {
	constructor() {
		if (this.constructor === Provider) {
			throw new Error("Abstract class cannot be instantiated");
		}
	}

	form(key, blob, filename) {
		const form = new FormData();
		form.set(key, blob, filename);
		return form;
	}

	async fileType(buffer) {
		const { mime, ext } = await fileTypeFromBuffer(buffer);
		return { mime, ext };
	}

	async upload(_buffer) {
		throw new Error("Method 'upload' must be implemented");
	}
}

class QuaxProvider extends Provider {
	async upload(buffer) {
		const { mime, ext } = await this.fileType(buffer);
		const blob = new Blob([buffer], { type: mime });
		const form = this.form("files[]", blob, `file.${ext}`);
		const { body } = await request("https://qu.ax/upload.php", {
			method: "POST",
			body: form,
		});
		const data = await body.json();
		if (!data.success) {
			throw new Error(data.description);
		}
		return data.files[0].url;
	}
}

class FreeImageProvider extends Provider {
	async upload(buffer) {
		const { body: htmlBody } = await request("https://freeimage.host/");
		const html = await htmlBody.text();
		const token = html.match(/PF.obj.config.auth_token = "(.+?)";/)[1];
		const { mime, ext } = await this.fileType(buffer);
		const blob = new Blob([buffer], { type: mime });
		const form = this.form("source", blob, `file.${ext}`);
		const options = {
			type: "file",
			action: "upload",
			timestamp: (Date.now() / 1000).toString(),
			auth_token: token,
			nsfw: "0",
		};
		for (const [key, value] of Object.entries(options)) {
			form.append(key, value);
		}
		const { body } = await request("https://freeimage.host/json", {
			method: "POST",
			body: form,
		});
		const data = await body.json();
		return data.image.url;
	}
}

class TmpFilesProvider extends Provider {
	async upload(buffer) {
		const { mime, ext } = await this.fileType(buffer);
		const blob = new Blob([buffer], { type: mime });
		const form = this.form("file", blob, `file.${ext}`);
		const { body } = await request("https://tmpfiles.org/api/v1/upload", {
			method: "POST",
			body: form,
		});
		const data = await body.json();
		const url = data.data.url.match(/https:\/\/tmpfiles.org\/(.*)/)[1];
		return "https://tmpfiles.org/dl/" + url;
	}
}

class PasteboardProvider extends Provider {
	async upload(buffer) {
		const { mime, ext } = await this.fileType(buffer);
		const blob = new Blob([buffer], { type: mime });
		const form = this.form("file", blob, `image.${ext}`);
		form.set("cb", "294");
		const { body } = await request("https://pasteboard.co/upload", {
			method: "POST",
			body: form,
		});
		const data = await body.json();
		if (!data.url) {
			throw new Error(data);
		}
		return "https://gcdnb.pbrd.co/images/" + data.fileName;
	}
}

class Uploader {
	constructor() {
		this.providers = {
			quax: new QuaxProvider(),
			freeimage: new FreeImageProvider(),
			tmpfiles: new TmpFilesProvider(),
			pasteboard: new PasteboardProvider(),
		};
	}

	isBuffer(buffer) {
		return Buffer.isBuffer(buffer);
	}

	async upload(buffer, provider = "quax") {
		if (!this.providers[provider]) {
			throw new Error("Uploader not found");
		}
		if (!Buffer.isBuffer(buffer)) {
			throw new Error("Buffer is not a buffer");
		}
		try {
			const url = await this.providers[provider].upload(buffer);
			return url;
		} catch (error) {
			throw new Error(error);
		}
	}
}

const uploader = new Uploader();

export default uploader;

export const { quax, freeimage, tmpfiles, pasteboard } = uploader.providers;
