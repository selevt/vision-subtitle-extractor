import { describe, it, expect } from 'vitest';
import { parseArgs } from './config';

describe('parseArgs', () => {
	it('should parse video path', () => {
		const args = ['--video', '/path/to/video.mp4'];
		const config = parseArgs(args);
		expect(config.videoPath).toBe('/path/to/video.mp4');
	});

	it('should parse videoPath alias', () => {
		const args = ['--videoPath', '/path/to/video.mp4'];
		const config = parseArgs(args);
		expect(config.videoPath).toBe('/path/to/video.mp4');
	});

	it('should parse output path', () => {
		const args = ['--output', '/path/to/output.srt'];
		const config = parseArgs(args);
		expect(config.outputPath).toBe('/path/to/output.srt');
	});

	it('should parse outputPath alias', () => {
		const args = ['--outputPath', '/path/to/output.srt'];
		const config = parseArgs(args);
		expect(config.outputPath).toBe('/path/to/output.srt');
	});

	it('should use default output path', () => {
		const args: string[] = [];
		const config = parseArgs(args);
		expect(config.outputPath).toBe('output.srt');
	});

	it('should parse interval', () => {
		const args = ['--interval', '2.5'];
		const config = parseArgs(args);
		expect(config.interval).toBe(2.5);
	});

	it('should use default interval', () => {
		const args: string[] = [];
		const config = parseArgs(args);
		expect(config.interval).toBe(1.0);
	});

	it('should parse forwardFactor', () => {
		const args = ['--forwardFactor', '3'];
		const config = parseArgs(args);
		expect(config.forwardFactor).toBe(3);
	});

	it('should use default forwardFactor', () => {
		const args: string[] = [];
		const config = parseArgs(args);
		expect(config.forwardFactor).toBe(1);
	});

	it('should parse platform', () => {
		const args = ['--platform', 'mac'];
		const config = parseArgs(args);
		expect(config.platform).toBe('mac');
	});

	it('should use default platform', () => {
		const args: string[] = [];
		const config = parseArgs(args);
		expect(config.platform).toBe('auto');
	});

	it('should parse jsonOutput flag', () => {
		const args = ['--jsonOutput', 'true'];
		const config = parseArgs(args);
		expect(config.jsonOutput).toBe(true);
	});

	it('should parse jsonOutput as boolean true', () => {
		const args = ['--jsonOutput'];
		const config = parseArgs(args);
		expect(config.jsonOutput).toBe(true);
	});

	it('should use default jsonOutput', () => {
		const args: string[] = [];
		const config = parseArgs(args);
		expect(config.jsonOutput).toBe(false);
	});

	it('should parse language', () => {
		const args = ['--language', 'en'];
		const config = parseArgs(args);
		expect(config.language).toBe('en');
	});

	it('should parse startTimeMs', () => {
		const args = ['--startTimeMs', '1000'];
		const config = parseArgs(args);
		expect(config.startTimeMs).toBe(1000);
	});

	it('should parse endTimeMs', () => {
		const args = ['--endTimeMs', '5000'];
		const config = parseArgs(args);
		expect(config.endTimeMs).toBe(5000);
	});

	it('should parse substitutions as JSON', () => {
		const substitutions = JSON.stringify([
			{ regex: 'Hello', replacement: 'Hi' },
			{ regex: '\\d+', replacement: 'NUM' }
		]);
		const args = ['--substitutions', substitutions];
		const config = parseArgs(args);
		expect(config.substitutions).toHaveLength(2);
		expect(config.substitutions[0].regex).toBe('Hello');
		expect(config.substitutions[0].replacement).toBe('Hi');
		expect(config.substitutions[1].regex).toBe('\\d+');
		expect(config.substitutions[1].replacement).toBe('NUM');
	});

	it('should handle empty substitutions', () => {
		const args: string[] = [];
		const config = parseArgs(args);
		expect(config.substitutions).toEqual([]);
	});

	it('should handle invalid substitutions JSON', () => {
		const args = ['--substitutions', 'invalid json'];
		const config = parseArgs(args);
		expect(config.substitutions).toEqual([]);
	});

	it('should parse multiple arguments', () => {
		const args = [
			'--video',
			'/path/to/video.mp4',
			'--output',
			'/path/to/output.srt',
			'--interval',
			'2',
			'--forwardFactor',
			'2',
			'--platform',
			'mac',
			'--jsonOutput',
			'true',
			'--language',
			'en'
		];
		const config = parseArgs(args);
		expect(config.videoPath).toBe('/path/to/video.mp4');
		expect(config.outputPath).toBe('/path/to/output.srt');
		expect(config.interval).toBe(2);
		expect(config.forwardFactor).toBe(2);
		expect(config.platform).toBe('mac');
		expect(config.jsonOutput).toBe(true);
		expect(config.language).toBe('en');
	});

	it('should handle win platform', () => {
		const args = ['--platform', 'win'];
		const config = parseArgs(args);
		expect(config.platform).toBe('win');
	});

	it('should handle numeric values as strings', () => {
		const args = ['--interval', '1.5', '--forwardFactor', '2'];
		const config = parseArgs(args);
		expect(config.interval).toBe(1.5);
		expect(config.forwardFactor).toBe(2);
	});
});
