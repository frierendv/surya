export const SUPPORTED_MEDIA_TYPES = [
	"image",
	"video",
	"audio",
	"document",
] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];
