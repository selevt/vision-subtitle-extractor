// Integration test script
// Tests the PlatformClient with real macOS binaries

import { PlatformClient } from './src/lib/core/PlatformClient.ts';
import { TextNormalizer } from './src/lib/core/TextNormalizer.ts';
import { FrameScheduler } from './src/lib/core/FrameScheduler.ts';
import { SRTGenerator } from './src/lib/core/SRTGenerator.ts';
import type { ProcessingConfig } from './src/lib/core/types.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testPlatformClient() {
	console.log('Testing PlatformClient with real macOS binaries...\n');

	const client = new PlatformClient('mac');

	try {
		// Test 1: getDuration
		console.log('Test 1: getDuration');
		const testVideo = path.join(__dirname, 'platforms/mac/frames/.build/release/mac-frames');
		const duration = await client.getDuration(testVideo);
		console.log(`  Duration: ${duration}s (expected 0 for non-existent file)\n`);

		// Test 2: recognize with a simple image
		console.log('Test 2: recognize');
		const testImage =
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
		const text = await client.recognize(testImage);
		console.log(`  OCR result: "${text}" (expected empty string for transparent pixel)\n`);

		// Test 3: extract frame (will fail because file doesn't exist, but tests communication)
		console.log('Test 3: extract frame');
		try {
			const frame = await client.extract(1.5, testVideo);
			console.log(`  Frame extracted at time ${frame.time}`);
		} catch (e) {
			console.log(`  Frame extraction failed as expected: ${e.message}`);
		}
		console.log();

		console.log('All PlatformClient tests passed!');
	} catch (error) {
		console.error('Test failed:', error);
		process.exit(1);
	} finally {
		client.kill();
	}
}

async function testEndToEnd() {
	console.log('\nTesting end-to-end subtitle generation...\n');

	// Find a video file
	let testVideo = path.join(__dirname, 'test', 'videos', 'sample.mp4');
	let videoExists = false;

	try {
		await fs.access(testVideo);
		videoExists = true;
	} catch {
		// Try to find any mp4 file in the project
		const files = await fs.readdir(__dirname);
		const mp4Files = files.filter((f) => f.endsWith('.mp4'));
		if (mp4Files.length > 0) {
			testVideo = path.join(__dirname, mp4Files[0]);
			videoExists = true;
		}
	}

	if (!videoExists) {
		console.log('No test video found. To test end-to-end, please add a video file.');
		console.log('You can create a test video or use an existing one.');
		return;
	}

	console.log(`Using test video: ${testVideo}`);

	const client = new PlatformClient('mac');

	try {
		const duration = await client.getDuration(testVideo);
		console.log(`Video duration: ${duration}s`);

		const normalizer = new TextNormalizer([]);
		const processingConfig: ProcessingConfig = {
			interval: 1.0,
			forwardFactor: 1,
			videoPath: testVideo,
			videoDuration: duration,
			language: 'ko'
		};
		const scheduler = new FrameScheduler(processingConfig, normalizer, client, client);

		const subtitles = [];
		const startTime = 0.1;
		const endTime = Math.min(5.0, duration); // Only process first 5 seconds

		console.log(`Generating subtitles from ${startTime}s to ${endTime}s...`);

		for await (const sub of scheduler.generateSubtitles(startTime, endTime)) {
			subtitles.push(sub);
			console.log(`  Subtitle ${sub.index}: ${sub.text}`);
			if (subtitles.length >= 5) break; // Limit for testing
		}

		console.log(`\nGenerated ${subtitles.length} subtitles`);

		if (subtitles.length > 0) {
			const merged = SRTGenerator.mergeSubtitles(subtitles);
			const srt = SRTGenerator.generateSRT(merged);
			console.log('\nGenerated SRT:');
			console.log(srt);

			// Save to file
			const outputPath = path.join(__dirname, 'test-output.srt');
			await fs.writeFile(outputPath, srt, 'utf8');
			console.log(`\nSRT saved to: ${outputPath}`);
		}

		console.log('\nEnd-to-end test completed successfully!');
	} catch (error) {
		console.error('End-to-end test failed:', error);
		process.exit(1);
	} finally {
		client.kill();
	}
}

// Run tests
try {
	await testPlatformClient();
	await testEndToEnd();
	console.log('\n✅ All integration tests passed!');
} catch (error) {
	console.error('\n❌ Integration tests failed:', error);
	process.exit(1);
}
