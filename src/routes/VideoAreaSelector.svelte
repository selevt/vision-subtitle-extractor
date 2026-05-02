<script lang="ts">
	import 'video-area-selection/css';
	import { onMount } from 'svelte';
	import {
		VideoAreaSelector,
		type VideoAreaSelectionData,
		type VideoAreaSelection
	} from 'video-area-selection';
	import { applyTemplate } from 'video-area-selection/format';
	import VideoTimelineControls from './VideoTimelineControls.svelte';

	interface SelectionData {
		selectionData: VideoAreaSelectionData;
		formatted?: string;
	}
	let {
		video,
		template,
		onChange: onChangeCallback,
		initialSelection,
		canRoi,
		startTimeMs,
		endTimeMs,
		onStartTimeChange,
		onEndTimeChange
	}: {
		video: string;
		template?: string;
		onChange: (data: SelectionData | undefined) => void;
		initialSelection?: SelectionData;
		canRoi?: boolean;
		startTimeMs: number | undefined;
		endTimeMs: number | undefined;
		onStartTimeChange?: (value: number | undefined) => void;
		onEndTimeChange?: (value: number | undefined) => void;
	} = $props();

	let videoElement: HTMLVideoElement;
	let selectorInstance = $state<VideoAreaSelector | null>(null);

	let enabled = $state(false);

	let selection = $state<SelectionData | undefined>(initialSelection);
	let videoDuration = $state(0);

	// Handle selection changes from the selector
	function handleSelectorChange(selectionData: VideoAreaSelectionData) {
		selection = {
			formatted: template ? applyTemplate(template, selectionData) : undefined,
			selectionData
		};
		onChangeCallback(selection);
	}

	const setEnabled = (value: boolean) => {
		enabled = value;
		if (value && selectorInstance) {
			selectorInstance.enable();
		} else if (selectorInstance) {
			selectorInstance.disable();
		}
	};

	function setStartToCurrentTime() {
		if (videoElement && onStartTimeChange) {
			onStartTimeChange(videoElement.currentTime * 1000);
		}
	}

	function setEndToCurrentTime() {
		if (videoElement && onEndTimeChange) {
			onEndTimeChange(videoElement.currentTime * 1000);
		}
	}

	function clearTimes() {
		if (onStartTimeChange) onStartTimeChange(undefined);
		if (onEndTimeChange) onEndTimeChange(undefined);
	}

	function handleStartInput(event: Event) {
		const value = parseFloat((event.target as HTMLInputElement).value);
		if (onStartTimeChange) {
			onStartTimeChange(isNaN(value) ? undefined : value * 1000);
		}
	}

	function handleEndInput(event: Event) {
		const value = parseFloat((event.target as HTMLInputElement).value);
		if (onEndTimeChange) {
			onEndTimeChange(isNaN(value) ? undefined : value * 1000);
		}
	}

	const resetSelection = () => {
		selection = undefined;
		onChangeCallback(undefined);
		if (selectorInstance) {
			selectorInstance.clearSelection();
		}
	};

	// Validate and reset times that exceed video duration
	$effect(() => {
		if (videoDuration > 0 && videoDuration !== Infinity) {
			const maxTimeMs = videoDuration * 1000;
			if (startTimeMs !== undefined && startTimeMs > maxTimeMs && onStartTimeChange) {
				onStartTimeChange(undefined);
			}
			if (endTimeMs !== undefined && endTimeMs > maxTimeMs && onEndTimeChange) {
				onEndTimeChange(undefined);
			}
		}
	});

	// Create selector in onMount (component only mounts when filePath is set)
	onMount(() => {
		if (videoElement) {
			selectorInstance = new VideoAreaSelector({
				videoElement: videoElement,
				onChange: handleSelectorChange
			});

			// Set initial selection if available
			const initialSelectionData = initialSelection?.selectionData?.absolute;
			if (initialSelectionData) {
				selectorInstance.ready().then(() => {
					if (selectorInstance) {
						selectorInstance.setSelection(initialSelectionData as VideoAreaSelection);
					}
				});
			}

			// Set up duration tracking
			const updateDuration = () => {
				if (videoElement.duration && !isNaN(videoElement.duration)) {
					videoDuration = videoElement.duration;
				}
			};

			videoElement.addEventListener('loadedmetadata', updateDuration);
			videoElement.addEventListener('durationchange', updateDuration);
			updateDuration();
		}

		return () => {
			if (selectorInstance) {
				selectorInstance.disable();
				selectorInstance.destroy();
				selectorInstance = null;
			}
		};
	});
</script>

<div>
	<div class="video-container">
		<!-- svelte-ignore a11y_media_has_caption -->
		<video bind:this={videoElement} controls={!enabled} src={video}></video>
	</div>

	{#if selectorInstance}
		<VideoTimelineControls
			selector={selectorInstance}
			{startTimeMs}
			{endTimeMs}
			duration={videoDuration}
		/>

		<div class="time-controls">
			<label>
				Start (s):
				<input
					type="number"
					inputmode="decimal"
					step="0.1"
					min="0"
					value={startTimeMs !== undefined ? (startTimeMs / 1000).toFixed(2) : ''}
					oninput={handleStartInput}
					style="width: 70px;"
				/>
			</label>
			<label style="margin-left: 8px;">
				End (s):
				<input
					type="number"
					inputmode="decimal"
					step="0.1"
					min="0"
					value={endTimeMs !== undefined ? (endTimeMs / 1000).toFixed(2) : ''}
					oninput={handleEndInput}
					style="width: 70px;"
				/>
			</label>
			<button
				type="button"
				class="btn"
				onclick={setStartToCurrentTime}
				title="Set start to current time"
			>
				Set Start
			</button>
			<button
				type="button"
				class="btn"
				onclick={setEndToCurrentTime}
				title="Set end to current time"
			>
				Set End
			</button>
			<button type="button" class="btn" onclick={clearTimes} title="Clear times"> Clear </button>
		</div>
	{/if}

	{#if canRoi}
		<div class="roi-controls">
			<label for="roi-input"
				>Region of interest <span
					title="Play video to find frame with subtitles, enable selection, drag on video, switch back to view mode to confirm it covers all subtitles"
					>ℹ️</span
				>:</label
			>
			<span id="roi-input">{selection?.formatted ?? ''}</span>
			{#if enabled}
				<button class="btn" onclick={() => setEnabled(false)}>Disable selection</button>
			{:else}
				<button class="btn" onclick={() => setEnabled(true)}>Enable selection</button>
			{/if}
			<button type="button" class="btn" onclick={() => resetSelection()}>Reset</button>
		</div>
	{/if}
</div>

<style>
	.video-container {
		max-width: 100%;
	}
	video {
		max-width: 100%;
		border: 1px solid #ccc;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
	.roi-controls {
		margin-top: 8px;
	}
	.time-controls {
		margin-top: 8px;
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.time-controls label {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.time-controls input {
		padding: 4px 6px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 14px;
	}
	.btn {
		padding: 6px 12px;
		background: #f0f0f0;
		color: #333;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}
	.btn:hover {
		background: #e0e0e0;
	}
	.btn:active {
		background: #d0d0d0;
	}
	@media (prefers-color-scheme: dark) {
		video {
			border-color: #555;
		}
		.time-controls input {
			background: #333;
			border-color: #555;
			color: #eee;
		}
		.btn {
			background: #444;
			color: #eee;
			border-color: #666;
		}
		.btn:hover {
			background: #555;
		}
		.btn:active {
			background: #444;
		}
		.roi-controls button {
			background: #444;
			color: #eee;
			border-color: #666;
		}
	}
</style>
