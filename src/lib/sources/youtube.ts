import { Command } from '@tauri-apps/plugin-shell';
import { tempDir } from '@tauri-apps/api/path';
import { rename } from '@tauri-apps/plugin-fs';
import type { VideoFile } from '../file-source';

export interface DownloadProgress {
	progressFraction: number;
	status: string;
}

let ytDlpAvailable: boolean | null = null;

export async function isYtDlpAvailable(): Promise<boolean> {
	if (ytDlpAvailable !== null) return ytDlpAvailable;
	try {
		const command = Command.create('yt-dlp', ['--version']);
		const result = await command.execute();
		ytDlpAvailable = result.code === 0;
	} catch {
		ytDlpAvailable = false;
	}
	return ytDlpAvailable;
}

let ffmpegAvailable: boolean | null = null;

async function isFfmpegAvailable(): Promise<boolean> {
	if (ffmpegAvailable !== null) return ffmpegAvailable;
	try {
		const result = await Command.create('ffmpeg', ['-version']).execute();
		ffmpegAvailable = result.code === 0;
	} catch {
		ffmpegAvailable = false;
	}
	return ffmpegAvailable;
}

/**
 * Remux a fragmented (DASH) mp4 into a progressive one. AVFoundation misreads
 * the duration of fragmented files (reports 2x), which breaks frame
 * extraction; a plain stream copy fixes the container without re-encoding.
 * No-op when ffmpeg is not installed or the file is not mp4.
 */
async function remuxToProgressiveMp4(filePath: string): Promise<void> {
	if (!(await isFfmpegAvailable())) return;
	if (!filePath.toLowerCase().endsWith('.mp4')) return;

	const tmpPath = `${filePath}.remux.mp4`;
	const result = await Command.create('ffmpeg', [
		'-y',
		'-i',
		filePath,
		'-c',
		'copy',
		'-movflags',
		'+faststart',
		tmpPath
	]).execute();

	if (result.code !== 0) {
		console.error('ffmpeg remux failed, keeping original file:', result.stderr);
		return;
	}
	await rename(tmpPath, filePath);
}

export async function downloadYouTubeVideo(
	url: string,
	onProgress?: (progress: DownloadProgress) => void
): Promise<VideoFile> {
	const tmpDir = await tempDir();
	const outputTemplate = `${tmpDir}subtitle-extractor-%(id)s.%(ext)s`;

	// Merge the best H.264 video stream with the best m4a audio stream so the
	// preview has sound. avc1/m4a are the codecs AVFoundation and the webview
	// reliably decode. Without ffmpeg (needed for the merge) fall back to
	// combined formats or video-only.
	const canMerge = await isFfmpegAvailable();
	const formatExpr = canMerge
		? 'bv[vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]/b/bv[vcodec^=avc1]'
		: 'b[ext=mp4]/b/bv[vcodec^=avc1]';

	const args = [
		'-f',
		formatExpr,
		// Only used when the merge expression matched; inert otherwise
		'--merge-output-format',
		'mp4',
		'-o',
		outputTemplate,
		'--newline',
		// yt-dlp suppresses progress output when stdout is not a TTY (as with
		// spawned pipes), so force it on. The template tags every line with the
		// stream's video codec ("none" = audio-only) so both streams of a merge
		// can be tracked separately and the bar never moves backwards.
		'--progress',
		'--progress-template',
		'download:PROGRESS %(info.vcodec)s %(progress._percent_str)s %(progress._speed_str)s ETA %(progress._eta_str)s',
		'--print',
		'after_move:filepath',
		url
	];

	const command = Command.create('yt-dlp', args);

	let lastFilePath = '';
	let stderr = '';
	let videoFraction = 0;
	let audioFraction = 0;
	let hasAudioStream = false;
	let reportedFraction = 0;

	command.stdout.addListener('data', (line) => {
		console.log(`[yt-dlp] ${line}`);
		const trimmed = line.trim();
		if (!trimmed) return;

		// Parse progress from PROGRESS lines (--progress-template)
		const progressMatch = trimmed.match(/^PROGRESS\s+(\S+)\s+([\d.]+)%\s*(.*)$/);
		if (progressMatch) {
			const isAudio = progressMatch[1] === 'none';
			const fraction = parseFloat(progressMatch[2]) / 100;
			// Drop placeholder values yt-dlp emits before estimates are known
			const rawDetail = progressMatch[3].trim();
			const detail = /Unknown|^NA$/.test(rawDetail) ? '' : rawDetail;

			if (isAudio) {
				hasAudioStream = true;
				audioFraction = Math.max(audioFraction, fraction);
			} else {
				videoFraction = Math.max(videoFraction, fraction);
			}

			// Weight both streams of a merged download into one overall value;
			// the max() keeps the bar from ever moving backwards (e.g. when
			// the audio stream starts after the video stream already finished)
			const combined = hasAudioStream
				? 0.9 * videoFraction + 0.1 * audioFraction
				: videoFraction;
			reportedFraction = Math.max(reportedFraction, combined);

			const stream = isAudio ? 'audio' : 'video';
			const status = detail
				? `Downloading ${stream} (${detail})`
				: `Downloading ${stream}`;
			onProgress?.({ progressFraction: reportedFraction, status });
			return;
		}

		// The --print after_move:filepath output is a plain path line
		// (doesn't start with [ and looks like a file path)
		if (!trimmed.startsWith('[') && (trimmed.startsWith('/') || trimmed.includes('/'))) {
			lastFilePath = trimmed;
			onProgress?.({ progressFraction: 1, status: 'Download complete' });
		}
	});

	command.stderr.addListener('data', (line) => {
		console.error(`[yt-dlp stderr] ${line}`);
		stderr += line + '\n';
	});

	return new Promise<VideoFile>((resolve, reject) => {
		command.on('close', async (data) => {
			console.log('yt-dlp process closed:', data);
			if (data.code !== 0) {
				reject(new Error(`yt-dlp failed with code ${data.code}: ${stderr}`));
				return;
			}
			if (!lastFilePath) {
				reject(new Error('yt-dlp completed but no output file path was captured'));
				return;
			}

			onProgress?.({ progressFraction: 1, status: 'Preparing video...' });
			try {
				await remuxToProgressiveMp4(lastFilePath);
			} catch (e) {
				console.error('Remux failed, using original file:', e);
			}

			const parts = lastFilePath.split('/');
			const fileName = parts[parts.length - 1];
			onProgress?.({ progressFraction: 1, status: 'Download complete' });
			resolve({ filePath: lastFilePath, fileName });
		});

		command.on('error', (err) => {
			console.error('yt-dlp process error:', err);
			reject(err);
		});

		command
			.spawn()
			.then((child) => {
				console.log('yt-dlp process spawned:', child);
			})
			.catch((err) => {
				console.error('Failed to spawn yt-dlp process:', err);
				reject(err);
			});
	});
}
