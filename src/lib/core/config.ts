import type { Config } from './types';

export function parseArgs(argv: string[]): Config {
	const args = new Map<string, string | boolean>();

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith('--')) {
			const key = arg.slice(2);
			const nextArg = argv[i + 1];
			if (nextArg && !nextArg.startsWith('--')) {
				args.set(key, nextArg);
				i++;
			} else {
				args.set(key, true);
			}
		}
	}

	const getArg = (key: string, defaultValue?: string): string | undefined => {
		const value = args.get(key);
		return value === undefined ? defaultValue : String(value);
	};

	const getBooleanArg = (key: string, defaultValue: boolean = false): boolean => {
		const value = args.get(key);
		return value === undefined ? defaultValue : value === true || value === 'true';
	};

	const getNumberArg = (key: string, defaultValue: number): number => {
		const value = getArg(key);
		return value === undefined ? defaultValue : parseFloat(value);
	};

	const videoPath = getArg('video') || getArg('videoPath', '') || '';
	const outputPath = getArg('output') || getArg('outputPath', 'output.srt') || 'output.srt';
	const interval = getNumberArg('interval', 1.0);
	const forwardFactor = getNumberArg('forwardFactor', 1);
	const jsonOutput = getBooleanArg('jsonOutput', false);
	const platform = getArg('platform', 'auto') as 'auto' | 'mac' | 'win';

	const substitutionsStr = getArg('substitutions', '');
	const substitutions: Array<{ regex: string; replacement: string }> = [];

	if (substitutionsStr) {
		try {
			const parsed = JSON.parse(substitutionsStr);
			if (Array.isArray(parsed)) {
				for (const sub of parsed) {
					if (sub.regex && sub.replacement) {
						substitutions.push({ regex: sub.regex, replacement: sub.replacement });
					}
				}
			}
		} catch (e) {
			console.warn('Failed to parse substitutions:', e);
		}
	}

	const startTimeArg = getArg('startTimeMs');
	const startTimeMs = startTimeArg ? parseFloat(startTimeArg) : undefined;
	const endTimeArg = getArg('endTimeMs');
	const endTimeMs = endTimeArg ? parseFloat(endTimeArg) : undefined;

	return {
		videoPath,
		outputPath,
		interval,
		forwardFactor,
		substitutions,
		language: getArg('language'),
		roi: undefined,
		startTimeMs,
		endTimeMs,
		platform,
		jsonOutput
	};
}
