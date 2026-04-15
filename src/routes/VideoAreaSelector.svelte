<script lang="ts">
	import 'video-area-selection/css';
	import { VideoAreaSelector } from 'video-area-selection';
	import { applyTemplate } from 'video-area-selection/format';
	import { untrack } from 'svelte';
	interface SelectionData {
		selectionData: any;
		formatted?: string;
	}
	let {
		video,
		template,
		onChange: onChangeCallback,
		initialSelection,
		canRoi
	}: {
		video: string;
		template?: string;
		onChange: (data: SelectionData | undefined) => void;
		initialSelection?: SelectionData;
		canRoi?: boolean;
	} = $props();

	let videoElement: HTMLVideoElement;
	let selector: VideoAreaSelector;

	let enabled = $state(false);

	let selection = $state<SelectionData | undefined>(initialSelection);

	const setEnabled = (value: boolean) => {
		enabled = value;
		if (value) {
			selector.enable();
		} else {
			selector.disable();
		}
	};

	const updateSelection = (selectionData: SelectionData | undefined) => {
		selection = selectionData;
		onChangeCallback(selectionData);
	};
	const resetSelection = () => {
		updateSelection(undefined);
		selector.clearSelection();
	};

	$effect(() => {
		selector = new VideoAreaSelector({
			videoElement: videoElement,
			onChange: (selectionData) => {
				updateSelection({
					formatted: template ? applyTemplate(template, selectionData) : undefined,
					selectionData
				});
			}
		});
		const initialSelectionData = untrack(() => selection?.selectionData?.absolute);
		if (initialSelectionData) {
			(async () => {
				await selector.ready();
				selector.setSelection(initialSelectionData);
			})();
		}
	});
</script>

<div>
	<div class="video-container">
		<video bind:this={videoElement} controls={!enabled} src={video}></video>
	</div>
	{#if canRoi}
		<label for="roi-input"
			>Region of interest <span
				title="Play video to find frame with subtitles, enable selection, drag on video, switch back to view mode to confirm it covers all subtitles"
				>ℹ️</span
			>:</label
		>
		<span id="roi-input">{selection?.formatted ?? ''}</span>
		{#if enabled}
			<button onclick={() => setEnabled(false)}>Disable selection mode</button>
		{:else}
			<button onclick={() => setEnabled(true)}>Enable selection mode</button>
		{/if}
		<button type="button" style="margin-left: 8px;" onclick={() => resetSelection()}>Reset</button>
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
</style>
