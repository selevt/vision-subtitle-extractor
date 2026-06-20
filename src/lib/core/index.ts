import { parseArgs } from './config';
import { PlatformClient } from './PlatformClient';
import { TextNormalizer } from './TextNormalizer';
import { FrameScheduler } from './FrameScheduler';
import { SRTGenerator } from './SRTGenerator';
import * as fs from 'node:fs/promises';
import type { Config, Subtitle, ProcessingConfig } from './types';

async function main() {
	const config = parseArgs(process.argv.slice(2));

	// Validate config
	if (!config.videoPath) {
		console.error('Error: videoPath is required');
		process.exit(1);
	}

	const platform =
		config.platform === 'auto' ? (process.platform === 'darwin' ? 'mac' : 'win') : config.platform;
	const client = new PlatformClient(platform);

	// Get video duration
	const duration = await client.getDuration(config.videoPath);

	const normalizer = new TextNormalizer(config.substitutions || []);

	const processingConfig: ProcessingConfig = {
		interval: config.interval,
		forwardFactor: config.forwardFactor,
		videoPath: config.videoPath,
		language: config.language,
		recognitionLevel: config.recognitionLevel,
		roi: config.roi
	};

	const scheduler = new FrameScheduler(processingConfig, normalizer, client, client);

	const startTime = config.startTimeMs ? config.startTimeMs / 1000 : 0.1;
	const endTime = config.endTimeMs ? config.endTimeMs / 1000 : duration;

	console.log(`Starting subtitle extraction...`);
	console.log(`Video: ${config.videoPath}`);
	console.log(
		`Duration: ${duration}s, Interval: ${config.interval}s, Forward factor: ${config.forwardFactor}`
	);

	const subtitles: Subtitle[] = [];
	const totalFrames = Math.ceil((endTime - startTime) / config.interval);
	let processed = 0;
	const progressBarWidth = 30;

	for await (const sub of scheduler.generateSubtitles(startTime, endTime)) {
		subtitles.push(sub);
		processed++;
		const percent = processed / totalFrames;
		const filled = Math.floor(percent * progressBarWidth);
		const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(progressBarWidth - filled);
		process.stdout.write(`\r[${bar}] ${Math.floor(percent * 100)}% (${processed}/${totalFrames})`);
	}

	console.log('\n');
	console.log(`Processing complete. Generating SRT...`);

	const merged = SRTGenerator.mergeSubtitles(subtitles);
	const srt = SRTGenerator.generateSRT(merged);

	await fs.writeFile(config.outputPath, srt, 'utf8');
	console.log(`Successfully wrote ${merged.length} subtitles to ${config.outputPath}`);

	client.kill();
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});

export * from './types';
export * from './TextNormalizer';
export * from './SRTGenerator';
export * from './FrameSource';
export * from './OCREngine';
export * from './config';
export * from './PlatformClient';
export * from './FrameScheduler';
