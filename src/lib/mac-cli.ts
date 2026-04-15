import { Command } from '@tauri-apps/plugin-shell';
import {
	type ExtractOptions,
	type ExtractResult,
	type Backend,
	type SupportedLanguage,
	Capability
} from './backend-common';

interface MacCliOptions extends ExtractOptions {}
interface MacCliResult extends ExtractResult {}

export const macCliBackend: Backend = {
	capabilities:
		Capability.OPTION_INTERVAL | Capability.REGION_OF_INTEREST | Capability.LANGUAGE_SELECTION | Capability.RECOGNITION_LEVEL | Capability.RECOGNITION_LEVEL_PER_LANGUAGE,

	roiFormat: () => '{leftRel} {bottomRel} {widthRel} {heightRel}',

	getSupportedLanguages: async (): Promise<SupportedLanguage[]> => {
		console.log('Getting supported languages from mac-cli');
		const command = Command.sidecar('binaries/vision-subtitle-extractor-mac', [
			'--list-languages',
			'--json'
		]);
		const result = await command.execute();
		if (result.code !== 0) {
			console.error('mac-cli --list-languages failed:', result.stderr);
			throw new Error(`mac-cli --list-languages failed with code ${result.code}`);
		}

		const lines = result.stdout.trim().split('\n');
		for (const line of lines) {
			try {
				const jsonData = JSON.parse(line);
				if (jsonData.type === 'languages' && Array.isArray(jsonData.supportedLanguages)) {
					const languages: SupportedLanguage[] = jsonData.supportedLanguages.map(
						(code: string) => ({
							code
						})
					);
					return languages;
				}
			} catch (e) {
				console.warn('Failed to parse language JSON:', line);
			}
		}

		throw new Error('No supported languages found in mac-cli output');
	},

	getSupportedLanguagesForLevel: async (level: 'fast' | 'accurate'): Promise<SupportedLanguage[]> => {
		console.log(`Getting supported languages for ${level} recognition from mac-cli`);
		const command = Command.sidecar('binaries/vision-subtitle-extractor-mac', [
			'--list-languages',
			'--json',
			'--recognition-level',
			level
		]);
		const result = await command.execute();
		if (result.code !== 0) {
			console.error(`mac-cli --list-languages --recognition-level ${level} failed:`, result.stderr);
			throw new Error(`mac-cli --list-languages --recognition-level ${level} failed with code ${result.code}`);
		}

		const lines = result.stdout.trim().split('\n');
		for (const line of lines) {
			try {
				const jsonData = JSON.parse(line);
				if (jsonData.type === 'languages' && Array.isArray(jsonData.supportedLanguages)) {
					const languages: SupportedLanguage[] = jsonData.supportedLanguages.map(
						(code: string) => ({
							code
						})
					);
					return languages;
				}
			} catch (e) {
				console.warn('Failed to parse language JSON:', line);
			}
		}

		throw new Error(`No supported languages found in mac-cli output for ${level} recognition`);
	},

	extract: async (options: MacCliOptions): Promise<MacCliResult> => {
		const { filePath, outputPath, intervalMs, roi, language, recognitionLevel, onProgress, substitutions } = options;
		const args: string[] = [filePath, '--json', '--output', outputPath];
		if (intervalMs) {
			// ms to seconds
			args.push('--interval', String(intervalMs / 1000));
		}
		if (roi) {
			args.push('--roi');
			args.push(...roi.split(' '));
		}
		if (language) {
			args.push('--language', language);
		}
		if (recognitionLevel) {
			args.push('--recognition-level', recognitionLevel);
		}
		if (substitutions) {
			for (const sub of substitutions) {
				args.push('--substitution', JSON.stringify(sub));
			}
		}
		console.log('Executing mac-cli with args:', args.join(' '));
		const command = Command.sidecar('binaries/vision-subtitle-extractor-mac', args);
		let stdout = '';
		let stderr = '';
		command.stdout.addListener('data', (line) => {
			console.log(`[mac-cli] ${line}`);
			stdout += line + '\n';

			// Try to parse JSON output and check for progress updates
			if (onProgress) {
				try {
					const jsonData = JSON.parse(line);
					if (jsonData.type === 'progress') {
						onProgress(jsonData);
					}
				} catch (e) {
					// fallback: if not JSON, ignore
				}
			}
		});
		command.stderr.addListener('data', (line) => {
			console.error(`[mac-cli] ${line}`);
			stderr += line + '\n';
		});

		return new Promise<MacCliResult>((resolve, reject) => {
			command.on('close', (data) => {
				console.log('mac-cli process closed:', data);
				resolve({
					stdout: stdout,
					stderr: stderr,
					code: data.code
				});
			});
			command.on('error', (err) => {
				console.error('mac-cli process error:', err);
				reject(err);
			});
			command
				.spawn()
				.then((child) => {
					console.log('mac-cli process spawned:', child);
				})
				.catch((err) => {
					console.error('Failed to spawn mac-cli process:', err);
					reject(err);
				});
		});
	}
};

export default macCliBackend;
