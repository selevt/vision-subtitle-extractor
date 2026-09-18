import type { Component } from 'svelte';

export interface VideoFile {
	filePath: string;
	fileName: string;
}

export interface FileSource {
	id: string;
	label: string;
	/** Check if this source is available (e.g., yt-dlp on PATH) */
	isAvailable: () => Promise<boolean>;
	/** Svelte component that renders the acquisition UI */
	component: Component<any>;
}
