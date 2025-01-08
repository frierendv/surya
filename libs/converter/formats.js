/** @type {Record<string, string[]>} */
export const audio = {
	opus: [
		"-vn",
		"-c:a",
		"libopus",
		"-b:a",
		"128k",
		"-vbr",
		"on",
		"-compression_level",
		"10",
	],
	mp3: ["-vn", "-c:a", "libmp3lame", "-q:a", "2"],
	aiff: ["-vn", "-c:a", "pcm_s16be"],
	amr: ["-vn", "-c:a", "libopencore_amrnb", "-ar", "8000", "-b:a", "12.2k"],
	flac: ["-vn", "-c:a", "flac"],
	m4a: ["-vn", "-c:a", "aac", "-b:a", "128k"],
	m4r: ["-vn", "-c:a", "libfdk_aac", "-b:a", "64k"],
	mka: ["-vn", "-c:a", "libvorbis", "-b:a", "128k"],
	ogg: ["-vn", "-c:a", "libvorbis", "-q:a", "3"],
	wav: ["-vn", "-c:a", "pcm_s16le"],
	wma: ["-vn", "-c:a", "wmav2", "-b:a", "128k"],
};
Object.assign(audio, {
	"3g2": [...audio.opus],
	"3gp": [...audio.opus],
});

/** @type {Record<string, string[]>} */
export const sticker = {
	image: [
		"-vcodec",
		"libwebp",
		"-vf",
		`scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,
         pad=320:320:-1:-1:color=white@0.0,
         split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p];
         [b][p] paletteuse`,
	],
};
sticker.video = [
	...sticker.image,
	"-loop",
	"0",
	"-ss",
	"00:00:00",
	"-t",
	"00:00:20",
	"-preset",
	"default",
	"-an",
	"-vsync",
	"0",
];
