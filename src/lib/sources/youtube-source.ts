import type { FileSource } from '../file-source';
import YouTubeSource from '../../routes/sources/YouTubeSource.svelte';
import { isYtDlpAvailable } from './youtube';

export const youtubeSource: FileSource = {
	id: 'youtube',
	label: 'YouTube (yt-dlp)',
	isAvailable: isYtDlpAvailable,
	component: YouTubeSource
};
