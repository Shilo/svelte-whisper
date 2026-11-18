<script>
	import Dialog from './Dialog.svelte';
	import { LANG_PATTERN } from '../doc.svelte.js';
	import { languageName } from '../lang.js';

	/** @type {{ open: boolean, doc: import('../doc.svelte.js').LocaleDoc, ondone: (lang: string) => void }} */
	let { open = $bindable(), doc, ondone } = $props();

	let code = $state('');
	let touched = $state(false);

	$effect(() => {
		if (open) (code = ''), (touched = false);
	});

	let c = $derived(code.trim());
	let error = $derived(
		!c
			? 'Enter a language code.'
			: !LANG_PATTERN.test(c)
				? 'Use a code like de, pt-BR or zh-Hant.'
				: doc.langs.includes(c)
					? 'That language is already here.'
					: null
	);
	let name = $derived(!error ? languageName(c) : '');

	/** @param {SubmitEvent} e */
	function submit(e) {
		e.preventDefault();
		touched = true;
		if (error) return;
		doc.addLanguage(c);
		open = false;
		ondone(c);
	}
</script>

<Dialog bind:open title="Add a language">
	<form id="lang-form" class="field" onsubmit={submit} novalidate>
		<label class="caption" for="l-code">Language code</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			id="l-code"
			class="input mono"
			bind:value={code}
			onblur={() => (touched = true)}
			placeholder="de"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			autofocus
			aria-invalid={touched && !!error}
			aria-describedby="l-hint"
		/>
		{#if touched && error}
			<p id="l-hint" class="error-text">{error}</p>
		{:else}
			<p id="l-hint" class="hint">
				{#if name && name !== c}{name}. {/if}Creates <code>{doc.dir}/{c || 'xx'}.json</code> when you send your changes.
			</p>
		{/if}
	</form>
	{#snippet footer()}
		<button class="btn" type="button" onclick={() => (open = false)}>Cancel</button>
		<button class="btn solid" type="submit" form="lang-form">Add language</button>
	{/snippet}
</Dialog>
