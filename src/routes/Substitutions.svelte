<script lang="ts">
	interface Substitution {
		regex: string;
		replacement: string;
	}

	let { substitutions = $bindable() } = $props<{ substitutions: Substitution[] }>();
	let showSubstitutions = $state(false);

	function addSubstitution() {
		substitutions = [...substitutions, { regex: '', replacement: '' }];
	}

	function removeSubstitution(index: number) {
		const newSubs = [...substitutions];
		newSubs.splice(index, 1);
		substitutions = newSubs;
	}

	function activeCount() {
		return substitutions.filter((s) => s.regex.trim() !== '').length;
	}
</script>

<div class="substitutions-wrapper">
	<button
		type="button"
		class="toggle-subs-btn"
		onclick={() => (showSubstitutions = !showSubstitutions)}
	>
		{showSubstitutions ? 'Hide' : 'Configure'} Substitutions ({activeCount()})
	</button>

	{#if showSubstitutions}
		<div class="substitutions-container">
			{#each substitutions as sub, i}
				<div class="row substitution-row">
					<input class="sub-input" bind:value={sub.regex} placeholder="Regex Pattern" />
					<span>→</span>
					<input class="sub-input" bind:value={sub.replacement} placeholder="Replacement" />
					<button type="button" onclick={() => removeSubstitution(i)}>X</button>
				</div>
			{/each}
			<button type="button" onclick={addSubstitution}> Add Substitution </button>
		</div>
	{/if}
</div>

<style>
	.substitutions-wrapper {
		width: 100%;
		max-width: 600px;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 1rem;
	}

	.substitutions-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: center;
		width: 100%;
		padding: 1rem;
		border: 1px solid #ccc;
		border-radius: 8px;
		margin-top: 0.5rem;
	}

	.substitution-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.sub-input {
		flex: 1;
		min-width: 0;
	}

	.toggle-subs-btn {
		background: none;
		border: none;
		color: #666;
		text-decoration: underline;
		cursor: pointer;
		font-size: 0.9rem;
		padding: 0.5rem;
	}

	.toggle-subs-btn:hover {
		color: #333;
	}

	@media (prefers-color-scheme: dark) {
		.toggle-subs-btn {
			color: #aaa;
		}
		.toggle-subs-btn:hover {
			color: #fff;
		}
	}
</style>
