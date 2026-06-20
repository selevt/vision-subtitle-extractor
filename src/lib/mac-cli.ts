import { invoke } from '@tauri-apps/api/core';
import { Command, Child } from '@tauri-apps/plugin-shell';
import {
	type ExtractOptions,
	type ExtractResult,
	type Backend,
	type SupportedLanguage,
	Capability
} from './backend-common';

// Import the new core modules
import { TextNormalizer } from './core/TextNormalizer';
import { SRTGenerator } from './core/SRTGenerator';
import type { ProcessingConfig, Subtitle, FrameData } from './core/types';
import type { FrameSource } from './core/FrameSource';
import type { OCREngine } from './core/OCREngine';
import * as fs from '@tauri-apps/plugin-fs';

interface MacCliOptions extends ExtractOptions {}
interface MacCliResult extends ExtractResult {}

// Tauri FrameSource: spawns mac-frames binary ONCE and reuses it
class TauriFrameSource implements FrameSource {
	private command: Command<string> | null = null;
	private child: Child | null = null;
	private requestIdCounter = 0;
	private pendingRequests = new Map<
		number,
		{ resolve: (data: any) => void; reject: (error: Error) => void }
	>();
	private spawning = false;

	async spawnProcess() {
		if (this.child || this.spawning) return;
		this.spawning = true;

		// Kill any orphaned mac-frames processes tracked on the Rust side
		// Tag-based kill ensures we don't kill the OCR engine's process
		try {
			await invoke('kill_sidecars_by_tag', { tag: 'mac-frames' });
		} catch (e) {
			console.warn('[TauriFrameSource] Failed to kill orphaned processes:', e);
		}

		this.command = Command.sidecar('binaries/mac-frames', []);

		// Set up stdout listener for ALL responses
		this.command.stdout.addListener('data', (line: string) => {
			try {
				console.log('[mac-frames]', line);
				const response = JSON.parse(line) as any;
				const requestId = response.requestId as number | undefined;
				if (requestId === undefined) return;
				const pending = this.pendingRequests.get(requestId);

				if (pending) {
					if (response.type === 'frame') {
						pending.resolve({ image: response.image, time: response.time });
					} else if (response.type === 'duration') {
						pending.resolve(response.duration);
					} else if (response.type === 'error') {
						console.error(
							'[TauriFrameSource] Error response for request:',
							requestId,
							response.message
						);
						pending.reject(new Error(response.message || 'Unknown error'));
					}
					this.pendingRequests.delete(requestId);
				} else {
					console.warn('[TauriFrameSource] No pending request for requestId:', requestId);
				}
			} catch (e) {
				// Parse error, ignore
			}
		});

		// Set up stderr listener
		this.command.stderr.addListener('data', (line: string) => {
			console.error('[mac-frames]', line);
		});

		// Spawn the process and store the child reference
		this.child = await this.command.spawn();
		this.spawning = false;

		// Register PID with Rust backend so it survives frontend reloads
		if (this.child.pid) {
			invoke('register_sidecar_pid', { pid: this.child.pid, tag: 'mac-frames' }).catch((e) =>
				console.warn('[TauriFrameSource] Failed to register PID:', e)
			);
		}
	}

	async extract(
		time: number,
		videoPath: string,
		roi?: { x: number; y: number; width: number; height: number }
	): Promise<FrameData> {
		await this.spawnProcess();

		const requestId = ++this.requestIdCounter;
		const request: any = {
			type: 'extract',
			videoPath,
			time,
			requestId
		};
		if (roi) request.roi = roi;

		// Write to the persistent process's stdin
		await this.child!.write(JSON.stringify(request) + '\n');

		// Return a promise that resolves when we get the response (with timeout)
		return new Promise<FrameData>((resolve, reject) => {
			const timeout = setTimeout(() => {
				console.error('[TauriFrameSource] Timeout waiting for frame response:', requestId);
				this.pendingRequests.delete(requestId);
				reject(new Error(`Timeout waiting for frame ${requestId} after 30 seconds`));
			}, 30000); // 30 second timeout
			this.pendingRequests.set(requestId, {
				resolve: (data) => {
					clearTimeout(timeout);
					resolve(data);
				},
				reject: (err) => {
					clearTimeout(timeout);
					reject(err);
				}
			});
		});
	}

