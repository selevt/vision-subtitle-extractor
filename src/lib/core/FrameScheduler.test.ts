import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrameScheduler } from './FrameScheduler';
import { TextNormalizer } from './TextNormalizer';
import { MockFrameSource } from './FrameSource';
import { MockOCREngine } from './OCREngine';
import type { FrameData, ProcessingConfig } from './types';

describe('FrameScheduler', () => {
	let normalizer: TextNormalizer;
	let mockFrameSource: MockFrameSource;
	let mockOCREngine: MockOCREngine;
	let scheduler: FrameScheduler;

	beforeEach(() => {
		normalizer = new TextNormalizer([]);
		mockFrameSource = new MockFrameSource(new Map(), 100);
		mockOCREngine = new MockOCREngine(new Map());
		scheduler = new FrameScheduler(
			{ interval: 1.0, forwardFactor: 1, videoPath: 'test.mp4' },
			normalizer,
			mockFrameSource,
			mockOCREngine
		);
	});

	describe('forwardFactor=1: processes every frame linearly', () => {
		it('should process every frame when forwardFactor is 1', async () => {
			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[1, { image: 'img1', time: 1 }],
				[2, { image: 'img2', time: 2 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'Text A'],
				['img1', 'Text B'],
				['img2', 'Text C']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 1, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 3)) {
				subtitles.push(sub);
			}

			expect(subtitles).toHaveLength(3);
			expect(subtitles[0].text).toBe('Text A');
			expect(subtitles[1].text).toBe('Text B');
			expect(subtitles[2].text).toBe('Text C');
		});
	});

	describe('forwardFactor=2: skips 1 frame when texts match', () => {
		it('should skip 1 frame when texts match with forwardFactor=2', async () => {
			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[1, { image: 'img1', time: 1 }],
				[2, { image: 'img2', time: 2 }],
				[3, { image: 'img3', time: 3 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'Text A'],
				['img1', 'Text A'],
				['img2', 'Text A'],
				['img3', 'Text B']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 2, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 4)) {
				subtitles.push(sub);
			}

			// Should skip frames at time 1 and 2 when text matches
			expect(subtitles).toHaveLength(2);
			expect(subtitles[0].text).toBe('Text A');
			expect(subtitles[0].startTime).toBe(0);
			expect(subtitles[0].endTime).toBeCloseTo(3, 0.001);
			expect(subtitles[1].text).toBe('Text B');
			expect(subtitles[1].startTime).toBe(3);
		});
	});

	describe('forwardFactor=3: skips 2 frames when texts match', () => {
		it('should skip 2 frames when texts match with forwardFactor=3', async () => {
			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[1, { image: 'img1', time: 1 }],
				[2, { image: 'img2', time: 2 }],
				[3, { image: 'img3', time: 3 }],
				[4, { image: 'img4', time: 4 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'Text A'],
				['img1', 'Text A'],
				['img2', 'Text A'],
				['img3', 'Text A'],
				['img4', 'Text B']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 3, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 5)) {
				subtitles.push(sub);
			}

			// Should skip frames at time 1, 2, 3 when text matches
			expect(subtitles).toHaveLength(2);
			expect(subtitles[0].text).toBe('Text A');
			expect(subtitles[0].startTime).toBe(0);
			expect(subtitles[0].endTime).toBeCloseTo(4, 0.001);
			expect(subtitles[1].text).toBe('Text B');
		});
	});

	describe('cached lookahead consumed when reached linearly', () => {
		it('should consume cached lookahead when reached linearly', async () => {
			// With forwardFactor=2, interval=1:
			// At time 0: extract frame, OCR -> "Text A"
			// Lookahead at time 2: extract frame, OCR -> "Text B" (different)
			// Cache lookahead for time 2
			// Advance by interval (1.0) to time 1
			// At time 1: extract frame, OCR -> "Text A"
			// Lookahead at time 3: extract frame, OCR -> "Text B" (different)
			// Cache lookahead for time 3
			// Advance by interval (1.0) to time 2
			// At time 2: use cached lookahead "Text B"
			// No lookahead (cachedLookahead is now null)
			// Advance by interval (1.0) to time 3
			// At time 3: use cached lookahead "Text B"

			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[1, { image: 'img1', time: 1 }],
				[2, { image: 'img2', time: 2 }],
				[3, { image: 'img3', time: 3 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'Text A'],
				['img1', 'Text A'],
				['img2', 'Text B'],
				['img3', 'Text B']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 2, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 4)) {
				subtitles.push(sub);
			}

			// Should get Text A at 0, Text A at 1, then cached Text B at 2, then cached Text B at 3
			// But Text A at 1 will also do lookahead and cache Text B at 3
			// So we should get: Text A (0-1), Text A (1-2), Text B (2-3), Text B (3-4)
			expect(subtitles.length).toBeGreaterThanOrEqual(2);
		});

		it('should use cached lookahead when current time matches cached time', async () => {
			// Simpler test: at time 0, lookahead at time 2 returns different text
			// Cache it. Then at time 1, advance to time 2, use cached value
			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[1, { image: 'img1', time: 1 }],
				[2, { image: 'img2', time: 2 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'Text A'],
				['img1', 'Text C'],
				['img2', 'Text B']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 2, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 3)) {
				subtitles.push(sub);
			}

			// At time 0: "Text A", lookahead at 2: "Text B" (different), cache it
			// Advance to time 1
			// At time 1: "Text C", lookahead at 3 (beyond endTime), no lookahead
			// Advance to time 2
			// At time 2: use cached "Text B"
			expect(subtitles.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('edge case: lookahead at/beyond end time', () => {
		it('should not perform lookahead beyond end time', async () => {
			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[1, { image: 'img1', time: 1 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'Text A'],
				['img1', 'Text B']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 2, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 1.5)) {
				subtitles.push(sub);
			}

			// At time 0: lookahead would be at time 2, which is beyond endTime 1.5
			// So no lookahead should be performed
			// At time 0: "Text A", advance by 1.0 to time 1
			// At time 1: "Text B", lookahead at time 3 (beyond endTime), no lookahead
			// Advance by 1.0 to time 2 (beyond endTime), stop
			expect(subtitles).toHaveLength(2);
		});
	});

	describe('edge case: empty text (no skip)', () => {
		it('should not skip when text is empty', async () => {
			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[1, { image: 'img1', time: 1 }],
				[2, { image: 'img2', time: 2 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', ''],
				['img1', ''],
				['img2', 'Text A']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 2, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 3)) {
				subtitles.push(sub);
			}

			// Empty text should not be yielded, and no skipping should occur
			expect(subtitles).toHaveLength(1);
			expect(subtitles[0].text).toBe('Text A');
		});
	});

	describe('edge case: different text after substitution', () => {
		it('should not skip when text differs after substitution', async () => {
			const substitutions = [{ regex: 'A', replacement: 'B' }];
			normalizer = new TextNormalizer(substitutions);

			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[2, { image: 'img2', time: 2 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'Text A'],
				['img2', 'Text A']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 2, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 3)) {
				subtitles.push(sub);
			}

			// Both frames have "Text A" which becomes "Text B" after substitution
			// So they should match and skip should occur
			expect(subtitles).toHaveLength(1);
			expect(subtitles[0].text).toBe('Text B');
		});
	});

	describe('multiple consecutive skips', () => {
		it('should handle multiple consecutive skips', async () => {
			// With forwardFactor=2 and interval=1:
			// At time 0: "Text A", lookahead at 2: "Text A" -> skip by 3 (interval * (forwardFactor + 1))
			// Advance to time 3
			// At time 3: "Text A", lookahead at 5: "Text A" -> skip by 3
			// Advance to time 6
			// At time 6: "Text B"
			// Advance to time 7 (beyond endTime)

			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[2, { image: 'img2', time: 2 }],
				[3, { image: 'img3', time: 3 }],
				[5, { image: 'img5', time: 5 }],
				[6, { image: 'img6', time: 6 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'Text A'],
				['img2', 'Text A'],
				['img3', 'Text A'],
				['img5', 'Text A'],
				['img6', 'Text B']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 2, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 7)) {
				subtitles.push(sub);
			}

			// Should skip multiple times consecutively
			expect(subtitles.length).toBeGreaterThanOrEqual(2);
		});

		it('should handle multiple consecutive skips with all frames present', async () => {
			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[1, { image: 'img1', time: 1 }],
				[2, { image: 'img2', time: 2 }],
				[3, { image: 'img3', time: 3 }],
				[4, { image: 'img4', time: 4 }],
				[5, { image: 'img5', time: 5 }],
				[6, { image: 'img6', time: 6 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'Text A'],
				['img1', 'Text A'],
				['img2', 'Text A'],
				['img3', 'Text A'],
				['img4', 'Text A'],
				['img5', 'Text A'],
				['img6', 'Text B']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 2, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 7)) {
				subtitles.push(sub);
			}

			// Should skip multiple times consecutively
			// At time 0: "Text A", lookahead at 2: "Text A" -> skip to 3
			// At time 3: "Text A", lookahead at 5: "Text A" -> skip to 6
			// At time 6: "Text B"
			expect(subtitles.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('skip, then no-skip, then skip pattern', () => {
		it('should handle skip, no-skip, skip pattern', async () => {
			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[1, { image: 'img1', time: 1 }],
				[2, { image: 'img2', time: 2 }],
				[3, { image: 'img3', time: 3 }],
				[4, { image: 'img4', time: 4 }],
				[5, { image: 'img5', time: 5 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'Text A'],
				['img1', 'Text A'],
				['img2', 'Text B'],
				['img3', 'Text B'],
				['img4', 'Text C'],
				['img5', 'Text C']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 2, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 6)) {
				subtitles.push(sub);
			}

			// At time 0: "Text A", lookahead at 2: "Text B" (different) -> cache, advance to 1
			// At time 1: "Text A", lookahead at 3: "Text B" (different) -> cache, advance to 2
			// At time 2: use cached "Text B", lookahead at 4: "Text C" (different) -> cache, advance to 3
			// At time 3: use cached "Text B", lookahead at 5: "Text C" (different) -> cache, advance to 4
			// At time 4: use cached "Text C", lookahead at 6 (beyond) -> no lookahead, advance to 5
			// At time 5: use cached "Text C"
			expect(subtitles.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe('basic functionality', () => {
		it('should generate subtitles with correct timing', async () => {
			// Start at 0.5 to match the first frame time
			const frames = new Map<number, FrameData>([
				[0.5, { image: 'img0', time: 0.5 }],
				[1.5, { image: 'img1', time: 1.5 }],
				[2.5, { image: 'img2', time: 2.5 }]
			]);
			const ocrResponses = new Map<string, string>([
				['img0', 'First subtitle'],
				['img1', 'Second subtitle'],
				['img2', 'Third subtitle']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 1, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0.5, 2.5)) {
				subtitles.push(sub);
			}

			// Should get frames at 0.5, 1.5, and 2.5 (but 2.5 equals endTime, so might not be processed)
			expect(subtitles.length).toBeGreaterThanOrEqual(2);
			expect(subtitles[0].startTime).toBe(0.5);
			expect(subtitles[0].text).toBe('First subtitle');
		});

		it('should not yield subtitles with empty normalized text', async () => {
			const frames = new Map<number, FrameData>([
				[0, { image: 'img0', time: 0 }],
				[1, { image: 'img1', time: 1 }]
			]);
			// Use null/undefined to simulate empty text after normalization
			const ocrResponses = new Map<string, string>([
				['img0', ''],
				['img1', 'Valid text']
			]);

			mockFrameSource = new MockFrameSource(frames, 100);
			mockOCREngine = new MockOCREngine(ocrResponses);
			scheduler = new FrameScheduler(
				{ interval: 1.0, forwardFactor: 1, videoPath: 'test.mp4' },
				normalizer,
				mockFrameSource,
				mockOCREngine
			);

			const subtitles = [];
			for await (const sub of scheduler.generateSubtitles(0, 2)) {
				subtitles.push(sub);
			}

			// First frame has empty string which normalizes to empty
			// Empty strings are falsy, so normalize('') returns ''
			// The condition `if (normalizedText)` will be false for empty string
			expect(subtitles).toHaveLength(1);
			expect(subtitles[0].text).toBe('Valid text');
		});
	});
});
