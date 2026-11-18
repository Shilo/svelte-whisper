<script>
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';
	import { showPlaceholder } from '../json.js';
	import { languageName } from '../lang.js';

	/**
	 * @type {{
	 *   doc: import('../doc.svelte.js').LocaleDoc,
	 *   langs: string[],
	 *   keys: string[],
	 *   onrename: (key: string) => void,
	 * }}
	 */
	let { doc, langs, keys, onrename } = $props();

	const PAGE = 150;
	let limit = $state(PAGE);
	let rows = $derived(keys.slice(0, limit));
	/** @type {HTMLElement | undefined} */ let sentinel = $state();
	/** @type {HTMLElement | undefined} */ let root = $state();
	let moreRight = $state(false);

	// Show an edge cue while columns are hidden to the right.
	$effect(() => {
		const el = root;
		if (!el) return;
		const check = () => (moreRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
		check();
		const ro = new ResizeObserver(check);
		ro.observe(el);
		el.addEventListener('scroll', check, { passive: true });
		return () => {
			ro.disconnect();
			el.removeEventListener('scroll', check);
		};
	});

	// A new filter starts at the top with a fresh page.
	$effect(() => {
		keys;
		limit = PAGE;
	});

	// Render more rows as the reader approaches the end.
	$effect(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver((entries) => {
			if (entries[0].isIntersecting && limit < keys.length) limit += PAGE * 2;
		}, { rootMargin: '1200px 0px' });
		io.observe(sentinel);
		return () => io.disconnect();
	});

	const autosizeNeeded = typeof CSS !== 'undefined' && !CSS.supports('field-sizing', 'content');
	/** Grow textareas with their content where field-sizing is unsupported. */
	/** @param {HTMLTextAreaElement} el */
	function autosize(el) {
		if (!autosizeNeeded) return;
		const fit = () => {
			el.style.height = 'auto';
			el.style.height = el.scrollHeight + 2 + 'px';
		};
		fit();
		el.addEventListener('input', fit);
		return () => el.removeEventListener('input', fit);
	}

	/** @param {KeyboardEvent & { currentTarget: HTMLTextAreaElement }} e @param {string} lang @param {string} key @param {number} r @param {number} c */
	async function onkeydown(e, lang, key, r, c) {
		if (e.key === 'Escape') {
			// Put the box back to what the file says.
			const original = doc.base[lang]?.[doc.renamed[key] ?? key] ?? '';
			doc.set(lang, key, original);
			e.currentTarget.value = original;
			return;
		}
		if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.isComposing) {
			e.preventDefault();
			const next = r + (e.ctrlKey || e.metaKey ? -1 : 1);
			if (next >= limit && limit < keys.length) {
				limit += PAGE;
				await tick();
			}
			cell(next, c)?.focus();
		}
	}

	/** @param {number} r @param {number} c */
	const cell = (r, c) => /** @type {HTMLTextAreaElement | null} */ (root?.querySelector(`[data-r="${r}"][data-c="${c}"]`));

	/** Focus a cell, rendering more rows first if needed. */
	export async function focusCell(/** @type {string} */ key, /** @type {string} */ lang) {
		const r = keys.indexOf(key);
		const c = langs.indexOf(lang);
		if (r === -1 || c === -1) return false;
		if (r >= limit) {
			limit = r + PAGE;
			await tick();
		}
		const el = cell(r, c);
		el?.focus({ preventScroll: true });
		el?.scrollIntoView({ block: 'center', inline: 'nearest' });
		return !!el;
	}

	/** @param {string} key */
	function split(key) {
		const i = key.lastIndexOf('.');
		return i === -1 ? ['', key] : [key.slice(0, i + 1), key.slice(i + 1)];
	}

	/** @param {{ missing: string[], extra: string[] }} w */
	function describe(w) {
		const parts = [];
		if (w.missing.length) parts.push(`Missing ${w.missing.map(showPlaceholder).join(' ')}`);
		if (w.extra.length) parts.push(`Not in source: ${w.extra.map(showPlaceholder).join(' ')}`);
		return parts.join(' · ');
	}
</script>

