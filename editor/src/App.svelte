<script>
	import { onMount, untrack, tick } from 'svelte';
	import { auth, config, saveConfig, clearSession } from './lib/session.svelte.js';
	import { getRepo, listLocaleFiles, readFile, submit } from './lib/github.js';
	import { LocaleDoc } from './lib/doc.svelte.js';
	import { notify, dismiss } from './lib/toast.svelte.js';
	import { languageName } from './lib/lang.js';
	import AppBar from './lib/components/AppBar.svelte';
	import SignIn from './lib/components/SignIn.svelte';
	import ConnectForm from './lib/components/ConnectForm.svelte';
	import Dialog from './lib/components/Dialog.svelte';
	import Toast from './lib/components/Toast.svelte';
	import Icon from './lib/components/Icon.svelte';

	/** @type {'boot' | 'start' | 'connect' | 'loading' | 'editor'} */
	let view = $state('boot');
	/** @type {LocaleDoc | null} */
	let doc = $state.raw(null);
	/** @type {false | 'demo' | 'large'} */
	let demo = $state(false);
	/** The branch in use: the one asked for, or the repository's default branch. */
	let branch = $state('');
	let canPush = $state(false);
	let loadError = $state('');
	/** Language requested by a shared link (?lang=fr): show it next to the source. */
	let focusLang = '';

	// Grid view state
	let query = $state('');
	/** @type {'all' | 'missing' | 'edited'} */
	let filter = $state('all');
	/** @type {string[]} */
	let hidden = $state([]);
	let refresh = $state(0);
	/** @type {typeof import('./lib/components/editor.js') | null} */
	let ui = $state.raw(null);
	/** @type {Promise<unknown> | null} */
	let uiLoading = null;
	const loadUI = () => (uiLoading ??= import('./lib/components/editor.js').then((m) => (ui = m)));
	/** @type {{ focusCell: (key: string, lang: string) => Promise<boolean> } | undefined} */
	let grid = $state();
	/** @type {HTMLInputElement | undefined} */
	let searchEl = $state();

	// Dialogs
	let settingsOpen = $state(false);
	let keyOpen = $state(false);
	/** @type {string | null} */
	let renaming = $state(null);
	let langOpen = $state(false);
	let reviewOpen = $state(false);
	let discardOpen = $state(false);
	let sending = $state(false);
	/** @type {'pr' | 'commit'} */
	let mode = $state(config.mode);

	const draftKey = () => (demo ? `whisper.draft:${demo}` : `whisper.draft:${config.repo}@${branch}:${config.dir}`);

	// ── Start-up ──────────────────────────────────────────────────────
	onMount(() => {
		const p = new URLSearchParams(location.search);
		if (p.get('repo')) {
			// A shared link describes one repository: what it leaves out takes the defaults,
			// not whatever this browser used last.
			saveConfig({ repo: p.get('repo') ?? '', branch: p.get('branch') || '', dir: p.get('path') || 'src/locales' });
		}
		focusLang = p.get('lang') || '';
		if (p.has('demo')) return void openDemo(p.get('demo') === 'large');
		if (auth.token) {
			if (config.repo) load();
			else view = 'connect';
		} else {
			view = 'start';
		}
	});

	// Signing in moves the start screen forward.
	$effect(() => {
		if (auth.token && view === 'start') untrack(() => (config.repo ? load() : (view = 'connect')));
	});

	// When a new screen replaces the control that had focus, keyboard users start from its
	// main control (marked data-focus) instead of the top of the page. Not on the first screen.
	let settled = false;
	$effect(() => {
		const v = view;
		doc;
		if (v === 'boot' || v === 'loading') return;
		if (!settled) return void (settled = true);
		tick().then(() => {
			const active = document.activeElement;
			if (active && active !== document.body) return;
			/** @type {HTMLElement | null} */ (document.querySelector('#main [data-focus]'))?.focus();
		});
	});

	// ── Loading ───────────────────────────────────────────────────────
	/**
	 * @param {import('./lib/doc.svelte.js').SourceFile[]} files
	 * @param {string[]} [skipped]  .json files in the folder that are not named like a language
	 */
	async function open(files, skipped = []) {
		await loadUI();
		const d = new LocaleDoc(files, config.dir, config.source);
		const raw = readDraft();
		const lost = raw ? d.applyDraft(raw) : [];
		const n = d.changeCount();
		const notes = [];
		if (n) notes.push(`Restored ${n} unsent ${n === 1 ? 'edit' : 'edits'} from your last visit.`);
		if (lost.length) notes.push(`The files changed on GitHub since your last visit. Not restored: ${describeLost(lost)}.`);
		if (skipped.length) {
			notes.push(`Skipped ${skipped.join(', ')}: a locale file is named like a language, such as fr.json or pt-BR.json.`);
		}
		// Messages about the previous document, and their buttons, do not carry over.
		dismiss('pinned');
		dismiss();
		// A message that names files or lost edits stays until it is closed.
		if (notes.length) notify(notes.join(' '), 'info', n ? { label: 'Discard', run: () => (discardOpen = true) } : undefined, !!(lost.length || skipped.length));
		const langs = d.langs;
		hidden = focusLang && langs.includes(focusLang) ? langs.filter((l) => l !== d.source && l !== focusLang) : [];
		query = '';
		filter = 'all';
		doc = d;
		view = 'editor';
	}

	/**
	 * "app.title (fr, de), rename a → x, new key n", at most five, then "and N more".
	 * @param {import('./lib/doc.svelte.js').Lost[]} lost
	 */
	function describeLost(lost) {
		/** @type {Map<string, string[]>} */
		const cells = new Map();
		const items = [];
		for (const l of lost) {
			if (!l.lang) items.push(l.to ? `rename ${l.key} → ${l.to}` : `new key ${l.key}`);
			else if (cells.has(l.key)) cells.get(l.key)?.push(l.lang);
			else cells.set(l.key, [l.lang]);
		}
		items.unshift(...[...cells].map(([key, langs]) => `${key} (${langs.join(', ')})`));
		return items.length > 5 ? `${items.slice(0, 5).join(', ')} and ${items.length - 5} more` : items.join(', ');
	}

	async function load() {
		demo = false;
		view = 'loading';
		loadError = '';
		loadUI();
		try {
			const t = auth.token;
			// With no branch given, the folder can only be listed once the default branch is known.
			const [repo, listed] = await Promise.all([
				getRepo(t, config.repo),
				config.branch ? listLocaleFiles(t, config.repo, config.branch, config.dir) : null
			]);
			const b = config.branch || repo.defaultBranch;
			const { files: list, skipped } = listed ?? (await listLocaleFiles(t, config.repo, b, config.dir));
			if (!list.length) throw new Error(`No locale files (such as en.json or pt-BR.json) in ${config.dir} on ${b}.`);
			branch = b;
			canPush = repo.canPush;
			mode = canPush ? config.mode : 'pr';
			const texts = await Promise.all(list.map((f) => readFile(t, config.repo, b, f.path)));
			await open(
				list.map((f, i) => ({ ...f, text: texts[i] })),
				skipped
			);
		} catch (e) {
			if (e.status === 401) {
				clearSession();
				view = 'start';
				notify('Your GitHub session expired. Sign in again.', 'error');
				return;
			}
			loadError = e.message;
			view = 'connect';
		}
	}

	async function openDemo(large = false) {
		// The 3000-key stress test is for development; production builds leave it out.
		large = import.meta.env.DEV && large;
		view = 'loading';
		demo = large ? 'large' : 'demo';
		const files = import.meta.env.DEV && large ? (await import('./lib/demo-large.js')).largeDemoFiles() : (await import('./lib/demo.js')).demoFiles;
		canPush = true;
		mode = 'pr';
		await open(files);
	}

	function exitDemo() {
		demo = false;
		doc = null;
		history.replaceState(null, '', location.pathname);
		if (!auth.token) view = 'start';
		else if (config.repo) load();
		else view = 'connect';
	}

	/** @param {{ repo: string, branch: string, dir: string }} v */
	function connect(v) {
		saveConfig(v);
		settingsOpen = false;
		load();
	}

	function handleSignOut() {
		clearSession();
		dismiss('pinned');
		doc = null;
		view = 'start';
	}

	// ── Drafts and leaving the page ───────────────────────────────────
	function readDraft() {
		try {
			return JSON.parse(localStorage.getItem(draftKey()) || 'null');
		} catch {
			return null;
		}
	}

	let edits = $derived(doc ? doc.changeCount() : 0);
	let fileCount = $derived(doc && edits ? Object.keys(doc.edits()).length : 0);
	let draftSaved = $state(false);

	// Unsent edits are kept per repository, branch and folder, so a closed tab
	// or a dead phone battery does not lose a translator's work.
	$effect(() => {
		if (!doc || view !== 'editor') return;
		const d = doc;
		d.edits();
		const key = draftKey();
		const n = edits;
		const id = setTimeout(() => {
			try {
				if (n) localStorage.setItem(key, JSON.stringify({ ...d.toDraft(), savedAt: Date.now() }));
				else localStorage.removeItem(key);
				draftSaved = !!n;
			} catch {
				draftSaved = false;
			}
		}, 400);
		return () => clearTimeout(id);
	});

	$effect(() => {
		if (!edits) return;
		/** @param {BeforeUnloadEvent} e */
		const guard = (e) => e.preventDefault();
		addEventListener('beforeunload', guard);
		return () => removeEventListener('beforeunload', guard);
	});

	function discard() {
		if (!doc) return;
		try {
			localStorage.removeItem(draftKey());
		} catch {}
		const files = Object.entries(doc.files)
			.filter(([, f]) => f.parsed)
			.map(([lang, f]) => ({ name: `${lang}.json`, path: f.path, sha: f.sha, text: f.parsed?.text ?? '' }));
		const d = new LocaleDoc(files, doc.dir, doc.source);
		doc = d;
		hidden = hidden.filter((l) => d.langs.includes(l));
		discardOpen = false;
		dismiss('pinned');
		notify('Edits discarded.');
	}

	// ── Filtering ─────────────────────────────────────────────────────
	let visibleLangs = $derived(doc ? doc.langs.filter((l) => !hidden.includes(l)) : []);

	// Re-filter when the filter, search or key list changes, but not on every
	// keystroke in a box: a row you are typing into should not vanish.
	let visibleKeys = $derived.by(() => {
		if (!doc) return [];
		const d = doc;
		const keys = d.keys.slice();
		const langs = visibleLangs;
		const q = query.trim().toLowerCase();
		const f = filter;
		refresh;
		return untrack(() =>
			keys.filter((k) => {
				if (f === 'missing' && (d.deleted[k] || !langs.some((l) => d.isMissing(l, k)))) return false;
				if (f === 'edited' && !d.isNewKey(k) && !d.deleted[k] && !langs.some((l) => d.isChanged(l, k))) return false;
				if (!q) return true;
				if (k.toLowerCase().includes(q)) return true;
				return langs.some((l) => d.get(l, k).toLowerCase().includes(q));
			})
		);
	});

	async function nextMissing() {
		if (!doc || !grid) return;
		const d = doc;
		const keys = visibleKeys;
		const targets = visibleLangs.filter((l) => l !== d.source);
		const langs = targets.length ? targets : visibleLangs;
		const active = /** @type {HTMLElement | null} */ (document.activeElement);
		const r0 = active?.dataset?.r ? +active.dataset.r : -1;
		const c0 = active?.dataset?.c ? visibleLangs[+active.dataset.c] : null;
		const order = c0 && langs.includes(c0) ? [c0, ...langs.filter((l) => l !== c0)] : langs;
		for (let i = 1; i <= keys.length; i++) {
			const key = keys[(r0 + i + keys.length) % keys.length];
			if (d.deleted[key]) continue;
			const lang = order.find((l) => d.isMissing(l, key));
			if (lang) return void grid.focusCell(key, lang);
		}
		notify(`Nothing missing in ${langs.map(languageName).join(', ')}.`, 'success');
	}

	/** @param {KeyboardEvent} e */
	function onkeydown(e) {
		if (view !== 'editor' || e.defaultPrevented) return;
		const t = /** @type {HTMLElement} */ (e.target);
		const typing = t.matches('input, textarea, select, [contenteditable]');
		if (e.key === '/' && !typing) {
			e.preventDefault();
			searchEl?.focus();
		} else if (e.altKey && e.code === 'KeyN') {
			e.preventDefault();
			nextMissing();
		}
	}

	/** @param {string} key */
	async function afterKey(key) {
		query = '';
		filter = 'all';
		refresh++;
		await tick();
		const d = doc;
		if (!d) return;
		const lang = d.isMissing(d.source, key) ? d.source : visibleLangs.find((l) => l !== d.source) || d.source;
		grid?.focusCell(key, lang);
	}

	/** @param {string} lang */
	async function afterLang(lang) {
		hidden = hidden.filter((l) => l !== lang);
		notify(`${languageName(lang)} added. Its file is created when you send.`, 'success');
		await tick();
		const d = doc;
		const key = d && visibleKeys.find((k) => !d.deleted[k] && d.isMissing(lang, k));
		if (key) grid?.focusCell(key, lang);
	}

	// ── Sending ───────────────────────────────────────────────────────
	/** @param {{ mode: 'pr' | 'commit', title: string, body: string, files: import('./lib/doc.svelte.js').OutFile[] }} o */
	async function send(o) {
		if (!doc) return;
		sending = true;
		const n = o.files.reduce((s, f) => s + f.changes.length, 0);
		try {
			if (demo) {
				await new Promise((r) => setTimeout(r, 700));
				reviewOpen = false;
				notify(
					`Demo: this would ${o.mode === 'pr' ? 'open a pull request' : 'commit'} with ${n} ${n === 1 ? 'change' : 'changes'}. Nothing was sent.`,
					'success'
				);
				return;
			}
			saveConfig({ mode: o.mode });
			const body = [
				o.body,
				`${n} ${n === 1 ? 'change' : 'changes'} in ${o.files.map((f) => '`' + f.path + '`').join(', ')}.`,
				'Sent from the [svelte-whisper editor](https://shilo.github.io/svelte-whisper/).'
			]
				.filter(Boolean)
				.join('\n\n');
			const result = await submit({
				token: auth.token,
				repo: config.repo,
				branch,
				dir: config.dir,
				mode: o.mode,
				files: o.files.map((f) => ({ path: f.path, text: f.text, sha: f.sha })),
				title: o.title,
				body,
				canPush
			});
			try {
				localStorage.removeItem(draftKey());
			} catch {}
			reviewOpen = false;
			await load();
			if (result.mode === 'pr') {
				notify(`Pull request #${result.number} opened.`, 'success', { label: 'View on GitHub', href: result.url });
			} else {
				notify(`Committed to ${branch}.`, 'success');
			}
		} catch (e) {
			notify(e.message, 'error');
		} finally {
			sending = false;
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="app" class:fill={view === 'editor'}>
	<AppBar
		address={view === 'editor' && !demo ? { repo: config.repo, branch, dir: config.dir } : null}
		demo={!!demo && view === 'editor'}
		onsettings={() => (settingsOpen = true)}
		onsignout={handleSignOut}
		onexitdemo={exitDemo}
	/>

	<main id="main">
		{#if view === 'start'}
			<SignIn ondemo={() => openDemo()} />
		{:else if view === 'connect'}
			<div class="narrow">
				<section class="panel" aria-labelledby="connect-title">
					<header>
						<h1 id="connect-title">Open locale files</h1>
						<p class="hint">Point the editor at the folder that holds one <code>.json</code> file per language.</p>
					</header>
					{#if loadError}
						<p class="load-error" role="alert">{loadError}</p>
					{/if}
					<div class="panel-body">
						<ConnectForm initial={config} onsubmit={connect} />
					</div>
				</section>
				<p class="hint aside">
					Want a quick tour first? <button class="link" onclick={() => openDemo()}>Open the demo</button>.
				</p>
			</div>
		{:else if view === 'editor' && doc && ui}
			<ui.Toolbar
				{doc}
				bind:query
				bind:filter
				bind:hidden
				bind:searchEl
				onnext={nextMissing}
				onaddkey={() => ((renaming = null), (keyOpen = true))}
				onaddlang={() => (langOpen = true)}
			/>
			{#if doc.keys.length === 0}
				<div class="empty">
					<h2>These files have no strings yet.</h2>
					<p class="hint">Add the first key and its {languageName(doc.source)} text.</p>
					<button class="btn solid" onclick={() => ((renaming = null), (keyOpen = true))}><Icon name="plus" size={16} /> Add a key</button>
				</div>
			{:else if visibleKeys.length === 0}
				<div class="empty">
					<h2>
						{#if query}Nothing matches “{query}”.
						{:else if filter === 'missing'}Nothing is missing in the languages shown.
						{:else}No edits yet.{/if}
					</h2>
					<button class="btn" onclick={() => ((query = ''), (filter = 'all'))}>Show all keys</button>
				</div>
			{:else}
				<ui.Grid bind:this={grid} {doc} langs={visibleLangs} keys={visibleKeys} onrename={(k) => ((renaming = k), (keyOpen = true))} />
			{/if}
			<ui.StatusBar {edits} files={fileCount} {draftSaved} ondiscard={() => (discardOpen = true)} onreview={() => (reviewOpen = true)} />
		{:else}
			<div class="skeleton" aria-busy="true">
				<p class="caption" aria-live="polite">
					{#if view === 'loading'}{demo ? 'Opening sample files…' : `Reading ${config.dir} from ${config.repo}${config.branch ? ` on ${config.branch}` : ''}…`}{/if}
				</p>
				{#each { length: 9 } as _, i (i)}
					<div class="sk-row"><span></span><span></span><span></span><span></span></div>
				{/each}
			</div>
		{/if}
	</main>
</div>

{#if doc && ui}
	<ui.KeyDialog bind:open={keyOpen} {doc} {renaming} ondone={afterKey} />
	<ui.LangDialog bind:open={langOpen} {doc} ondone={afterLang} />
	<ui.ReviewDialog
		bind:open={reviewOpen}
		bind:mode
		{doc}
		demo={!!demo}
		{canPush}
		{sending}
		repo={demo ? 'sample/fieldnotes' : config.repo}
		branch={demo ? 'main' : branch}
		onsend={send}
	/>
	<Dialog bind:open={discardOpen} title="Discard all edits?">
		<p>
			{edits}
			{edits === 1 ? 'edit' : 'edits'} will be thrown away and the files go back to how they are on {demo ? 'the sample' : branch}. This
			cannot be undone.
		</p>
		{#snippet footer()}
			<button class="btn" onclick={() => (discardOpen = false)}>Keep editing</button>
			<button class="btn danger" onclick={discard}><Icon name="trash" size={16} /> Discard edits</button>
		{/snippet}
	</Dialog>
{/if}

<Dialog bind:open={settingsOpen} title={demo ? 'Demo settings' : 'Repository'}>
	{#if doc}
		<div class="field">
			<label class="caption" for="s-source">Source language</label>
			<select
				id="s-source"
				class="input"
				value={doc.source}
				onchange={(e) => {
					doc?.setSource(e.currentTarget.value);
					saveConfig({ source: e.currentTarget.value });
				}}
			>
				{#each doc.langs as l (l)}<option value={l}>{languageName(l)} ({l})</option>{/each}
			</select>
			<p class="hint">Other languages are checked against its placeholders.</p>
		</div>
	{/if}
	{#if demo}
		<p class="hint">The demo uses built-in sample files. Sign in to open your own repository.</p>
		<button class="btn" onclick={() => ((settingsOpen = false), exitDemo())}>Exit demo</button>
	{:else}
		{#if doc}<hr />{/if}
		{#if doc && edits}
			<p class="hint">Your {edits} unsent {edits === 1 ? 'edit stays' : 'edits stay'} saved as a draft for {config.repo} if you switch.</p>
		{/if}
		<ConnectForm initial={config} submitLabel="Open these files" onsubmit={connect} />
		<hr />
		<button class="btn quiet danger" onclick={() => ((settingsOpen = false), handleSignOut())}><Icon name="out" size={16} /> Sign out</button>
	{/if}
</Dialog>

<Toast />

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}
	.app.fill {
		height: 100dvh;
	}
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.narrow {
		width: min(34rem, 100%);
		margin: 0 auto;
		padding: clamp(1.5rem, 6vw, 4rem) 1rem 3rem;
		display: grid;
		gap: 1rem;
	}
	.panel {
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius);
		background: var(--field);
	}
	.panel > header {
		display: grid;
		gap: 0.25rem;
		padding: 1rem 1.25rem;
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.panel h1 {
		font-size: var(--t-lg);
	}
	.panel-body {
		padding: 1.25rem;
	}
	.load-error {
		padding: 0.75rem 1.25rem;
		background: var(--alert-wash);
		border-bottom: 1px solid var(--alert);
		color: var(--alert);
	}
	.aside {
		text-align: center;
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--form-ink);
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}
	.empty {
		flex: 1;
		display: grid;
		gap: 0.75rem;
		align-content: center;
		justify-items: center;
		padding: 3rem 1rem;
		text-align: center;
	}
	.empty h2 {
		font-size: var(--t-lg);
	}
	hr {
		width: 100%;
		border: 0;
		border-top: 1px dashed var(--rule-strong);
		margin: 0;
	}
	.skeleton {
		padding: 0.75rem;
	}
	.skeleton .caption {
		min-height: 1.75rem;
	}
	.sk-row {
		display: grid;
		grid-template-columns: 14rem repeat(3, 1fr);
		border-bottom: 1px solid var(--rule);
	}
	.sk-row span {
		height: 2.75rem;
		border-right: 1px solid var(--rule);
		background: var(--field);
		animation: breathe 1.4s ease-in-out infinite alternate;
	}
	.sk-row span:first-child {
		background: var(--paper-2);
	}
	@keyframes breathe {
		to {
			opacity: 0.55;
		}
	}
	@media (max-width: 47.99rem) {
		.sk-row {
			grid-template-columns: 1fr;
			margin-bottom: 0.75rem;
			border: 1px solid var(--rule);
		}
		.sk-row span + span {
			display: none;
		}
	}
</style>
