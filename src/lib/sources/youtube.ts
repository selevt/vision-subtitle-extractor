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

	const args = [
		// Single format download (no merge of separate streams), so progress is
		// one monotonic stream. Prefers the best H.264 video-only stream —
		// audio is not needed for OCR, and avc1 is the only codec the OCR CLI
		// and webview preview reliably decode (AV1/VP9 would break them).
		// Falls back to a combined format when no video-only H.264 stream
		// exists or on non-YouTube sites. The downloaded DASH file is remuxed
		// to a progressive container afterwards (see remuxToProgressiveMp4).
		'-f',
		'bv[vcodec^=avc1]/b[ext=mp4]/b',
		'-o',
		outputTemplate,
		'--newline',
		// yt-dlp suppresses progress output when stdout is not a TTY (as with
		// spawned pipes), so force it on and use a parseable template
		'--progress',
		'--progress-template',
		'download:PROGRESS %(progress._percent_str)s %(progress._speed_str)s ETA %(progress._eta_str)s',
		'--print',
		'after_move:filepath',
		url
	];

	const command = Command.create('yt-dlp', args);

	let lastFilePath = '';
	let stderr = '';

	command.stdout.addListener('data', (line) => {
		console.log(`[yt-dlp] ${line}`);
		const trimmed = line.trim();
		if (!trimmed) return;

		// Parse progress from PROGRESS lines (--progress-template)
		const progressMatch = trimmed.match(/^PROGRESS\s+([\d.]+)%\s*(.*)$/);
		if (progressMatch) {
			const fraction = parseFloat(progressMatch[1]) / 100;
			// Drop placeholder values yt-dlp emits before estimates are known
			const detail = /Unknown|^NA$/.test(progressMatch[2].trim())
				? ''
				: progressMatch[2].trim();
			const status = detail ? `Downloading (${detail})` : 'Downloading';
			onProgress?.({ progressFraction: fraction, status });
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
