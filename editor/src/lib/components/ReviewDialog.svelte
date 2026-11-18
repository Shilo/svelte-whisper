<script>
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import { showPlaceholder } from '../json.js';
	import { languageName } from '../lang.js';
	import { auth } from '../session.svelte.js';

	/**
	 * The declaration: every change, file by file, then how to send it.
	 * @type {{
	 *   open: boolean,
	 *   doc: import('../doc.svelte.js').LocaleDoc,
	 *   repo: string,
	 *   branch: string,
	 *   demo: boolean,
	 *   canPush: boolean,
	 *   mode: 'pr' | 'commit',
	 *   sending: boolean,
	 *   onsend: (o: { mode: 'pr' | 'commit', title: string, body: string, files: import('../doc.svelte.js').OutFile[] }) => void
	 * }}
	 */
	let { open = $bindable(), doc, repo, branch, demo, canPush, mode = $bindable(), sending, onsend } = $props();

	let files = $derived(open ? doc.outputFiles() : []);
	let totals = $derived.by(() => {
		let added = 0, changed = 0, removed = 0, warnings = 0;
		for (const f of files)
			for (const c of f.changes) {
				const to = Object.hasOwn(doc.renamed, c.key);
				const from = Object.values(doc.renamed).includes(c.key) && c.after === undefined;
				if (from) continue; // counted once, on the renamed key
				if (to) changed++;
				else if (c.before === undefined) added++;
				else if (c.after === undefined) removed++;
				else changed++;
				if (warningFor(f.lang, c)) warnings++;
			}
		return { added, changed, removed, warnings };
	});

	let changeTotal = $derived(files.reduce((n, f) => n + f.changes.length, 0));
	let langList = $derived(files.map((f) => languageName(f.lang)).join(', '));

	let renamedTo = $derived(Object.fromEntries(Object.entries(doc.renamed).map(([to, from]) => [from, to])));

	let title = $state('');
	let body = $state('');
	$effect(() => {
		if (open) {
			const langs = files.filter((f) => f.lang !== doc.source).map((f) => f.lang);
			title = langs.length && langs.length <= 3 ? `i18n: update ${langs.join(', ')} translations` : 'i18n: update translations';
			body = '';
		}
	});

	/** The grid's own check, so the grid and the review always agree. */
	/** @param {string} lang @param {{ key: string, after: string | undefined }} c */
	const warningFor = (lang, c) => (c.after === undefined ? null : doc.warning(lang, c.key));

	/** @param {string} lang @param {string} key */
	function revert(lang, key) {
		if (doc.deleted[key]) return doc.restoreKey(key);
		const from = doc.renamed[key];
		if (from) return doc.renameKey(key, from);
		doc.set(lang, key, doc.base[lang]?.[key] ?? '');
	}

	/** @param {import('../doc.svelte.js').OutFile} f */
	function download(f) {
		const url = URL.createObjectURL(new Blob([f.text], { type: 'application/json' }));
		const a = Object.assign(document.createElement('a'), { href: url, download: `${f.lang}.json` });
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function send() {
		onsend({
			mode,
			title: title.trim() || 'i18n: update translations',
			body: body.trim(),
			files
		});
	}
</script>

<Dialog bind:open title="Review changes" wide>
	{#if files.length === 0}
		<p class="hint">Nothing to send. Edits you make in the grid appear here.</p>
	{:else}
		<dl class="totals" aria-label="Summary">
			<div><dt class="caption">Files</dt><dd>{files.length}</dd></div>
			<div><dt class="caption">Added</dt><dd>{totals.added}</dd></div>
			<div><dt class="caption">Changed</dt><dd>{totals.changed}</dd></div>
			<div><dt class="caption">Removed</dt><dd>{totals.removed}</dd></div>
			<div class="issues" class:alert={totals.warnings}><dt class="caption">Placeholder issues</dt><dd>{totals.warnings}</dd></div>
		</dl>

		{#each files as f (f.lang)}
			<section class="file" aria-label="{f.path}">
				<header>
					<h3><code>{f.path}</code></h3>
					<span class="hint">{languageName(f.lang)}{f.isNew ? ' · new file' : ''} · {f.changes.length} {f.changes.length === 1 ? 'change' : 'changes'}</span>
					<button class="btn quiet mini" onclick={() => download(f)} title="Download {f.lang}.json with your changes">
						<Icon name="download" size={15} /> <span>JSON</span>
					</button>
				</header>
				<ol>
					{#each f.changes as c (c.key)}
						{@const w = warningFor(f.lang, c)}
						<li>
							<code class="key">{c.key}</code>
							<div class="diff">
								{#if c.before !== undefined}<del lang={f.lang} dir="auto"><span class="visually-hidden">Before: </span>{c.before}</del>{/if}
								{#if c.after !== undefined}<ins lang={f.lang} dir="auto"><span class="visually-hidden">After: </span>{c.after}</ins>
								{:else if renamedTo[c.key]}<span class="moved">renamed to <code>{renamedTo[c.key]}</code></span>
								{:else}<span class="removed">removed</span>{/if}
								{#if doc.renamed[c.key]}<span class="moved">renamed from <code>{doc.renamed[c.key]}</code></span>{/if}
								{#if w}
									<p class="warn-text">
										{#if w.missing.length}Missing {w.missing.map(showPlaceholder).join(' ')}{/if}
										{#if w.missing.length && w.extra.length} · {/if}
										{#if w.extra.length}Not in source: {w.extra.map(showPlaceholder).join(' ')}{/if}
									</p>
								{/if}
							</div>
							{#if doc.keys.includes(c.key)}
								<button class="btn quiet icon mini" aria-label={doc.renamed[c.key] ? `Undo renaming ${doc.renamed[c.key]}` : `Undo this change to ${c.key}`} title="Undo" onclick={() => revert(f.lang, c.key)}>
									<Icon name="undo" size={15} />
								</button>
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/each}

		<fieldset class="send">
			<legend class="caption">Send to <code>{repo}</code></legend>
			<label class="option">
				<input type="radio" name="mode" value="pr" bind:group={mode} />
				<span>
					<strong>Open a pull request</strong>
					<span class="hint">
						{canPush || demo ? `A new branch off ${branch}, for review.` : `Your fork gets a branch; the pull request goes to ${repo}.`}
					</span>
				</span>
			</label>
			<label class="option" class:off={!canPush && !demo}>
				<input type="radio" name="mode" value="commit" bind:group={mode} disabled={!canPush && !demo} />
				<span>
					<strong>Commit to {branch}</strong>
					<span class="hint">{canPush || demo ? 'Straight to the branch. For maintainers.' : 'Needs write access to the repository.'}</span>
				</span>
			</label>
			<div class="field">
				<label class="caption" for="r-title">{mode === 'pr' ? 'Pull request title' : 'Commit message'}</label>
				<input id="r-title" class="input" bind:value={title} />
			</div>
			{#if mode === 'pr'}
				<div class="field">
					<label class="caption" for="r-body">Note for the reviewer <span class="opt">optional</span></label>
					<textarea id="r-body" class="input" rows="2" bind:value={body}></textarea>
				</div>
			{/if}
		</fieldset>
	{/if}

	{#snippet footer()}
		{#if files.length}
			<section class="declaration" aria-labelledby="decl-title">
				<p>
					<span id="decl-title" class="caption">Declaration</span>
					{changeTotal}
					{changeTotal === 1 ? 'change' : 'changes'} to {langList} in <code>{repo}</code>,
					{mode === 'pr' ? 'as a pull request into' : 'committed straight to'} <code>{branch}</code>{#if totals.warnings}, with
						<strong class="alert-text">{totals.warnings} placeholder {totals.warnings === 1 ? 'issue' : 'issues'}</strong>{/if}.{#if demo}{' '}Demo: nothing leaves this tab.{/if}
				</p>
				<p class="sign">
					<span class="signature">{demo ? 'demo visitor' : auth.user?.login || 'you'}</span>
					<span class="caption">Sender</span>
				</p>
			</section>
		{/if}
		<button class="btn" type="button" onclick={() => (open = false)}>Keep editing</button>
		<button class="btn primary" type="button" disabled={!files.length || sending} onclick={send}>
			<Icon name="send" size={16} />
			{sending ? 'Sending…' : mode === 'pr' ? 'Open pull request' : `Commit to ${branch}`}
		</button>
	{/snippet}
</Dialog>

<style>
	.totals {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		margin: 0;
		border: 1px solid var(--rule-strong);
		border-bottom: 3px double var(--rule-strong);
	}
	.totals div {
		padding: 0.5rem 0.75rem;
		border-right: 1px solid var(--rule);
	}
	.totals div:last-child {
		border-right: 0;
	}
	.totals dd {
		margin: 0.125rem 0 0;
		font: 600 var(--t-xl) / 1.1 var(--font);
		color: var(--ink);
	}
	.totals .alert dd,
	.totals .alert dt {
		color: var(--alert);
	}
	.file {
		border: 1px solid var(--rule-strong);
	}
	.file header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 0.75rem;
		padding: 0.375rem 0.375rem 0.375rem 0.75rem;
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.file h3 {
		font-size: var(--t-ui);
		color: var(--form-ink);
	}
	.file header .hint {
		flex: 1;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: grid;
		grid-template-columns: minmax(8rem, 14rem) 1fr auto;
		gap: 0.25rem 0.75rem;
		align-items: start;
		padding: 0.5rem 0.375rem 0.5rem 0.75rem;
		border-bottom: 1px solid var(--rule);
	}
	li:last-child {
		border-bottom: 0;
	}
	.key {
		font-size: var(--t-sm);
		color: var(--form-ink);
		overflow-wrap: anywhere;
		padding-top: 0.125rem;
	}
	.diff {
		display: grid;
		gap: 0.125rem;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	del {
		color: var(--ink-2);
		text-decoration-color: var(--alert);
	}
	ins {
		text-decoration: underline;
		text-decoration-color: var(--air);
		text-decoration-thickness: 1px;
		text-underline-offset: 0.25em;
		color: var(--ink);
		justify-self: start;
	}
	.moved {
		font-size: var(--t-sm);
		color: var(--form-ink);
	}
	.removed {
		font-size: var(--t-sm);
		color: var(--alert);
	}
	.warn-text {
		font-size: var(--t-sm);
		color: var(--alert);
	}
	.mini {
		min-height: 1.75rem;
		font-size: var(--t-sm);
		padding: 0 0.375rem;
	}
	.mini.icon {
		width: 1.75rem;
	}
	.send {
		display: grid;
		gap: 0.75rem;
		margin: 0;
		padding: 1rem 0 0;
		border: 0;
		border-top: 1px dashed var(--rule-strong);
	}
	.send legend {
		padding: 0;
		float: left;
		margin-bottom: 0.25rem;
	}
	.send legend code {
		text-transform: none;
		letter-spacing: 0;
		font-size: var(--t-sm);
	}
	.option {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--rule);
		cursor: pointer;
	}
	.option:has(input:checked) {
		border-color: var(--form-ink);
		box-shadow: inset 0 0 0 1px var(--form-ink);
	}
	.option.off {
		cursor: not-allowed;
		opacity: 0.7;
	}
	.option input {
		margin: 0.2rem 0 0;
		accent-color: var(--form-ink);
	}
	.option span {
		display: grid;
		gap: 0.125rem;
	}
	.opt {
		font-weight: 400;
		letter-spacing: 0.04em;
		text-transform: none;
		color: var(--ink-2);
	}
	.declaration {
		flex: 1 1 100%;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5rem 1.5rem;
		padding-bottom: 0.75rem;
		margin-bottom: 0.25rem;
		border-bottom: 1px dashed var(--rule-strong);
		font-size: var(--t-sm);
	}
	.declaration p {
		flex: 1 1 22rem;
		max-width: 65ch;
	}
	.declaration .caption {
		margin-right: 0.375rem;
	}
	.declaration code {
		font-size: var(--t-sm);
		color: var(--form-ink);
	}
	.alert-text {
		color: var(--alert);
	}
	.declaration .sign {
		flex: 0 1 12rem;
		display: grid;
		justify-items: start;
	}
	.signature {
		min-width: min(12rem, 100%);
		padding: 0 0.25rem 0.125rem;
		border-bottom: 1px solid var(--ink);
		font-family: var(--mono);
		font-size: var(--t-body);
	}
	@media (max-width: 36rem) {
		.totals {
			grid-template-columns: repeat(3, 1fr);
		}
		.totals div:nth-child(3) {
			border-right: 0;
		}
		.totals div:nth-child(-n + 3) {
			border-bottom: 1px solid var(--rule);
		}
		.totals .issues {
			grid-column: span 2;
		}
		li {
			grid-template-columns: 1fr auto;
		}
		.diff {
			grid-column: 1;
		}
		.key {
			grid-column: 1 / -1;
		}
	}
</style>