	async getDuration(videoPath: string): Promise<number> {
		await this.spawnProcess();

		const requestId = ++this.requestIdCounter;
		const request = {
			type: 'getDuration',
			videoPath,
			requestId
		};

		await this.child!.write(JSON.stringify(request) + '\n');

		return new Promise<number>((resolve, reject) => {
			const timeout = setTimeout(() => {
				console.error('[TauriFrameSource] Timeout waiting for duration response:', requestId);
				this.pendingRequests.delete(requestId);
				reject(new Error(`Timeout waiting for duration after 30 seconds`));
			}, 30000);
			this.pendingRequests.set(requestId, {
				resolve: (data) => {
					clearTimeout(timeout);
					resolve(data);
				},
				reject: (err) => {
					clearTimeout(timeout);
					reject(err);
				}
			});
		});
	}

	async kill() {
		if (this.child) {
			await this.child.kill();
			this.child = null;
			this.command = null;
			this.spawning = false;
		}
		this.pendingRequests.clear();
	}
}

// Tauri OCREngine: spawns mac-ocr binary ONCE and reuses it
class TauriOCREngine implements OCREngine {
	private command: Command<string> | null = null;
	private child: Child | null = null;
	private requestIdCounter = 0;
	private pendingRequests = new Map<
		number,
		{ resolve: (data: any) => void; reject: (error: Error) => void }
	>();
	private spawning = false;

	async spawnProcess() {
		if (this.child || this.spawning) return;
		this.spawning = true;

		// Kill any orphaned mac-ocr processes tracked on the Rust side
		// Tag-based kill ensures we don't kill the frame source's process
		try {
			await invoke('kill_sidecars_by_tag', { tag: 'mac-ocr' });
		} catch (e) {
			console.warn('[TauriOCREngine] Failed to kill orphaned processes:', e);
		}

		this.command = Command.sidecar('binaries/mac-ocr', []);

		this.command.stdout.addListener('data', (line: string) => {
			try {
				const response = JSON.parse(line) as any;
				const requestId = response.requestId as number | undefined;
				if (requestId === undefined) return;
				const pending = this.pendingRequests.get(requestId);

				if (pending) {
					if (response.type === 'text') {
						pending.resolve(response.text);
					} else if (response.type === 'languages') {
						pending.resolve(response);
					} else if (response.type === 'error') {
						console.error(
							'[TauriOCREngine] Error response for request:',
							requestId,
							response.message
						);
						pending.reject(new Error(response.message || 'Unknown error'));
					}
					this.pendingRequests.delete(requestId);
				} else {
					console.warn('[TauriOCREngine] No pending request for requestId:', requestId);
				}
			} catch (e) {
				// Parse error, ignore
			}
		});

		this.command.stderr.addListener('data', (line: string) => {
			console.error('[mac-ocr]', line);
		});

		this.child = await this.command.spawn();
		this.spawning = false;

		// Register PID with Rust backend so it survives frontend reloads
		if (this.child.pid) {
			invoke('register_sidecar_pid', { pid: this.child.pid, tag: 'mac-ocr' }).catch((e) =>
				console.warn('[TauriOCREngine] Failed to register PID:', e)
			);
		}
	}

	async recognize(
		image: string,
		language?: string,
		recognitionLevel?: 'fast' | 'accurate',
		roi?: { x: number; y: number; width: number; height: number }
	): Promise<string> {
		await this.spawnProcess();

		const requestId = ++this.requestIdCounter;
		const request: any = {
			type: 'recognize',
			image,
			requestId
		};
		if (language) request.language = language;
		if (recognitionLevel) request.recognitionLevel = recognitionLevel;
		if (roi) request.roi = roi;

		await this.child!.write(JSON.stringify(request) + '\n');

		return new Promise<string>((resolve, reject) => {
			const timeout = setTimeout(() => {
				console.error('[TauriOCREngine] Timeout waiting for OCR response:', requestId);
				this.pendingRequests.delete(requestId);
				reject(new Error(`Timeout waiting for OCR ${requestId} after 30 seconds`));
			}, 30000);
			this.pendingRequests.set(requestId, {
				resolve: (data) => {
					clearTimeout(timeout);
					resolve(data);
				},
				reject: (err) => {
					clearTimeout(timeout);
					reject(err);
				}
			});
		});
	}

