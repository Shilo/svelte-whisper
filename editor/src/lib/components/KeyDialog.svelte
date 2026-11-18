<script>
	import Dialog from './Dialog.svelte';
	import { languageName } from '../lang.js';

	/**
	 * Add a key (optionally with its source text) or rename one.
	 * @type {{
	 *   open: boolean,
	 *   doc: import('../doc.svelte.js').LocaleDoc,
	 *   renaming?: string | null,
	 *   ondone: (key: string) => void
	 * }}
	 */
	let { open = $bindable(), doc, renaming = null, ondone } = $props();

	let key = $state('');
	let text = $state('');
	let touched = $state(false);

	$effect(() => {
		if (open) {
			key = renaming ?? '';
			text = '';
			touched = false;
		}
	});

	let error = $derived(doc.validateKey(key.trim(), renaming ?? ''));

	/** @param {SubmitEvent} e */
	function submit(e) {
		e.preventDefault();
		touched = true;
		if (error) return;
		const k = key.trim();
		if (renaming) {
			if (k !== renaming) doc.renameKey(renaming, k);
		} else {
			doc.addKey(k);
			if (text) doc.set(doc.source, k, text);
		}
		open = false;
		ondone(k);
	}
</script>

<Dialog bind:open title={renaming ? 'Rename key' : 'Add a key'}>
	<form id="key-form" class="form" onsubmit={submit} novalidate>
		<div class="field">
			<label class="caption" for="k-key">Key</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="k-key"
				class="input mono"
				bind:value={key}
				onblur={() => (touched = true)}
				placeholder="settings.profile.title"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				autofocus
				aria-invalid={touched && !!error}
				aria-describedby="k-key-hint"
			/>
			{#if touched && error}
				<p id="k-key-hint" class="error-text">{error}</p>
			{:else}
				<p id="k-key-hint" class="hint">Dots make groups. Files that use nested objects get a nested entry; flat files keep the dotted key.</p>
			{/if}
		</div>
		{#if renaming}
			<p class="hint">The key is renamed in every language file. Code that uses the old key will need updating.</p>
		{:else}
			<div class="field">
				<label class="caption" for="k-text">{languageName(doc.source)} text <span class="opt">optional</span></label>
				<textarea id="k-text" class="input" rows="2" bind:value={text} lang={doc.source} dir="auto"></textarea>
			</div>
		{/if}
	</form>
	{#snippet footer()}
		<button class="btn" type="button" onclick={() => (open = false)}>Cancel</button>
		<button class="btn solid" type="submit" form="key-form">{renaming ? 'Rename' : 'Add key'}</button>
	{/snippet}
</Dialog>

<style>
	.form {
		display: grid;
		gap: 1rem;
	}
	textarea {
		resize: vertical;
	}
	.opt {
		font-weight: 400;
		letter-spacing: 0.04em;
		text-transform: none;
		color: var(--ink-2);
	}
</style>
