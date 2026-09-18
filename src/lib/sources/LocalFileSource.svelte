<script lang="ts">
	import { open } from '@tauri-apps/plugin-dialog';
	import type { VideoFile } from '$lib/file-source';

	interface Props {
		fileName?: string;
		isDragging?: boolean;
		onAcquired: (file: VideoFile) => void;
	}

	let { fileName = '', isDragging = false, onAcquired }: Props = $props();

	async function handleFileSelect() {
		const selected = await open({
			multiple: false,
			filters: [
				{
					name: 'Video',
					extensions: ['mp4', 'mov', 'avi', 'm4v', 'mkv']
				}
			]
		});

		if (selected) {
			filePath = selected as string;
			const parts = filePath.split('/');
			onAcquired({ filePath, fileName: parts[parts.length - 1] });
		}
	}

	let filePath = '';
</script>

<div class="file-drop-area {isDragging ? 'dragging' : ''}">
	<button
		type="button"
		class="file-input-container"
		onclick={handleFileSelect}
		onkeydown={(e) => e.key === 'Enter' && handleFileSelect()}
	>
		<span class="file-input-label">
			{fileName ? fileName : 'Click to choose a video file or drag and drop'}
		</span>
	</button>
</div>

<style>
	.file-drop-area {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem;
		border-radius: 8px;
		border: 2px dashed #ccc;
		transition: all 0.3s ease;
		background-color: #ffffff;
		box-shadow: 0 2px 2px rgba(0, 0, 0, 0.1);
		box-sizing: border-box;
	}

	.file-drop-area.dragging {
		border-color: #396cd8;
		background-color: rgba(57, 108, 216, 0.05);
	}

	.file-input-container {
		position: relative;
		text-align: center;
		cursor: pointer;
		padding: 1rem;
		border-radius: 8px;
		background-color: rgba(0, 0, 0, 0.03);
		transition: all 0.2s ease;
		width: 100%;
		overflow: hidden;
	}

	.file-input-container:hover {
		background-color: rgba(57, 108, 216, 0.1);
	}

	.file-input-label {
		display: block;
		font-size: 1em;
		color: #666;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-height: 1.5rem;
		width: 100%;
	}

	.file-input-label::before {
		content: '📁 ';
		margin-right: 0.5rem;
	}

	@media (prefers-color-scheme: dark) {
		.file-drop-area {
			background-color: #1a1a1a;
			border-color: #444;
		}

		.file-drop-area.dragging {
			border-color: #24c8db;
			background-color: rgba(36, 200, 219, 0.1);
		}

		.file-input-container {
			background-color: rgba(255, 255, 255, 0.05);
		}

		.file-input-container:hover {
			background-color: rgba(36, 200, 219, 0.15);
		}

		.file-input-label {
			color: #aaa;
		}
	}
</style>
