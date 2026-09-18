<script lang="ts">
	import type { VideoFile } from '$lib/file-source';
	import { downloadYouTubeVideo, type DownloadProgress } from '$lib/sources/youtube';

	interface Props {
		onAcquired: (file: VideoFile) => void;
	}

	let { onAcquired }: Props = $props();

	let url = $state('');
	let isDownloading = $state(false);
	let progressFraction = $state(0);
	let status = $state('');
	let error = $state('');

	async function handleDownload() {
		if (!url.trim()) {
			error = 'Please enter a YouTube URL';
			return;
		}

		isDownloading = true;
		progressFraction = 0;
		status = 'Starting download...';
		error = '';

		try {
			const file = await downloadYouTubeVideo(url, (p: DownloadProgress) => {
				progressFraction = p.progressFraction;
				status = p.status;
			});
			onAcquired(file);
			url = '';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			isDownloading = false;
		}
	}
</script>

<div class="youtube-source">
	<div class="url-row">
		<input
			bind:value={url}
			placeholder="https://www.youtube.com/watch?v=..."
			disabled={isDownloading}
			onkeydown={(e) => e.key === 'Enter' && !isDownloading && handleDownload()}
		/>
		<button type="button" onclick={handleDownload} disabled={isDownloading}>
			{isDownloading ? 'Downloading...' : 'Download'}
		</button>
	</div>

	{#if isDownloading || progressFraction > 0}
		<div class="progress-section">
			<div class="progress-bar-outer">
				<div class="progress-bar-inner" style="width: {Math.round(progressFraction * 100)}%"></div>
			</div>
			<div class="progress-info">
				<span>{status}</span>
				<span>{Math.round(progressFraction * 100)}%</span>
			</div>
		</div>
	{/if}

	{#if error}
		<p class="error-text">{error}</p>
	{/if}
</div>

<style>
	.youtube-source {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.url-row {
		display: flex;
		gap: 8px;
	}

	.url-row input {
		flex: 1;
	}

	.url-row input:disabled {
		opacity: 0.5;
	}

	.url-row button {
		white-space: nowrap;
	}

	.progress-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.progress-bar-outer {
		width: 90%;
		max-width: 400px;
		height: 18px;
		background: #e0e0e0;
		border-radius: 10px;
		overflow: hidden;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
	}

	.progress-bar-inner {
		height: 100%;
		background: linear-gradient(90deg, #396cd8 0%, #24c8db 100%);
		border-radius: 10px 0 0 10px;
		transition: width 0.3s cubic-bezier(0.4, 1.3, 0.6, 1);
	}

	.progress-info {
		display: flex;
		gap: 1.5em;
		font-size: 1em;
		color: #444;
	}

	.error-text {
		color: #d32f2f;
		font-size: 0.9em;
		margin: 0;
	}

	@media (prefers-color-scheme: dark) {
		.progress-bar-outer {
			background: #222;
		}

		.progress-bar-inner {
			background: linear-gradient(90deg, #24c8db 0%, #396cd8 100%);
		}

		.progress-info {
			color: #ccc;
		}

		.error-text {
			color: #f0706a;
		}
	}
</style>
