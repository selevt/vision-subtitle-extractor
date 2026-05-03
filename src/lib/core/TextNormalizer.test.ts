import { describe, it, expect } from 'vitest';
import { TextNormalizer } from './TextNormalizer';

describe('TextNormalizer', () => {
	it('should handle empty text', () => {
		const normalizer = new TextNormalizer([]);
		expect(normalizer.normalize('')).toBe('');
		expect(normalizer.normalize('   ')).toBe('   ');
	});

	it('should handle null/undefined text', () => {
		const normalizer = new TextNormalizer([]);
		expect(normalizer.normalize(null as any)).toBe('');
		expect(normalizer.normalize(undefined as any)).toBe('');
	});

	it('should apply single substitution', () => {
		const normalizer = new TextNormalizer([{ regex: 'Hello', replacement: 'Hi' }]);
		expect(normalizer.normalize('Hello world')).toBe('Hi world');
	});

	it('should apply multiple substitutions in order', () => {
		const normalizer = new TextNormalizer([
			{ regex: 'foo', replacement: 'bar' },
			{ regex: 'bar', replacement: 'baz' }
		]);
		expect(normalizer.normalize('foo')).toBe('baz');
	});

	it('should apply regex patterns', () => {
		const normalizer = new TextNormalizer([{ regex: '\\d+', replacement: 'NUM' }]);
		expect(normalizer.normalize('There are 123 apples')).toBe('There are NUM apples');
	});

	it('should apply global regex replacements', () => {
		const normalizer = new TextNormalizer([{ regex: 'a', replacement: 'b' }]);
		expect(normalizer.normalize('aaa')).toBe('bbb');
	});

	it('should handle multiple substitution patterns', () => {
		const normalizer = new TextNormalizer([
			{ regex: '\\d+', replacement: 'NUM' },
			{ regex: '\\s+', replacement: ' ' }
		]);
		expect(normalizer.normalize('There  are  123  apples')).toBe('There are NUM apples');
	});

	it('should handle special regex characters', () => {
		const normalizer = new TextNormalizer([{ regex: '\\.', replacement: '' }]);
		expect(normalizer.normalize('file.txt')).toBe('filetxt');
	});

	it('should handle case-sensitive replacements', () => {
		const normalizer = new TextNormalizer([{ regex: 'Hello', replacement: 'Hi' }]);
		expect(normalizer.normalize('hello world')).toBe('hello world');
		expect(normalizer.normalize('Hello world')).toBe('Hi world');
	});

	it('should handle empty substitution list', () => {
		const normalizer = new TextNormalizer([]);
		expect(normalizer.normalize('any text')).toBe('any text');
	});

	it('should handle complex regex patterns', () => {
		const normalizer = new TextNormalizer([{ regex: '\\b\\w{4}\\b', replacement: '****' }]);
		expect(normalizer.normalize('This is a test')).toBe('**** is a ****');
	});

	it('should handle substitution with capture groups', () => {
		const normalizer = new TextNormalizer([{ regex: '(\\w+)\\s+(\\w+)', replacement: '$2 $1' }]);
		expect(normalizer.normalize('Hello World')).toBe('World Hello');
	});

	it('should handle multiple consecutive substitutions', () => {
		const normalizer = new TextNormalizer([
			{ regex: 'a', replacement: 'b' },
			{ regex: 'b', replacement: 'c' }
		]);
		expect(normalizer.normalize('a a a')).toBe('c c c');
	});
});