	async getSupportedLanguages(
		recognitionLevel?: 'fast' | 'accurate'
	): Promise<SupportedLanguage[]> {
		await this.spawnProcess();

		const requestId = ++this.requestIdCounter;
		const request: any = {
			type: 'getLanguages',
			requestId
		};
		if (recognitionLevel) request.recognitionLevel = recognitionLevel;

		await this.child!.write(JSON.stringify(request) + '\n');

		return new Promise<SupportedLanguage[]>((resolve, reject) => {
			const timeout = setTimeout(() => {
				console.error('[TauriOCREngine] Timeout waiting for languages response:', requestId);
				this.pendingRequests.delete(requestId);
				reject(new Error(`Timeout waiting for languages ${requestId} after 30 seconds`));
			}, 30000);
			this.pendingRequests.set(requestId, {
				resolve: (data: any) => {
					clearTimeout(timeout);
					// data is the languages response with { type: 'languages', requestId, languages: string[], recognitionLevel? }
					const languages: string[] = data.languages || [];
					resolve(languages.map((code) => ({ code })));
				},
				reject: (err) => {
					clearTimeout(timeout);
					reject(err);
				}
			});
		});
	}

	async kill() {
		if (this.child) {
			await this.child.kill();
			this.child = null;
			this.command = null;
			this.spawning = false;
		}
		this.pendingRequests.clear();
	}
}

// Helper to convert ROI string to object
function parseRoi(
	roi?: string
): { x: number; y: number; width: number; height: number } | undefined {
	if (!roi) return undefined;
	const parts = roi.trim().split(/\s+/);
	if (parts.length === 4) {
		return {
			x: parseFloat(parts[0]),
			y: parseFloat(parts[1]),
			width: parseFloat(parts[2]),
			height: parseFloat(parts[3])
		};
	}
	return undefined;
}

// Global storage for process instances that survives hot reloads
// Use a Symbol to avoid collisions with other libraries
const MAC_CLI_GLOBAL_KEY = Symbol.for('mac-cli-processes');

function getGlobalStorage() {
	if (typeof globalThis !== 'undefined') {
		const g = globalThis as {
			[key: symbol]: { frameSource: TauriFrameSource | null; ocrEngine: TauriOCREngine | null };
		};
		if (!g[MAC_CLI_GLOBAL_KEY]) {
			g[MAC_CLI_GLOBAL_KEY] = {
				frameSource: null as TauriFrameSource | null,
				ocrEngine: null as TauriOCREngine | null
			};
		}
		return g[MAC_CLI_GLOBAL_KEY];
	}
	return { frameSource: null, ocrEngine: null };
}

// Singleton instances - stored globally to survive hot reloads
const globalStorage = getGlobalStorage();
let frameSource: TauriFrameSource | null = globalStorage.frameSource;
let ocrEngine: TauriOCREngine | null = globalStorage.ocrEngine;

// Cleanup function to kill sidecar processes
// Call this on app unload or before reloading to prevent orphaned processes
export async function cleanupMacCliProcesses() {
	// Always kill via Rust-side PID tracking first (works even if JS refs are lost)
	try {
		await invoke('kill_all_sidecars');
	} catch (e) {
		console.warn('[mac-cli] Failed to kill Rust-tracked processes:', e);
	}

	// Kill existing frame source process via JS refs
	if (globalStorage.frameSource) {
		try {
			await globalStorage.frameSource.kill();
			console.log('[mac-cli] Killed existing frame source process');
		} catch (e) {
			console.warn('[mac-cli] Failed to kill frame source process:', e);
		}
		globalStorage.frameSource = null;
		frameSource = null;
	}

	// Kill existing OCR engine process via JS refs
	if (globalStorage.ocrEngine) {
		try {
			await globalStorage.ocrEngine.kill();
			console.log('[mac-cli] Killed existing OCR engine process');
		} catch (e) {
			console.warn('[mac-cli] Failed to kill OCR engine process:', e);
		}
		globalStorage.ocrEngine = null;
		ocrEngine = null;
	}
}

// Fire-and-forget cleanup on window beforeunload.
// Browsers do NOT await async handlers, so we use invoke() without await.
// The Rust-side PID tracking ensures processes are killed even if JS refs are lost.
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		console.log('[mac-cli] Cleaning up sidecar processes on page unload...');
		invoke('kill_all_sidecars');
	});
}

