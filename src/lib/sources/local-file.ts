import type { FileSource } from '../file-source';
import LocalFileSource from '../../routes/sources/LocalFileSource.svelte';

export const localFileSource: FileSource = {
	id: 'local',
	label: 'Local file',
	isAvailable: async () => true,
	component: LocalFileSource
};
