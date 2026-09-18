import { Command } from '@tauri-apps/plugin-shell';
import { tempDir } from '@tauri-apps/api/path';
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

export async function downloadYouTubeVideo(
	url: string,
	onProgress?: (progress: DownloadProgress) => void
): Promise<VideoFile> {
	const tmpDir = await tempDir();
	const outputTemplate = `${tmpDir}subtitle-extractor-%(id)s.%(ext)s`;

	const args = [
		'-f',
		'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
		'--merge-output-format',
		'mp4',
		'-o',
		outputTemplate,
		'--newline',
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

		// Parse progress from [download] X.X% lines
		const progressMatch = trimmed.match(/\[download\]\s+([\d.]+)%/);
		if (progressMatch) {
			const fraction = parseFloat(progressMatch[1]) / 100;
			onProgress?.({ progressFraction: fraction, status: 'Downloading' });
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
		command.on('close', (data) => {
			console.log('yt-dlp process closed:', data);
			if (data.code !== 0) {
				reject(new Error(`yt-dlp failed with code ${data.code}: ${stderr}`));
				return;
			}
			if (!lastFilePath) {
				reject(new Error('yt-dlp completed but no output file path was captured'));
				return;
			}
			const parts = lastFilePath.split('/');
			const fileName = parts[parts.length - 1];
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
