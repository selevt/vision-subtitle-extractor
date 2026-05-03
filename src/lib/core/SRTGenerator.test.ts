import { describe, it, expect } from 'vitest';
import { SRTGenerator } from './SRTGenerator';
import type { Subtitle } from './types';

describe('SRTGenerator', () => {
	describe('formatSRTTime', () => {
		it('should format zero seconds', () => {
			expect(SRTGenerator.formatSRTTime(0)).toBe('00:00:00,000');
		});

		it('should format less than one second', () => {
			expect(SRTGenerator.formatSRTTime(0.5)).toBe('00:00:00,500');
			expect(SRTGenerator.formatSRTTime(0.001)).toBe('00:00:00,001');
		});

		it('should format exactly one second', () => {
			expect(SRTGenerator.formatSRTTime(1)).toBe('00:00:01,000');
		});

		it('should format 59 seconds', () => {
			expect(SRTGenerator.formatSRTTime(59)).toBe('00:00:59,000');
		});

		it('should format one minute', () => {
			expect(SRTGenerator.formatSRTTime(60)).toBe('00:01:00,000');
		});

		it('should format 59 minutes and 59 seconds', () => {
			expect(SRTGenerator.formatSRTTime(60 * 59 + 59)).toBe('00:59:59,000');
		});

		it('should format one hour', () => {
			expect(SRTGenerator.formatSRTTime(3600)).toBe('01:00:00,000');
		});

		it('should format multiple hours', () => {
			expect(SRTGenerator.formatSRTTime(3600 * 2 + 30 * 60 + 15)).toBe('02:30:15,000');
		});

		it('should format with milliseconds', () => {
			expect(SRTGenerator.formatSRTTime(1.234)).toBe('00:00:01,234');
			expect(SRTGenerator.formatSRTTime(61.999)).toBe('00:01:01,999');
		});

		it('should round milliseconds', () => {
			expect(SRTGenerator.formatSRTTime(0.0005)).toBe('00:00:00,001');
			expect(SRTGenerator.formatSRTTime(0.0014)).toBe('00:00:00,001');
			expect(SRTGenerator.formatSRTTime(0.0015)).toBe('00:00:00,002');
		});

		it('should handle large time values', () => {
			expect(SRTGenerator.formatSRTTime(999999)).toBe('277:46:39,000');
		});
	});

	describe('mergeSubtitles', () => {
		it('should return empty array for empty input', () => {
			expect(SRTGenerator.mergeSubtitles([])).toEqual([]);
		});

		it('should return single subtitle unchanged', () => {
			const subtitles: Subtitle[] = [{ index: 1, startTime: 0, endTime: 1, text: 'Hello' }];
			expect(SRTGenerator.mergeSubtitles(subtitles)).toEqual(subtitles);
		});

		it('should merge consecutive identical texts', () => {
			const subtitles: Subtitle[] = [
				{ index: 1, startTime: 0, endTime: 1, text: 'Hello' },
				{ index: 2, startTime: 1, endTime: 2, text: 'Hello' },
				{ index: 3, startTime: 2, endTime: 3, text: 'Hello' }
			];
			const merged = SRTGenerator.mergeSubtitles(subtitles);
			expect(merged).toHaveLength(1);
			expect(merged[0].text).toBe('Hello');
			expect(merged[0].startTime).toBe(0);
			expect(merged[0].endTime).toBe(3);
		});

		it('should merge when next text starts with current text', () => {
			const subtitles: Subtitle[] = [
				{ index: 1, startTime: 0, endTime: 1, text: 'Hello' },
				{ index: 2, startTime: 1, endTime: 2, text: 'Hello world' }
			];
			const merged = SRTGenerator.mergeSubtitles(subtitles);
			expect(merged).toHaveLength(1);
			expect(merged[0].text).toBe('Hello world');
		});

		it('should use longer text when merging', () => {
			const subtitles: Subtitle[] = [
				{ index: 1, startTime: 0, endTime: 1, text: 'Hello world' },
				{ index: 2, startTime: 1, endTime: 2, text: 'Hello' }
			];
			const merged = SRTGenerator.mergeSubtitles(subtitles);
			expect(merged).toHaveLength(1);
			expect(merged[0].text).toBe('Hello world');
		});

		it('should not merge different texts', () => {
			const subtitles: Subtitle[] = [
				{ index: 1, startTime: 0, endTime: 1, text: 'Hello' },
				{ index: 2, startTime: 1, endTime: 2, text: 'World' }
			];
			const merged = SRTGenerator.mergeSubtitles(subtitles);
			expect(merged).toHaveLength(2);
		});

		it('should handle mixed mergeable and non-mergeable subtitles', () => {
			const subtitles: Subtitle[] = [
				{ index: 1, startTime: 0, endTime: 1, text: 'Hello' },
				{ index: 2, startTime: 1, endTime: 2, text: 'Hello' },
				{ index: 3, startTime: 2, endTime: 3, text: 'World' },
				{ index: 4, startTime: 3, endTime: 4, text: 'World' }
			];
			const merged = SRTGenerator.mergeSubtitles(subtitles);
			expect(merged).toHaveLength(2);
			expect(merged[0].text).toBe('Hello');
			expect(merged[0].endTime).toBe(2);
			expect(merged[1].text).toBe('World');
			expect(merged[1].endTime).toBe(4);
		});

		it('should preserve index ordering after merge', () => {
			const subtitles: Subtitle[] = [
				{ index: 1, startTime: 0, endTime: 1, text: 'A' },
				{ index: 2, startTime: 1, endTime: 2, text: 'A' },
				{ index: 3, startTime: 2, endTime: 3, text: 'B' }
			];
			const merged = SRTGenerator.mergeSubtitles(subtitles);
			expect(merged[0].index).toBe(1);
			expect(merged[1].index).toBe(2);
		});
	});

	describe('generateSRT', () => {
		it('should generate SRT for empty subtitles', () => {
			expect(SRTGenerator.generateSRT([])).toBe('');
		});

		it('should generate SRT for single subtitle', () => {
			const subtitles: Subtitle[] = [{ index: 1, startTime: 0, endTime: 1, text: 'Hello' }];
			const srt = SRTGenerator.generateSRT(subtitles);
			expect(srt).toContain('1');
			expect(srt).toContain('00:00:00,000 --> 00:00:00,990');
			expect(srt).toContain('Hello');
		});

		it('should generate SRT for multiple subtitles', () => {
			const subtitles: Subtitle[] = [
				{ index: 1, startTime: 0, endTime: 1, text: 'First' },
				{ index: 2, startTime: 1, endTime: 2, text: 'Second' }
			];
			const srt = SRTGenerator.generateSRT(subtitles);
			expect(srt).toContain('1');
			expect(srt).toContain('2');
			expect(srt).toContain('First');
			expect(srt).toContain('Second');
		});

		it('should adjust last subtitle end time', () => {
			const subtitles: Subtitle[] = [{ index: 1, startTime: 0, endTime: 10, text: 'Only one' }];
			const srt = SRTGenerator.generateSRT(subtitles);
			expect(srt).toContain('00:00:00,000 --> 00:00:09,990');
		});

		it('should ensure last subtitle has minimum duration', () => {
			const subtitles: Subtitle[] = [{ index: 1, startTime: 0, endTime: 0.05, text: 'Very short' }];
			const srt = SRTGenerator.generateSRT(subtitles);
			expect(srt).toContain('00:00:00,000 --> 00:00:00,100');
		});

		it('should format SRT correctly with proper line breaks', () => {
			const subtitles: Subtitle[] = [
				{ index: 1, startTime: 0, endTime: 1, text: 'Line 1' },
				{ index: 2, startTime: 1, endTime: 2, text: 'Line 2' }
			];
			const srt = SRTGenerator.generateSRT(subtitles);
			const lines = srt.split('\n');
			expect(lines).toHaveLength(9);
			expect(lines[0]).toBe('1');
			expect(lines[1]).toContain('-->');
			expect(lines[2]).toBe('Line 1');
			expect(lines[3]).toBe('');
			expect(lines[4]).toBe('2');
			expect(lines[5]).toContain('-->');
			expect(lines[6]).toBe('Line 2');
			expect(lines[7]).toBe('');
			expect(lines[8]).toBe('');
		});
	});
});
