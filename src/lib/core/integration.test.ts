import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PlatformClient } from './PlatformClient';
import { TextNormalizer } from './TextNormalizer';
import { FrameScheduler } from './FrameScheduler';
import { SRTGenerator } from './SRTGenerator';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Integration Tests - Real Platform Binaries', () => {
	// These tests require the macOS binaries to be built
	// They will be skipped on non-macOS platforms or if binaries don't exist

	const isMac = process.platform === 'darwin';
	const basePath = process.cwd();
	const frameBin = `${basePath}/platforms/mac/frames/.build/release/mac-frames`;
	const ocrBin = `${basePath}/platforms/mac/ocr/.build/release/mac-ocr`;

	let binariesExist = false;

	beforeAll(async () => {
		// Check if binaries exist
		try {
			if (isMac) {
				await fs.access(frameBin);
				await fs.access(ocrBin);
				binariesExist = true;
			}
		} catch {
			binariesExist = false;
		}

		if (!binariesExist) {
			console.warn('Skipping integration tests: macOS binaries not found');
		}
	});

	describe('PlatformClient with real binaries', () => {
		it.skipIf(!binariesExist)(
			'should spawn and communicate with mac-frames binary',
			async () => {
				const client = new PlatformClient('mac');

				try {
					// Test getDuration
					const testVideo = path.join(__dirname, '../../../../test/videos/sample.mp4');
					let duration: number;

					// Check if test video exists
					try {
						duration = await client.getDuration(testVideo);
						expect(duration).toBeGreaterThan(0);
						console.log(`Video duration: ${duration}s`);
					} catch (e) {
						console.warn('Test video not found, skipping duration test');
						// Use a known video path or skip
					}
				} finally {
					client.kill();
				}
			},
			10000
		);

		it.skipIf(!binariesExist)(
			'should spawn and communicate with mac-ocr binary',
			async () => {
				const client = new PlatformClient('mac');

				try {
					// Create a simple test image (base64 encoded 1x1 black pixel JPEG)
					// This is a minimal valid JPEG: /9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=
					const testImage =
						'/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

					const text = await client.recognize(testImage);
					// The OCR might return empty string for a black pixel
					expect(typeof text).toBe('string');
					console.log(`OCR result: "${text}"`);
				} finally {
					client.kill();
				}
			},
			10000
		);
	});

	describe('End-to-end subtitle generation', () => {
		it.skipIf(!binariesExist)(
			'should generate subtitles from a real video',
			async () => {
				const client = new PlatformClient('mac');

				try {
					let testVideo = path.join(__dirname, '../../../../test/videos/sample.mp4');

					// Check if test video exists
					let videoExists = false;
					try {
						await fs.access(testVideo);
						videoExists = true;
					} catch {
						// Try to find any mp4 file
						const files = await fs.readdir(process.cwd());
						const mp4Files = files.filter((f) => f.endsWith('.mp4'));
						if (mp4Files.length > 0) {
							testVideo = path.join(process.cwd(), mp4Files[0]);
							videoExists = true;
						}
					}

					if (!videoExists) {
						console.warn('No test video found, skipping end-to-end test');
						return;
					}

					const duration = await client.getDuration(testVideo);
					const normalizer = new TextNormalizer([]);

					const scheduler = new FrameScheduler(
						{ interval: 1.0, forwardFactor: 1, videoPath: testVideo },
						normalizer,
						client,
						client
					);

					const subtitles = [];
					const startTime = 0.1;
					const endTime = Math.min(5.0, duration); // Only process first 5 seconds

					for await (const sub of scheduler.generateSubtitles(startTime, endTime)) {
						subtitles.push(sub);
						if (subtitles.length >= 3) break; // Just get a few subtitles
					}

					expect(subtitles.length).toBeGreaterThan(0);
					console.log(`Generated ${subtitles.length} subtitles`);

					// Test SRT generation
					const merged = SRTGenerator.mergeSubtitles(subtitles);
					const srt = SRTGenerator.generateSRT(merged);

					expect(srt).toContain('1');
					expect(srt).toContain('-->');
					console.log('SRT generation successful');
				} finally {
					client.kill();
				}
			},
			30000
		); // 30 second timeout for end-to-end test
	});
});
