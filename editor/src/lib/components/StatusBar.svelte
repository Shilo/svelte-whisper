<script>
	import Icon from './Icon.svelte';

	/**
	 * @type {{ edits: number, files: number, draftSaved: boolean, ondiscard: () => void, onreview: () => void }}
	 */
	let { edits, files, draftSaved, ondiscard, onreview } = $props();
</script>

<footer class="status">
	<p class="summary" aria-live="polite">
		{#if edits}
			<span class="tick" aria-hidden="true"></span>
			<strong>{edits} {edits === 1 ? 'edit' : 'edits'}</strong> in {files} {files === 1 ? 'file' : 'files'}
			{#if draftSaved}<span class="saved">· draft kept in this browser</span>{/if}
		{:else}
			<span class="none">No edits yet</span>
		{/if}
	</p>
	<p class="keys hint" aria-hidden="true"><kbd>Enter</kbd> next row <kbd>Shift</kbd>+<kbd>Enter</kbd> new line <kbd>Esc</kbd> restore box</p>
	{#if edits}
		<button class="btn quiet" onclick={ondiscard}>Discard</button>
	{/if}
	<button class="btn primary" disabled={!edits} onclick={onreview}>
		<Icon name="send" size={16} /> Review & send
	</button>
</footer>

<style>
	.status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: var(--bar-h);
		padding: 0.375rem 0.75rem calc(0.375rem + env(safe-area-inset-bottom));
		background: var(--paper-2);
		border-top: 1px solid var(--rule-strong);
	}
	.summary {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
	}
	.tick {
		width: 0.625rem;
		height: 0.625rem;
		flex: none;
		background: linear-gradient(225deg, var(--air) 50%, transparent 50%);
	}
	.none,
	.saved {
		color: var(--ink-2);
	}
	.saved {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.keys {
		margin-left: auto;
		white-space: nowrap;
	}
	.keys kbd {
		margin-left: 0.5rem;
	}
	.keys kbd + kbd {
		margin-left: 0;
	}
	@media (max-width: 64rem) {
		.keys {
			display: none;
		}
		.summary {
			margin-right: auto;
		}
	}
	@media (max-width: 30rem) {
		.saved {
			display: none;
		}
	}
</style>