export const macCliBackend: Backend = {
	capabilities:
		Capability.OPTION_INTERVAL |
		Capability.REGION_OF_INTEREST |
		Capability.LANGUAGE_SELECTION |
		Capability.RECOGNITION_LEVEL |
		Capability.RECOGNITION_LEVEL_PER_LANGUAGE |
		Capability.FORWARD_FACTOR |
		Capability.START_END_TIME,

	roiFormat: () => '{leftRel} {bottomRel} {widthRel} {heightRel}',

	getSupportedLanguages: async () => {
		// Initialize or reuse the OCR engine
		if (!ocrEngine) {
			ocrEngine = new TauriOCREngine();
			globalStorage.ocrEngine = ocrEngine;
		}
		return await ocrEngine.getSupportedLanguages();
	},
	getSupportedLanguagesForLevel: async (level: 'fast' | 'accurate') => {
		// Initialize or reuse the OCR engine
		if (!ocrEngine) {
			ocrEngine = new TauriOCREngine();
			globalStorage.ocrEngine = ocrEngine;
		}
		return await ocrEngine.getSupportedLanguages(level);
	},

	extract: async (options: MacCliOptions): Promise<MacCliResult> => {
		const {
			filePath,
			outputPath,
			language,
			intervalMs,
			roi,
			recognitionLevel,
			onProgress,
			substitutions,
			forwardFactor,
			startTimeMs,
			endTimeMs
		} = options;

		try {
			// Initialize singleton sources (one process each, reused for all requests)
			// Use global storage to persist across hot reloads
			// On hot-reload, the module-level init (frameSource = globalStorage.frameSource)
			// already restores old instances, so processes are reused across extractions.
			if (!frameSource) {
				frameSource = new TauriFrameSource();
				globalStorage.frameSource = frameSource;
				console.log('[mac-cli] Created new frame source, stored globally');
			}
			if (!ocrEngine) {
				ocrEngine = new TauriOCREngine();
				globalStorage.ocrEngine = ocrEngine;
				console.log('[mac-cli] Created new OCR engine, stored globally');
			}

			// Get duration
			const duration = await frameSource.getDuration(filePath);

			// Create config and scheduler
			const config: ProcessingConfig = {
				interval: intervalMs ? intervalMs / 1000 : 1.0,
				forwardFactor: forwardFactor || 1,
				videoPath: filePath,
				language,
				roi: parseRoi(roi),
				recognitionLevel
			};

			const normalizer = new TextNormalizer(substitutions || []);

			const startTime = startTimeMs ? startTimeMs / 1000 : 0.1;
			const endTime = endTimeMs ? endTimeMs / 1000 : duration;
			const totalFrames = Math.ceil((endTime - startTime) / config.interval);

			const subtitles: Subtitle[] = [];
			let framesProcessed = 0;

			// Initial progress update
			if (onProgress)
				onProgress({
					progressFraction: 0,
					percentComplete: 0,
					framesProcessed: 0,
					totalFrames
				});

			// Manually iterate through frames to ensure progress updates for each frame
			// even when they don't produce text
			let currentTime = startTime;
			let index = 1;
			let cachedLookahead: { time: number; text: string } | null = null;

			while (currentTime < endTime) {
				// Report progress for this frame position
				framesProcessed = Math.floor((currentTime - startTime) / config.interval);
				const progressFraction = Math.min(framesProcessed / totalFrames, 1);

				// Extract frame (with ROI cropping)
				const frame = await frameSource.extract(currentTime, filePath, config.roi);

				// OCR - Don't pass ROI again since the frame is already cropped
				const recognizedText = await ocrEngine.recognize(
					frame.image,
					config.language,
					config.recognitionLevel
				);

				const normalizedText = normalizer.normalize(recognizedText);

				// Forward-factor lookahead (same logic as FrameScheduler)
				let frameAdvance = config.interval;

				if (config.forwardFactor > 1 && normalizedText) {
					const lookaheadTime = currentTime + config.interval * config.forwardFactor;
					if (lookaheadTime < endTime) {
						const lookaheadFrame = await frameSource.extract(lookaheadTime, filePath, config.roi);
						const lookaheadTextRaw = await ocrEngine.recognize(
							lookaheadFrame.image,
							config.language,
							config.recognitionLevel
						);
						const lookaheadText = normalizer.normalize(lookaheadTextRaw);

						if (normalizedText === lookaheadText) {
							frameAdvance = config.interval * (config.forwardFactor + 1);
						} else {
							cachedLookahead = { time: lookaheadTime, text: lookaheadText };
						}
					}
				}

				// Use cached lookahead if available for current time
				let finalText = normalizedText;
				if (cachedLookahead?.time === currentTime) {
					finalText = cachedLookahead.text;
					cachedLookahead = null;
				}

				// Create subtitle if there's text
				if (finalText) {
					subtitles.push({
						index: index++,
						startTime: currentTime,
						endTime: Math.min(currentTime + frameAdvance, endTime),
						text: finalText
					});
				}

				// Update progress after processing this frame
				if (onProgress)
					onProgress({
						progressFraction: progressFraction,
						percentComplete: Math.floor(progressFraction * 100),
						framesProcessed: framesProcessed + 1,
						totalFrames
					});

				currentTime += frameAdvance;
			}

			const merged = SRTGenerator.mergeSubtitles(subtitles);
			const srt = SRTGenerator.generateSRT(merged);
			await fs.writeTextFile(outputPath, srt);

			return { stdout: `Wrote ${merged.length} subtitles`, stderr: '', code: 0 };
		} catch (error) {
			return {
				stdout: '',
				stderr: error instanceof Error ? error.message : String(error),
				code: 1
			};
		}
	}
};

