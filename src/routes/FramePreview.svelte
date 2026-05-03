<script lang="ts">
	import { extractTestFrame, testOCR } from '$lib/mac-cli';
	import { hasCapability, Capability, type Backend } from '$lib/backend-common';
	import macBackend from '$lib/mac-cli';

	interface Props {
		videoPath: string;
		backend?: Backend;
		roi?: string | { x: number; y: number; width: number; height: number };
		language?: string;
		recognitionLevel?: 'fast' | 'accurate';
		time?: number;
		videoElement?: HTMLVideoElement;
		onClose: () => void;
	}

	let {
		videoPath,
		backend = macBackend,
		roi,
		language,
		recognitionLevel = 'accurate',
		time: initialTime,
		videoElement: externalVideoElement,
		onClose
	}: Props = $props();

	let isOpen = $state(true);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let frameImage = $state<string | null>(null);
	let ocrText = $state<string | null>(null);
	let extractionTime = $state<number | null>(null);
	let useCurrentTime = $state(true);
	let customTime = $state<string>((initialTime ?? 0).toFixed(2));
	let showOCR = $state(false);

	const backendToUse: Backend = backend;
	const supportsLanguage = hasCapability(backendToUse, Capability.LANGUAGE_SELECTION);
	const supportsRecognitionLevel = hasCapability(backendToUse, Capability.RECOGNITION_LEVEL);

	$effect(() => {
		if (initialTime !== undefined) {
			customTime = initialTime.toFixed(2);
		}
	});

	function handleClose() {
		isOpen = false;
		onClose();
	}

	function getTime(): number {
		if (useCurrentTime && externalVideoElement) {
			return externalVideoElement.currentTime;
		}
		const parsed = parseFloat(customTime);
		return isNaN(parsed) ? 0 : parsed;
	}

	async function extractFrame() {
		if (!videoPath) return;

		isLoading = true;
		error = null;
		frameImage = null;
		ocrText = null;

		try {
			const currentTime = getTime();
			console.log('[FramePreview] Extracting frame at time:', currentTime);

			// Parse ROI if it's in the string format
			let roiObj: { x: number; y: number; width: number; height: number } | undefined;
			if (typeof roi === 'string') {
				// ROI format: "{leftRel} {bottomRel} {widthRel} {heightRel}"
				const parts = roi.trim().split(/\s+/);
				if (parts.length === 4) {
					roiObj = {
						x: parseFloat(parts[0]),
						y: parseFloat(parts[1]),
						width: parseFloat(parts[2]),
						height: parseFloat(parts[3])
					};
				} else {
					roiObj = undefined;
				}
			} else {
				roiObj = roi;
			}

			const result = await extractTestFrame(videoPath, currentTime, roiObj);
			frameImage = result.image;
			extractionTime = result.time;
			console.log('[FramePreview] Frame extracted successfully');
		} catch (e) {
			console.error('[FramePreview] Error extracting frame:', e);
			error = e instanceof Error ? e.message : String(e);
		} finally {
			isLoading = false;
		}
	}

	async function runOCR() {
		if (!frameImage) return;

		isLoading = true;
		error = null;
		ocrText = null;

		try {
			const result = await testOCR(
				frameImage,
				supportsLanguage ? language : undefined,
				supportsRecognitionLevel ? recognitionLevel : undefined
			);
			ocrText = result;
			console.log('[FramePreview] OCR result:', result);
		} catch (e) {
			console.error('[FramePreview] Error running OCR:', e);
			error = e instanceof Error ? e.message : String(e);
		} finally {
			isLoading = false;
		}
	}

	function copyOCRText() {
		if (!ocrText) return;

		navigator.clipboard
			.writeText(ocrText)
			.then(() => alert('OCR text copied to clipboard!'))
			.catch((e) => {
				console.error('Failed to copy:', e);
				alert('Failed to copy OCR text');
			});
	}
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && handleClose()} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
{#if isOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="modal-overlay" onclick={handleClose}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Frame Preview</h3>
				<button class="close-btn" onclick={handleClose} title="Close (Esc)">×</button>
			</div>

			<div class="modal-body">
				{#if !frameImage}
					<div class="extract-controls">
						<div class="time-input">
							<label>
								<input type="checkbox" bind:checked={useCurrentTime} style="margin-right: 8px;" />
								Use current video time
							</label>
							{#if !useCurrentTime}
								<label style="margin-left: 16px;">
									Time (seconds):
									<input
										type="number"
										step="0.1"
										min="0"
										bind:value={customTime}
										style="width: 100px; margin-left: 8px;"
									/>
								</label>
							{/if}
						</div>
						<button onclick={extractFrame} disabled={isLoading} class="btn btn-primary">
							{isLoading ? 'Extracting...' : 'Extract Frame'}
						</button>
						{#if error}
							<div class="error">{error}</div>
						{/if}
					</div>
				{:else}
					<div class="preview-container">
						<div class="preview-image-container">
							<img
								src={`data:image/jpeg;base64,${frameImage}`}
								alt="Extracted frame"
								class="preview-image"
							/>
							{#if extractionTime !== null}
								<div class="frame-time">Time: {extractionTime.toFixed(2)}s</div>
							{/if}
						</div>

						<div class="actions">
							<button onclick={extractFrame} disabled={isLoading} class="btn">
								{isLoading ? 'Extracting...' : 'Re-extract'}
							</button>

							{#if showOCR}
								<button onclick={runOCR} disabled={isLoading || !frameImage} class="btn">
									{isLoading ? 'Running OCR...' : 'Run OCR'}
								</button>
								<button
									onclick={() => {
										showOCR = false;
										ocrText = null;
									}}
									class="btn"
								>
									Hide OCR
								</button>
							{:else}
								<button onclick={() => (showOCR = true)} class="btn"> Show OCR Options </button>
							{/if}
						</div>

						{#if ocrText}
							<div class="ocr-result">
								<div class="ocr-header">
									<strong>OCR Result:</strong>
									<button onclick={copyOCRText} class="btn-small" title="Copy">Copy</button>
								</div>
								<div class="ocr-text">{ocrText}</div>
							</div>
						{/if}

						{#if error}
							<div class="error">{error}</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.7);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		padding: 20px;
		box-sizing: border-box;
	}

	.modal-content {
		background-color: #fff;
		border-radius: 8px;
		max-width: 90vw;
		max-height: 90vh;
		width: 800px;
		overflow: auto;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid #ddd;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.25rem;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 4px 8px;
		color: #666;
		border-radius: 4px;
	}

	.close-btn:hover {
		background: #f0f0f0;
		color: #333;
	}

	.modal-body {
		padding: 20px;
	}

	.extract-controls {
		display: flex;
		flex-direction: column;
		gap: 16px;
		align-items: center;
		padding: 40px 20px;
	}

	.time-input {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.preview-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.preview-image-container {
		position: relative;
		display: flex;
		justify-content: center;
	}

	.preview-image {
		max-width: 100%;
		max-height: 60vh;
		border: 1px solid #ddd;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.frame-time {
		position: absolute;
		bottom: 8px;
		left: 8px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.85rem;
	}

	.actions {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	.btn {
		padding: 10px 20px;
		background: #f0f0f0;
		color: #333;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s;
	}

	.btn:hover:not(:disabled) {
		background: #e0e0e0;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #007bff;
		color: white;
		border-color: #007bff;
	}

	.btn-primary:hover:not(:disabled) {
		background: #0056b3;
	}

	.ocr-result {
		margin-top: 16px;
		padding: 16px;
		background: #f8f9fa;
		border-radius: 4px;
		border: 1px solid #e9ecef;
	}

	.ocr-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.btn-small {
		padding: 4px 12px;
		font-size: 12px;
		background: #e9ecef;
		border: 1px solid #adb5bd;
		color: #495057;
	}

	.btn-small:hover {
		background: #dee2e6;
	}

	.ocr-text {
		white-space: pre-wrap;
		word-break: break-word;
		font-family: monospace;
		font-size: 14px;
		line-height: 1.5;
	}

	.error {
		color: #dc3545;
		padding: 8px 12px;
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		margin-top: 8px;
	}

	@media (prefers-color-scheme: dark) {
		.modal-content {
			background-color: #1a1a1a;
			color: #eee;
			border-color: #444;
		}

		.modal-header {
			border-bottom-color: #444;
		}

		.modal-header h3 {
			color: #eee;
		}

		.close-btn {
			color: #aaa;
		}

		.close-btn:hover {
			background: #333;
			color: #eee;
		}

		.btn {
			background: #444;
			color: #eee;
			border-color: #666;
		}

		.btn:hover:not(:disabled) {
			background: #555;
		}

		.btn-primary {
			background: #0056b3;
			color: white;
			border-color: #0056b3;
		}

		.btn-primary:hover:not(:disabled) {
			background: #004080;
		}

		.ocr-result {
			background: #2a2a2a;
			border-color: #555;
		}

		.ocr-text {
			color: #ddd;
		}

		.error {
			color: #f8d7da;
			background: #491217;
			border-color: #742a2e;
		}

		.btn-small {
			background: #495057;
			border-color: #6c757d;
			color: #eee;
		}

		.btn-small:hover {
			background: #5a6268;
		}
	}
</style>