<div class="wrap" class:more-right={moreRight}>
<div class="scroller" bind:this={root} style:--n={langs.length}>
	<table>
		<thead>
			<tr>
				<th scope="col" class="key-col">
					<span class="caption">Key</span>
					<span class="count">{keys.length === doc.keys.length ? keys.length : `${keys.length} of ${doc.keys.length}`}</span>
				</th>
				{#each langs as lang (lang)}
					{@const missing = doc.missingCount(lang)}
					<th scope="col">
						<span class="lang"><span class="code">{lang}</span> {languageName(lang)}</span>
						<span class="count" class:done={missing === 0}>
							{lang === doc.source ? 'source · ' : ''}{missing === 0 ? 'complete' : `${missing} missing`}
						</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as key, r (key)}
				{@const gone = !!doc.deleted[key]}
				{@const [prefix, leaf] = split(key)}
				<tr class:gone>
					<th scope="row" class="key-col">
						<span class="key" title={key}><span class="prefix">{prefix}</span>{leaf}</span>
						{#if doc.renamed[key]}<span class="tag" title="Renamed from {doc.renamed[key]}">renamed</span>{:else if doc.isNewKey(key)}<span class="tag">new</span>{/if}
						<span class="row-actions">
							{#if gone}
								<button class="btn quiet mini" onclick={() => doc.restoreKey(key)}>
									<Icon name="undo" size={15} /> Restore
								</button>
							{:else}
								<button class="btn quiet icon mini" aria-label="Rename {key}" title="Rename" onclick={() => onrename(key)}>
									<Icon name="pencil" size={15} />
								</button>
								<button class="btn quiet icon mini" aria-label="Delete {key}" title="Delete" onclick={() => doc.deleteKey(key)}>
									<Icon name="trash" size={15} />
								</button>
							{/if}
						</span>
					</th>
					{#each langs as lang, c (lang)}
						{@const fixed = doc.isFixed(lang, key)}
						{@const changed = doc.isChanged(lang, key)}
						{@const missing = !gone && doc.isMissing(lang, key)}
						{@const warn = !gone && doc.warning(lang, key)}
						<td class:src={lang === doc.source} class:changed class:missing class:warn={!!warn}>
							<span class="cell-lang" aria-hidden="true"><span class="code">{lang}</span>{#if changed}<span class="edited">edited</span>{/if}</span>
							{#if fixed}
								<code class="fixed" title="Not a string; edit it in the file">{doc.fixed[lang][key]}</code>
							{:else}
								<textarea
									{@attach autosize}
									data-r={r}
									data-c={c}
									rows="1"
									{lang}
									dir="auto"
									spellcheck="true"
									aria-label="{languageName(lang)} ({lang}) for {key}{changed ? ', edited' : ''}{missing ? ', not translated' : ''}"
									aria-invalid={!!warn}
									placeholder={gone ? '' : lang === doc.source ? 'Missing in source' : 'Not translated'}
									disabled={gone}
									value={gone ? '' : doc.get(lang, key)}
									oninput={(e) => doc.set(lang, key, e.currentTarget.value)}
									onkeydown={(e) => onkeydown(e, lang, key, r, c)}
								></textarea>
							{/if}
							{#if warn}<p class="warn-text">{describe(warn)}</p>{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	{#if rows.length < keys.length}
		<div class="more" bind:this={sentinel}>Showing {rows.length} of {keys.length} keys…</div>
	{/if}
</div>
</div>

<style>
	.wrap {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.wrap::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 1.5rem;
		background: linear-gradient(to left, oklch(0.2 0.02 170 / 0.14), transparent);
		pointer-events: none;
		opacity: 0;
		transition: opacity 160ms var(--ease);
		z-index: 4;
	}
	.wrap.more-right::after {
		opacity: 1;
	}
	.scroller {
		overflow: auto;
		flex: 1;
		min-height: 0;
		overscroll-behavior: contain;
		scrollbar-color: var(--rule-strong) transparent;
	}
	table {
		border-collapse: separate;
		border-spacing: 0;
		min-width: 100%;
		table-layout: fixed;
		width: max(100%, calc(15rem + var(--n) * 13rem));
	}
	th,
	td {
		border-right: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
		text-align: left;
		padding: 0;
	}
	/* Header band */
	thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		padding: 0.5rem 0.75rem 0.4rem;
		background: var(--paper-2);
		border-bottom-color: var(--rule-strong);
		font-weight: 400;
	}
	thead th:first-child {
		z-index: 3;
	}
	.lang,
	.count {
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.lang {
		font-weight: 600;
		color: var(--ink);
	}
	.code {
		font-family: var(--mono);
		font-size: var(--t-sm);
		color: var(--form-ink);
		margin-right: 0.25rem;
	}
	.count {
		font-size: var(--t-sm);
		color: var(--ink-2);
	}
	.count.done {
		color: var(--form-ink);
	}
	/* Key column: printed, sticky */
	.key-col {
		position: sticky;
		left: 0;
		z-index: 1;
		width: 15rem;
		background: var(--paper);
		border-right-color: var(--rule-strong);
	}
	tbody .key-col {
		padding: 0.6rem 0.5rem 0.5rem 0.75rem;
		font-weight: 400;
	}
	.key {
		display: block;
		font-family: var(--mono);
		font-size: var(--t-sm);
		line-height: 1.45;
		color: var(--form-ink);
		overflow-wrap: anywhere;
		font-weight: 600;
	}
	.prefix {
		font-weight: 400;
		opacity: 0.72;
	}
	.tag {
		display: inline-block;
		margin-top: 0.25rem;
		padding: 0 0.3rem;
		border: 1px solid var(--air);
		color: var(--air);
		font-size: var(--t-cap);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.row-actions {
		position: absolute;
		top: 0.3rem;
		right: 0.25rem;
		display: flex;
		gap: 0.125rem;
		background: var(--paper);
		box-shadow: -0.5rem 0 0.5rem var(--paper);
		opacity: 0;
		transition: opacity 120ms var(--ease);
	}
	tr:not(:hover):not(:focus-within):not(.gone) .row-actions {
		pointer-events: none;
	}
	tr:hover .row-actions,
	tr:focus-within .row-actions,
	tr.gone .row-actions {
		opacity: 1;
	}
	@media (hover: none) {
		.row-actions {
			opacity: 1;
		}
	}
	.mini {
		min-height: 1.75rem;
		font-size: var(--t-sm);
		padding: 0 0.375rem;
	}
	.mini.icon {
		width: 1.75rem;
	}
	/* Cells: white boxes the user writes into */
	td {
		position: relative;
		background: var(--field);
	}
	td.src {
		background: var(--field-src);
	}
	textarea {
		display: block;
		width: 100%;
		min-height: 2.75rem;
		field-sizing: content;
		padding: 0.6rem 0.75rem;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font-size: var(--t-body);
		line-height: 1.45;
		resize: none;
		overflow-wrap: anywhere;
	}
	textarea:focus {
		outline: none;
		box-shadow: inset 0 0 0 2px var(--focus);
		background: var(--field);
	}
	textarea:disabled {
		cursor: not-allowed;
	}
	/* Printed marks: dotted baseline for an empty box, a folded corner for an edit */
	td.missing textarea {
		background-image: linear-gradient(to right, var(--rule-strong) 40%, transparent 40%);
		background-size: 5px 1px;
		background-repeat: repeat-x;
		background-position: left 0.75rem bottom 0.6rem;
		background-origin: border-box;
	}
	td.missing textarea:focus {
		background-image: none;
	}
	td.changed::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 0.75rem;
		height: 0.75rem;
		background: linear-gradient(225deg, var(--air) 50%, transparent 50%);
		pointer-events: none;
	}
	td.warn {
		box-shadow: inset 0 -2px 0 var(--alert);
	}
	.warn-text {
		padding: 0 0.75rem 0.5rem;
		font-size: var(--t-sm);
		color: var(--alert);
	}
	.fixed {
		display: block;
		padding: 0.6rem 0.75rem;
		color: var(--ink-2);
	}
	tr.gone .key {
		text-decoration: line-through;
		text-decoration-color: var(--alert);
	}
	tr.gone td {
		background: repeating-linear-gradient(-45deg, transparent 0 6px, var(--rule) 6px 7px), var(--paper);
	}
	.cell-lang {
		display: none;
	}
	.more {
		padding: 1rem;
		color: var(--ink-2);
		font-size: var(--t-sm);
	}

	/* Phone: each key becomes a short form section with one box per language. */
	@media (max-width: 47.99rem) {
		table,
		tbody,
		tr,
		th,
		td {
			display: block;
			width: auto;
		}
		thead {
			display: none;
		}
		tr {
			margin: 0.75rem 0.75rem 0;
			border: 1px solid var(--rule-strong);
			background: var(--field);
		}
		th,
		td {
			border-right: 0;
		}
		tbody .key-col {
			position: static;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
			padding: 0.375rem 0.25rem 0.375rem 0.75rem;
			background: var(--paper-2);
		}
		.row-actions {
			position: static;
			box-shadow: none;
			background: transparent;
			flex: none;
		}
		.key-col {
			width: auto;
		}
		.tag {
			margin: 0;
		}
		.key {
			flex: 1;
		}
		td:last-child {
			border-bottom: 0;
		}
		.cell-lang {
			display: flex;
			gap: 0.5rem;
			align-items: baseline;
			padding: 0.4rem 0.75rem 0;
		}
		.edited {
			font-size: var(--t-cap);
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--air);
		}
		textarea {
			min-height: 2.25rem;
			padding-top: 0.125rem;
			padding-bottom: 0.5rem;
			font-size: 1rem; /* 16px keeps iOS from zooming on focus */
		}
		td.missing textarea {
			background-position: left 0.75rem bottom 0.55rem;
		}
		/* The source text reads as the printed reference under the key, not as another box. */
		td.src {
			background: var(--paper-2);
			border-bottom-color: var(--rule-strong);
		}
		td.src .cell-lang {
			display: none;
		}
		td.src textarea {
			min-height: 0;
			padding-top: 0.125rem;
			padding-bottom: 0.5rem;
			color: var(--ink-2);
		}
		td.src textarea:focus {
			color: var(--ink);
		}
	}
</style>
