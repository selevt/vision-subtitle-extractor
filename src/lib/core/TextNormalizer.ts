export class TextNormalizer {
	private compiledPatterns: Array<{ pattern: RegExp; replacement: string }>;

	constructor(substitutions: Array<{ regex: string; replacement: string }>) {
		this.compiledPatterns = substitutions.map((s) => ({
			pattern: new RegExp(s.regex, 'g'),
			replacement: s.replacement
		}));
	}

	normalize(text: string): string {
		if (!text) return '';
		return this.compiledPatterns.reduce(
			(acc, { pattern, replacement }) => acc.replace(pattern, replacement),
			text
		);
	}
}
