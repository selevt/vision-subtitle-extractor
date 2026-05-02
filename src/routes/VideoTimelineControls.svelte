<script lang="ts">
	import type { VideoAreaSelector } from 'video-area-selection';

	let {
		selector,
		startTimeMs,
		endTimeMs,
		duration
	}: {
		selector: VideoAreaSelector | null;
		startTimeMs: number | undefined;
		endTimeMs: number | undefined;
		duration: number;
	} = $props();

	let currentTime = $state(0);
	let timelineScrubber = $state<HTMLDivElement>();

	// Time update unsubscribe function
	let unsubscribeTimeUpdate: (() => void) | null = null;

	// Helper to safely calculate percentage position
	function safePosition(timeSec: number | undefined, duration: number): number {
		if (timeSec === undefined || duration <= 0 || !Number.isFinite(duration)) return -1;
		const pct = (timeSec / duration) * 100;
		return Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : -1;
	}

	// Calculate marker positions as percentages
	const startPosition = $derived(
		safePosition(startTimeMs !== undefined ? startTimeMs / 1000 : undefined, duration)
	);
	const endPosition = $derived(
		safePosition(endTimeMs !== undefined ? endTimeMs / 1000 : undefined, duration)
	);
	const playheadPosition = $derived(safePosition(currentTime, duration));
	const rangeLeft = $derived(
		startTimeMs !== undefined && endTimeMs !== undefined
			? safePosition(startTimeMs / 1000, duration)
			: -1
	);
	const rangeWidth = $derived(
		startTimeMs !== undefined &&
			endTimeMs !== undefined &&
			duration > 0 &&
			Number.isFinite(duration)
			? Math.min(100, Math.max(0, ((endTimeMs - startTimeMs) / 1000 / duration) * 100))
			: 0
	);

	// Set up timeline time update subscription
	$effect(() => {
		if (selector && timelineScrubber) {
			// Subscribe to time updates
			if (!unsubscribeTimeUpdate) {
				unsubscribeTimeUpdate = selector.onTimeUpdate((time: number) => {
					currentTime = time;
				});
			}
		}

		// Cleanup on unmount
		return () => {
			if (unsubscribeTimeUpdate) {
				unsubscribeTimeUpdate();
				unsubscribeTimeUpdate = null;
			}
		};
	});

	function handleScrubberClick(event: MouseEvent) {
		if (!selector || !timelineScrubber || duration <= 0) return;

		const rect = timelineScrubber.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const percentage = clickX / rect.width;
		const newTime = percentage * duration;

		selector.setCurrentTime(newTime);
	}

	function handleMarkerClick(time: number) {
		if (selector) {
			selector.setCurrentTime(time);
		}
	}
</script>

{#if selector}
	<div class="timeline-controls">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			bind:this={timelineScrubber}
			class="timeline-scrubber"
			onclick={handleScrubberClick}
			role="slider"
			tabindex="0"
			aria-label="Video timeline - click to scrub"
			aria-valuemin="0"
			aria-valuemax={duration}
			aria-valuenow={currentTime}
		>
			<div class="timeline-background"></div>

			{#if playheadPosition >= 0}
				<div
					class="timeline-playhead"
					style="left: {Math.min(100, Math.max(0, playheadPosition))}%"
				></div>
			{/if}

			{#if startPosition >= 0 && endPosition >= 0 && rangeWidth > 0}
				<div
					class="timeline-selected-range"
					style="left: {Math.min(100, Math.max(0, rangeLeft))}%; width: {Math.min(
						100,
						Math.max(0, rangeWidth)
					)}%"
				></div>
			{/if}

			{#if startPosition >= 0}
				<button
					class="time-marker time-marker-start"
					style="left: {Math.min(100, Math.max(0, startPosition))}%"
					onclick={() => handleMarkerClick(startTimeMs! / 1000)}
					aria-label="Start time marker"
					type="button"
				></button>
			{/if}

			{#if endPosition >= 0}
				<button
					class="time-marker time-marker-end"
					style="left: {Math.min(100, Math.max(0, endPosition))}%"
					onclick={() => handleMarkerClick(endTimeMs! / 1000)}
					aria-label="End time marker"
					type="button"
				></button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.timeline-controls {
		width: 100%;
		margin-top: 8px;
		position: relative;
	}
	.timeline-scrubber {
		height: 20px;
		width: 100%;
		position: relative;
		cursor: pointer;
		background: var(--timeline-bg, rgba(0, 0, 0, 0.1));
		border-radius: 4px;
		overflow: visible;
		outline: none;
	}
	.timeline-scrubber:focus {
		outline: 2px solid #2196f3;
		outline-offset: 2px;
	}
	.timeline-background {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(to right, var(--tick-color, #ddd), var(--tick-color, #ddd));
		background-size: 10px 1px;
		background-repeat: repeat-x;
	}
	.timeline-playhead {
		position: absolute;
		top: 0;
		width: 2px;
		height: 100%;
		background: #2196f3;
		transform: translateX(-50%);
		z-index: 10;
		cursor: pointer;
	}
	.timeline-selected-range {
		position: absolute;
		top: 0;
		height: 100%;
		background: rgba(76, 175, 80, 0.3);
		pointer-events: none;
		z-index: 5;
		border-radius: 2px;
	}
	.time-marker {
		position: absolute;
		top: 0;
		width: 2px;
		height: 100%;
		transform: translateX(-50%);
		z-index: 8;
		cursor: pointer;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
	}
	.time-marker:hover {
		width: 4px;
		z-index: 9;
	}
	.time-marker:focus {
		outline: none;
	}
	.time-marker-start {
		background: #4caf50;
	}
	.time-marker-start:hover {
		background: #66bb6a;
	}
	.time-marker-end {
		background: #f44336;
	}
	.time-marker-end:hover {
		background: #ef5350;
	}
	@media (prefers-color-scheme: dark) {
		.timeline-scrubber {
			background: var(--timeline-bg, rgba(255, 255, 255, 0.05));
		}
		.timeline-background {
			--tick-color: #555;
		}
	}
</style>
