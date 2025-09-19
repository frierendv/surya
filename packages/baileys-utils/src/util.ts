import Long from "long";

export const safeString = (text: string | null | undefined) => {
	if (!text) {
		return text;
	}
	return text.replace(/[\n\t\r]/g, "");
};

export const calculateFileSize = (
	fileLength?: number | null | Long
): number => {
	if (Long.isLong(fileLength)) {
		return fileLength.toNumber();
	}
	return fileLength ?? 0;
};
