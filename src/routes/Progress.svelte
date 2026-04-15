<script lang="ts">
	export let progress: number;
	export let framesProcessed: number;
	export let totalFrames: number;
	export let elapsedMs: number;

	function formatElapsed(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		return `${hours.toString().padStart(2, '0')}:${minutes
			.toString()
			.padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
</script>

<div class="progress-section">
	<div class="progress-bar-outer">
		<div class="progress-bar-inner" style="width: {Math.round(progress * 100)}%"></div>
	</div>
	<div class="progress-info">
		<span>Frames processed: {framesProcessed} {totalFrames > 0 ? `/ ${totalFrames}` : ''}</span>
		<span>Elapsed: {formatElapsed(elapsedMs)}</span>
		<span>{Math.round(progress * 100)}%</span>
	</div>
</div>

<style>
	.progress-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 1.5em 0 1em 0;
	}
	.progress-bar-outer {
		width: 90%;
		max-width: 400px;
		height: 18px;
		background: #e0e0e0;
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 0.5em;
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
		justify-content: center;
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
	}
</style>