export default macCliBackend;

// =============================================================================
// Test/Debug Utilities
// =============================================================================

/**
 * Extract a single frame at a specific time for debugging/inspection.
 * This is useful to verify ROI cropping is working correctly.
 *
 * @param filePath - Path to the video file
 * @param time - Time in seconds to extract the frame from
 * @param roi - Optional region of interest (x, y, width, height in relative coords)
 * @param outputPath - Optional path to save the frame as a JPEG file (e.g., '/tmp/frame.jpg')
 *                   If not provided, returns base64 string you can decode online
 * @returns Promise with the frame data (base64-encoded JPEG and time)
 */
export async function extractTestFrame(
	filePath: string,
	time: number,
	roi?: { x: number; y: number; width: number; height: number },
	outputPath?: string
): Promise<{ image: string; time: number }> {
	// Initialize or reuse the frame source
	if (!globalStorage.frameSource) {
		globalStorage.frameSource = new TauriFrameSource();
		frameSource = globalStorage.frameSource;
	}

	// Extract the frame
	const frame = await globalStorage.frameSource.extract(time, filePath, roi);

	// Optionally save the base64 image data to a file
	if (outputPath) {
		// The image is base64-encoded JPEG data
		// We can save it directly as a .jpg file since base64 is just text
		await fs.writeTextFile(outputPath, frame.image);
		console.log(`[mac-cli] Test frame saved to: ${outputPath}`);
		console.log(`[mac-cli] You can open this file directly in an image viewer`);
	}

	return frame;
}

/**
 * Test OCR on a base64-encoded image.
 * Useful for debugging OCR.
 *
 * @param imageBase64 - Base64-encoded image data
 * @param language - Optional language for OCR
 * @param recognitionLevel - 'fast' or 'accurate'
 * @returns The recognized text
 */
export async function testOCR(
	imageBase64: string,
	language?: string,
	recognitionLevel?: 'fast' | 'accurate'
): Promise<string> {
	// Initialize or reuse the OCR engine
	if (!globalStorage.ocrEngine) {
		globalStorage.ocrEngine = new TauriOCREngine();
		ocrEngine = globalStorage.ocrEngine;
	}

	return await globalStorage.ocrEngine.recognize(imageBase64, language, recognitionLevel);
}

/**
 * Get supported languages from the OCR engine.
 * Useful for debugging language support.
 *
 * @param recognitionLevel - Optional recognition level ('fast' or 'accurate')
 * @returns Array of supported language codes
 */
export async function testGetSupportedLanguages(
	recognitionLevel?: 'fast' | 'accurate'
): Promise<SupportedLanguage[]> {
	// Initialize or reuse the OCR engine
	if (!globalStorage.ocrEngine) {
		globalStorage.ocrEngine = new TauriOCREngine();
		ocrEngine = globalStorage.ocrEngine;
	}

	return await globalStorage.ocrEngine.getSupportedLanguages(recognitionLevel);
}
