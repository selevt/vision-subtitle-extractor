import type { FileSource } from '../file-source';
import { localFileSource } from './local-file';
import { youtubeSource } from './youtube-source';

export const allSources: FileSource[] = [localFileSource, youtubeSource];

export async function getAvailableSources(): Promise<FileSource[]> {
	const available = await Promise.all(
		allSources.map(async (s) => ({
			source: s,
			available: await s.isAvailable()
		}))
	);
	return available.filter((a) => a.available).map((a) => a.source);
}
