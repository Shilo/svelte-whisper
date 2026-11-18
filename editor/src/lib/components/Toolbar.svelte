<script>
	import Icon from './Icon.svelte';
	import { languageName } from '../lang.js';

	/**
	 * @type {{
	 *   doc: import('../doc.svelte.js').LocaleDoc,
	 *   query: string,
	 *   filter: 'all' | 'missing' | 'edited',
	 *   hidden: string[],
	 *   onnext: () => void,
	 *   onaddkey: () => void,
	 *   onaddlang: () => void,
	 *   searchEl?: HTMLInputElement
	 * }}
	 */
	let { doc, query = $bindable(), filter = $bindable(), hidden = $bindable(), onnext, onaddkey, onaddlang, searchEl = $bindable() } = $props();

	/** @param {string} lang */
	function toggle(lang) {
		if (hidden.includes(lang)) hidden = hidden.filter((l) => l !== lang);
		else if (hidden.length < doc.langs.length - 1) hidden = [...hidden, lang];
	}

	const filters = /** @type {const} */ ([
		['all', 'All'],
		['missing', 'Missing'],
		['edited', 'Edited']
	]);
</script>

<div class="toolbar">
	<div class="row">
		<label class="search">
			<span class="visually-hidden">Search keys and text</span>
			<Icon name="search" size={16} />
			<input
				bind:this={searchEl}
				type="search"
				placeholder="Search keys and text"
				bind:value={query}
				autocomplete="off"
				spellcheck="false"
			/>
			<kbd aria-hidden="true">/</kbd>
		</label>

		<fieldset class="segmented">
			<legend class="visually-hidden">Show</legend>
			{#each filters as [value, label] (value)}
				<label>
					<input type="radio" name="filter" {value} bind:group={filter} />
					<span>{label}</span>
				</label>
			{/each}
		</fieldset>

		<button class="btn" onclick={onnext} aria-label="Next missing" title="Jump to the next untranslated box (Alt+N)">
			<Icon name="next" size={16} /> <span>Next<span class="label"> missing</span></span>
		</button>

		<span class="spacer"></span>

		<button class="btn" onclick={onaddkey} aria-label="Add key" title="Add a key"><Icon name="plus" size={16} /> <span class="key-label">Key</span></button>
	</div>

	<div class="row langs" role="group" aria-label="Languages shown">
		{#each doc.langs as lang (lang)}
			{@const missing = doc.missingCount(lang)}
			<button
				class="chip"
				aria-pressed={!hidden.includes(lang)}
				title="{languageName(lang)}: {missing ? `${missing} missing` : 'complete'}"
				onclick={() => toggle(lang)}
			>
				<span class="code">{lang}</span>
				{#if lang === doc.source}<span class="src">source</span>{/if}
				{#if missing}<span class="n">{missing}</span>{:else}<span class="ok"><Icon name="check" size={14} /></span>{/if}
				<span class="visually-hidden">{missing ? 'missing' : 'complete'}</span>
			</button>
		{/each}
		<button class="btn quiet add-lang" onclick={onaddlang}><Icon name="plus" size={16} /> Language</button>
	</div>
</div>

<style>
	.toolbar {
		display: grid;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		background: var(--paper);
		border-bottom: 1px solid var(--rule-strong);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.spacer {
		flex: 1;
	}
	.search {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1 1 14rem;
		max-width: 24rem;
		min-height: 2.25rem;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius);
		background: var(--field);
		color: var(--form-ink);
		padding-left: 0.625rem;
		gap: 0.375rem;
	}
	.search:focus-within {
		border-color: var(--focus);
		box-shadow: inset 0 0 0 1px var(--focus);
	}
	.search input {
		flex: 1;
		min-width: 0;
		height: 2.125rem;
		border: 0;
		background: transparent;
		color: var(--ink);
		font-size: 1rem;
	}
	.search input:focus {
		outline: none;
	}
	.search kbd {
		margin-right: 0.5rem;
	}
	.search:focus-within kbd {
		display: none;
	}
	.segmented {
		display: inline-flex;
		margin: 0;
		padding: 0;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius);
		background: var(--field);
	}
	.segmented label {
		position: relative;
	}
	.segmented input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}
	.segmented span {
		display: block;
		padding: 0 0.75rem;
		line-height: 2.125rem;
		font-weight: 500;
		color: var(--ink-2);
	}
	.segmented label + label span {
		border-left: 1px solid var(--rule);
	}
	.segmented input:checked + span {
		background: var(--form-ink);
		color: var(--field);
	}
	.segmented input:focus-visible + span {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}
	.langs {
		flex-wrap: nowrap;
		overflow-x: auto;
		scrollbar-width: none;
		margin: 0 -0.75rem;
		padding: 0 0.75rem;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		flex: none;
		min-height: 2rem;
		padding: 0 0.625rem;
		border: 1px dashed var(--rule-strong);
		border-radius: var(--radius);
		background: transparent;
		color: var(--ink-2);
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		border-style: solid;
		background: var(--field);
		color: var(--ink);
	}
	.chip .code {
		font-family: var(--mono);
		font-weight: 600;
		color: var(--form-ink);
	}
	.chip[aria-pressed='false'] .code {
		text-decoration: line-through;
		color: var(--ink-2);
	}
	.chip .src {
		font-size: var(--t-cap);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-2);
	}
	.chip .n {
		min-width: 1.25rem;
		padding: 0 0.3rem;
		border-radius: 1rem;
		background: var(--paper-2);
		color: var(--form-ink);
		font-size: var(--t-sm);
		font-weight: 600;
		text-align: center;
	}
	.chip .ok {
		display: inline-flex;
		color: var(--form-ink);
	}
	.add-lang {
		flex: none;
	}
	@media (max-width: 47.99rem) {
		.search {
			flex-basis: 100%;
			max-width: none;
		}
		.search kbd {
			display: none;
		}
		.row:first-child {
			flex-wrap: wrap;
		}
		.segmented span {
			padding: 0 0.55rem;
		}
		.spacer {
			display: none;
		}
		.row:first-child > .btn:last-child {
			margin-left: auto;
		}
		.key-label {
			display: none;
		}
		.langs {
			flex-wrap: wrap;
			overflow: visible;
		}
	}
	@media (max-width: 24.5rem) {
		.label {
			display: none;
		}
	}
</style>
