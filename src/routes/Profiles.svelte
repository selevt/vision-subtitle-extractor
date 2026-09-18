<script lang="ts">
	import { ask } from '@tauri-apps/plugin-dialog';

	let {
		profileNames,
		activeProfile = $bindable(),
		isModified,
		onLoad,
		onSaveAs,
		onUpdate,
		onDelete
	}: {
		profileNames: string[];
		activeProfile: string | undefined;
		isModified: boolean;
		onLoad: (name: string) => void;
		onSaveAs: (name: string) => void;
		onUpdate: () => void;
		onDelete: (name: string) => void;
	} = $props();

	let open = $state(false);
	let filter = $state('');
	let newName = $state('');
	let showSaveAs = $state(false);
	let rootEl: HTMLElement;

	const filteredProfiles = $derived(
		profileNames.filter((name) => name.toLowerCase().includes(filter.trim().toLowerCase()))
	);
	// The filter input is only worth its space once there is a real list to search
	const showFilter = $derived(profileNames.length >= 5);

	function autofocus(el: HTMLElement) {
		el.focus();
	}

	function resetTransient() {
		filter = '';
		newName = '';
		showSaveAs = false;
	}

	function closeMenu() {
		open = false;
		resetTransient();
	}

	function toggle() {
		open = !open;
		if (!open) resetTransient();
	}

	function select(name: string | undefined) {
		activeProfile = name;
		if (name) onLoad(name);
		closeMenu();
	}

	function handleWindowClick(event: MouseEvent) {
		// composedPath() is frozen at dispatch time, so it still includes this
		// root even when the click target gets detached mid-dispatch (e.g. the
		// "Save as..." button being replaced by the inline input row).
		if (open && rootEl && !event.composedPath().includes(rootEl)) closeMenu();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') closeMenu();
	}

	function handleFilterKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && filteredProfiles.length > 0) {
			select(filteredProfiles[0]);
		}
	}

	function handleSaveAsKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSaveAs();
		} else if (event.key === 'Escape') {
			// Cancel just the inline input; a second Escape closes the menu
			event.stopPropagation();
			showSaveAs = false;
			newName = '';
		}
	}

	async function handleSaveAs() {
		const name = newName.trim();
		if (!name) return;
		if (profileNames.includes(name)) {
			const confirmed = await ask(`Profile "${name}" already exists. Overwrite it?`, {
				title: 'Overwrite profile',
				kind: 'warning'
			});
			if (!confirmed) return;
		}
		onSaveAs(name);
		closeMenu();
	}

	async function handleDelete() {
		if (!activeProfile) return;
		const confirmed = await ask(`Delete profile "${activeProfile}"? This cannot be undone.`, {
			title: 'Delete profile',
			kind: 'warning'
		});
		if (!confirmed) return;
		onDelete(activeProfile);
		closeMenu();
	}

	function handleUpdate() {
		onUpdate();
		closeMenu();
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="profiles" bind:this={rootEl}>
	<button
		type="button"
		class="profile-btn"
		onclick={toggle}
		title={activeProfile
			? isModified
				? 'Active profile, unsaved changes'
				: 'Active profile'
			: 'Profiles'}
	>
		<span class="profile-name">
			{#if activeProfile}Profile: {activeProfile}{#if isModified}&nbsp;*{/if}{:else}Profile{/if}
		</span>
		<span class="caret" aria-hidden="true"></span>
	</button>

	{#if open}
		<div class="menu">
			{#if showFilter}
				<input
					class="filter-input"
					bind:value={filter}
					placeholder="Filter profiles..."
					use:autofocus
					onkeydown={handleFilterKeydown}
				/>
			{/if}

			<div class="menu-list">
				{#if activeProfile}
					<button type="button" class="menu-item" onclick={() => select(undefined)}>
						(none)
					</button>
				{/if}
				{#each filteredProfiles as name (name)}
					<button
						type="button"
						class="menu-item"
						class:current={name === activeProfile}
						onclick={() => select(name)}
					>
						{name}
						{#if name === activeProfile && isModified}
							<span class="modified" title="Unsaved changes">*</span>
						{/if}
					</button>
				{/each}
				{#if profileNames.length === 0}
					<div class="empty">No saved profiles yet</div>
				{:else if filteredProfiles.length === 0}
					<div class="empty">No matches</div>
				{/if}
			</div>

			<div class="menu-sep"></div>

			{#if showSaveAs}
				<div class="save-as-row">
					<input
						class="name-input"
						bind:value={newName}
						placeholder="Profile name"
						use:autofocus
						onkeydown={handleSaveAsKeydown}
					/>
					<button type="button" class="menu-item save-btn" onclick={handleSaveAs}>Save</button>
				</div>
			{:else}
				<button type="button" class="menu-item" onclick={() => (showSaveAs = true)}>
					Save as...
				</button>
			{/if}

			{#if activeProfile}
				<button type="button" class="menu-item" disabled={!isModified} onclick={handleUpdate}>
					Update {activeProfile}{#if isModified}&nbsp;*{/if}
				</button>
				<button type="button" class="menu-item danger" onclick={handleDelete}>
					Delete {activeProfile}
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.profiles {
		position: fixed;
		top: 12px;
		right: 16px;
		z-index: 100;
	}

	.profile-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 280px;
	}

	.profile-name {
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.caret {
		width: 0;
		height: 0;
		border-left: 4px solid transparent;
		border-right: 4px solid transparent;
		border-top: 5px solid currentColor;
		flex-shrink: 0;
	}

	.menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		min-width: 220px;
		max-width: 300px;
		background: #ffffff;
		border: 1px solid #ddd;
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: left;
	}

	.menu-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 260px;
		overflow-y: auto;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 6px 10px;
		background: none;
		border: none;
		border-radius: 4px;
		box-shadow: none;
		text-align: left;
		cursor: pointer;
		font-size: 14px;
		font-weight: 400;
	}

	.menu-item:hover:not(:disabled) {
		background: #f0f0f0;
		border-color: transparent;
	}

	.menu-item:disabled {
		cursor: default;
	}

	.menu-item.current {
		font-weight: 600;
	}

	.menu-item.danger {
		color: #b33333;
	}

	.save-btn {
		width: auto;
		flex-shrink: 0;
	}

	.modified {
		color: #b8860b;
	}

	.empty {
		padding: 6px 10px;
		color: #999999;
		font-size: 13px;
	}

	.menu-sep {
		border-top: 1px solid #e5e5e5;
		margin: 2px 0;
	}

	.filter-input,
	.name-input {
		padding: 4px 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-shadow: none;
		font-size: 14px;
	}

	.filter-input {
		width: 100%;
		box-sizing: border-box;
	}

	.save-as-row {
		display: flex;
		gap: 4px;
		align-items: center;
	}

	.name-input {
		flex: 1;
		min-width: 0;
	}

	@media (prefers-color-scheme: dark) {
		.menu {
			background: #2a2a2a;
			border-color: #555;
		}

		.menu-item:hover:not(:disabled) {
			background: #3a3a3a;
			border-color: transparent;
		}

		.menu-item.danger {
			color: #e66666;
		}

		.modified {
			color: #daa520;
		}

		.empty {
			color: #888888;
		}

		.menu-sep {
			border-top-color: #444;
		}

		.filter-input,
		.name-input {
			background: #333;
			border-color: #555;
			color: #eee;
		}
	}
</style>
