import type { FileSource } from '../file-source';
import LocalFileSource from './LocalFileSource.svelte';

export const localFileSource: FileSource = {
	id: 'local',
	label: 'Local file',
	isAvailable: async () => true,
	component: LocalFileSource
};
