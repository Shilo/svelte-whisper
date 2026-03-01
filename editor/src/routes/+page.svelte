<script>
	import { get } from 'svelte/store';
	import { githubConfig, translationsConfig, authStore } from '$lib/store.js';
	import { fetchTree, fetchFileContent, submitTranslations } from '$lib/github.js';
	import { startDeviceFlow, cancelDeviceFlow, signInWithPat, signOut, openPatCreationPage, isOAuthConfigured } from '$lib/auth.js';
	import Snackbar from '$lib/components/Snackbar.svelte';

	// ── Reactive store mirrors ──────────────────────────────────────
	let auth = $state($authStore);
	authStore.subscribe(v => auth = v);

	let cfg = $state($githubConfig);
	githubConfig.subscribe(v => cfg = v);

	let localesCfg = $state($translationsConfig);
	translationsConfig.subscribe(v => localesCfg = v);

	// ── UI state ────────────────────────────────────────────────────
	let showPatForm   = $state(false);
	let patInput      = $state('');
	let isSettingsOpen = $state(false);
	let editorLoaded  = $state(false);
	let editorLoading = $state(false);

	// Editor data
	let locales       = $state({});
	let languages     = $state([]);
	let keys          = $state([]);
	let pendingChanges = $state(false);
	let selectedLangs = $state([]);

	// Snackbar
	let snackVisible  = $state(false);
	let snackMessage  = $state('');
	let snackVariant  = $state('default');
	let snackAction   = $state(null);
	let snackActionLabel = $state('');

	// Settings form values (mirrors cfg so changes can be saved/cancelled)
	let settingsRepo        = $state('');
	let settingsBranch      = $state('');
	let settingsLocalesPath = $state('');
	let settingsSubmitMode  = $state('pr');

	// ── Derived view ────────────────────────────────────────────────
	let view = $derived.by(() => {
		if (!auth.token) {
			if (auth.flowState === 'device-pending' || auth.flowState === 'polling') return 'device-pending';
			if (auth.flowState === 'error') return showPatForm ? 'pat' : 'auth';
			if (showPatForm) return 'pat';
			return 'auth';
		}
		if (editorLoading) return 'loading';
		if (editorLoaded)  return 'editor';
		return 'setup';
	});

	// Auto-load if token + repo already known
	$effect(() => {
		if (auth.token && cfg.repo && !editorLoaded && !editorLoading) {
			loadLocales();
		}
	});

	// ── Helpers ─────────────────────────────────────────────────────
	function showSnack(message, variant = 'default', actionLabel = '', actionFn = null) {
		snackMessage     = message;
		snackVariant     = variant;
		snackActionLabel = actionLabel;
		snackAction      = actionFn;
		snackVisible     = true;
	}

	// ── Auth handlers ────────────────────────────────────────────────
	async function handleGitHubSignIn() {
		try {
			await startDeviceFlow();
		} catch (e) {
			showSnack(e.message, 'error');
		}
	}

	function handlePatSignIn() {
		if (!patInput.trim()) {
			showSnack('Please enter a token.', 'error');
			return;
		}
		signInWithPat(patInput);
		patInput = '';
		showPatForm = false;
	}

	function handleSignOut() {
		signOut();
		editorLoaded  = false;
		locales       = {};
		languages     = [];
		keys          = [];
		pendingChanges = false;
	}

	function copyUserCode() {
		navigator.clipboard?.writeText(auth.userCode || '');
		showSnack('Code copied!');
	}

	// ── Editor handlers ──────────────────────────────────────────────
	async function loadLocales() {
		editorLoading = true;
		try {
			const tree       = await fetchTree(cfg.branch);
			const locPath    = localesCfg.localesPath;
			const files      = tree.filter(t => t.path.startsWith(locPath + '/') && t.path.endsWith('.json'));

			if (files.length === 0) throw new Error(`No JSON files found in ${locPath}`);

			const newLocales  = {};
			const newLangs    = [];
			const allKeys     = new Set();

			for (const file of files) {
				const lang = file.path.replace(locPath + '/', '').replace('.json', '');
				newLangs.push(lang);
				const content = await fetchFileContent(file.sha);
				newLocales[lang] = { path: file.path, content };
				Object.keys(content).forEach(k => allKeys.add(k));
			}

			locales       = newLocales;
			languages     = newLangs.sort();
			keys          = Array.from(allKeys).sort();
			selectedLangs = [...languages];
			editorLoaded  = true;
			pendingChanges = false;
		} catch (e) {
			showSnack(e.message, 'error');
		} finally {
			editorLoading = false;
		}
	}

	function handleSetup() {
		let repo = cfg.repo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/$/, '');
		githubConfig.update(v => ({ ...v, repo, branch: cfg.branch.trim() }));
		translationsConfig.update(v => ({ ...v, localesPath: localesCfg.localesPath.trim() }));
		loadLocales();
	}

	function updateTranslation(lang, key, value) {
		if (locales[lang]) {
			locales[lang].content[key] = value;
			pendingChanges = true;
		}
	}

	async function handleSubmit() {
		if (!pendingChanges) return;
		editorLoading = true;
		try {
			const filesData = languages.map(lang => ({
				path:    locales[lang].path,
				content: locales[lang].content
			}));
			const mode   = cfg.submitMode;
			const branch = cfg.branch;
			const msg    = mode === 'pr'
				? 'chore(i18n): update translations'
				: 'chore(i18n): update translations via editor';

			const result = await submitTranslations(filesData, msg, mode, branch);
			pendingChanges = false;

			if (result.mode === 'pr') {
				showSnack(`PR #${result.prNumber} created!`, 'success', 'Open PR', () => window.open(result.prUrl, '_blank'));
			} else {
				showSnack('Changes committed directly to branch.', 'success');
			}
		} catch (e) {
			showSnack(e.message, 'error');
		} finally {
			editorLoading = false;
		}
	}

	function openSettings() {
		settingsRepo        = cfg.repo;
		settingsBranch      = cfg.branch;
		settingsLocalesPath = localesCfg.localesPath;
		settingsSubmitMode  = cfg.submitMode;
		isSettingsOpen      = true;
	}

	function saveSettings() {
		const repo = settingsRepo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/$/, '');
		githubConfig.update(v => ({ ...v, repo, branch: settingsBranch.trim(), submitMode: settingsSubmitMode }));
		translationsConfig.update(v => ({ ...v, localesPath: settingsLocalesPath.trim() }));
		isSettingsOpen = false;
		// Reload if repo/branch changed
		editorLoaded = false;
		loadLocales();
	}

	function toggleLang(lang) {
		if (selectedLangs.includes(lang)) {
			if (selectedLangs.length > 1) selectedLangs = selectedLangs.filter(l => l !== lang);
		} else {
			selectedLangs = [...selectedLangs, lang];
		}
	}

	const visibleLangs = $derived(languages.filter(l => selectedLangs.includes(l)));

	// Avatar fallback: first letter of login
	const avatarLetter = $derived(auth.userLogin ? auth.userLogin[0].toUpperCase() : '?');
</script>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- TOP APP BAR                                                     -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<header class="top-bar">
	<div class="top-bar__leading">
		{#if view === 'editor'}
			<button class="icon-btn" aria-label="Settings" onclick={openSettings}>
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
			</button>
		{/if}
	</div>

	<span class="top-bar__title">Localization Editor</span>

	<div class="top-bar__trailing">
		{#if auth.token}
			{#if auth.userAvatar}
				<img src={auth.userAvatar} alt={auth.userLogin || 'User'} class="avatar-img" />
			{:else}
				<div class="avatar-letter">{avatarLetter}</div>
			{/if}
			<button class="icon-btn" aria-label="Sign out" onclick={handleSignOut} title="Sign out">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
			</button>
		{/if}
	</div>
</header>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- MAIN CONTENT                                                    -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<main class="main">

	<!-- ── AUTH VIEW ──────────────────────────────────────────────── -->
	{#if view === 'auth'}
	<div class="center-page">
		<div class="auth-card">
			<!-- App icon -->
			<div class="auth-card__icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="12" y1="7" x2="12" y2="13"/></svg>
			</div>

			<h1 class="auth-card__title">Sign in to contribute</h1>
			<p class="auth-card__subtitle">Edit translation files and submit a pull request for review — no coding required.</p>

			{#if isOAuthConfigured()}
				<button class="btn-filled btn--full" onclick={handleGitHubSignIn}>
					<!-- GitHub icon -->
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
					Sign in with GitHub
				</button>

				<div class="auth-divider">
					<span>or</span>
				</div>
			{/if}

			<button class="btn-text" onclick={() => showPatForm = true}>
				Use a Personal Access Token
			</button>
		</div>
	</div>

	<!-- ── DEVICE FLOW VIEW ───────────────────────────────────────── -->
	{:else if view === 'device-pending'}
	<div class="center-page">
		<div class="auth-card">
			<div class="auth-card__icon auth-card__icon--tertiary">
				<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
			</div>

			<h2 class="auth-card__title">Approve on GitHub</h2>
			<p class="auth-card__subtitle">Enter the code below at the GitHub approval page.</p>

			<!-- User code display -->
			<div class="device-code-wrap">
				<span class="device-code">{auth.userCode || '——————'}</span>
				<button class="icon-btn device-code__copy" aria-label="Copy code" onclick={copyUserCode}>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
				</button>
			</div>

			<!-- Polling indicator -->
			{#if auth.flowState === 'polling'}
			<div class="device-polling">
				<div class="spinner"></div>
				<span>Waiting for approval…</span>
			</div>
			{/if}

			{#if auth.errorMessage}
			<p class="auth-error">{auth.errorMessage}</p>
			{/if}

			<div class="auth-card__actions">
				<button class="btn-outlined btn--full" onclick={() => window.open(auth.verificationUri || 'https://github.com/login/device', '_blank')}>
					Open GitHub
				</button>
				<button class="btn-text" onclick={cancelDeviceFlow}>
					Cancel
				</button>
			</div>
		</div>
	</div>

	<!-- ── PAT VIEW ───────────────────────────────────────────────── -->
	{:else if view === 'pat'}
	<div class="center-page">
		<div class="auth-card">
			<div class="auth-card__icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
			</div>

			<h2 class="auth-card__title">Personal Access Token</h2>
			<p class="auth-card__subtitle">
				Generate a token with <code>repo</code> scope on GitHub, then paste it below.
			</p>

			<div class="field">
				<label class="field__label" for="pat-input">GitHub Token</label>
				<input
					id="pat-input"
					class="field__input"
					type="password"
					bind:value={patInput}
					placeholder="ghp_…"
					onkeydown={(e) => e.key === 'Enter' && handlePatSignIn()}
				/>
				<span class="field__helper">Stored in your browser's session only.</span>
			</div>

			<div class="auth-card__actions">
				<button class="btn-filled btn--full" onclick={handlePatSignIn}>Connect</button>
				<button class="btn-text" onclick={openPatCreationPage}>
					Create a token on GitHub ↗
				</button>
				<button class="btn-text" onclick={() => { showPatForm = false; authStore.update(s => ({ ...s, flowState: 'idle', errorMessage: null })); }}>
					← Back
				</button>
			</div>
		</div>
	</div>

	<!-- ── SETUP VIEW ─────────────────────────────────────────────── -->
	{:else if view === 'setup'}
	<div class="center-page">
		<div class="auth-card">
			{#if auth.userLogin}
			<div class="setup-user">
				{#if auth.userAvatar}
					<img src={auth.userAvatar} alt={auth.userLogin} class="setup-avatar" />
				{/if}
				<span class="setup-username">Signed in as <strong>{auth.userLogin}</strong></span>
			</div>
			{/if}

			<h2 class="auth-card__title">Connect a Repository</h2>
			<p class="auth-card__subtitle">Enter the details of the repo you want to translate.</p>

			<div class="field">
				<label class="field__label" for="setup-repo">Repository</label>
				<input id="setup-repo" class="field__input" type="text" bind:value={cfg.repo} placeholder="owner/repo" />
				<span class="field__helper">e.g. Shilocity/svelte-whisper</span>
			</div>

			<div class="field">
				<label class="field__label" for="setup-branch">Branch</label>
				<input id="setup-branch" class="field__input" type="text" bind:value={cfg.branch} placeholder="main" />
			</div>

			<div class="field">
				<label class="field__label" for="setup-locales">Locales path</label>
				<input id="setup-locales" class="field__input" type="text" bind:value={localesCfg.localesPath} placeholder="src/locales" />
				<span class="field__helper">Folder containing your .json locale files</span>
			</div>

			<button class="btn-filled btn--full" onclick={handleSetup}>
				Load Translations
			</button>
		</div>
	</div>

	<!-- ── LOADING VIEW ───────────────────────────────────────────── -->
	{:else if view === 'loading'}
	<div class="center-page">
		<div class="loading-wrap">
			<div class="spinner spinner--large"></div>
			<p class="loading-text">Loading translations…</p>
		</div>
	</div>

	<!-- ── EDITOR VIEW ────────────────────────────────────────────── -->
	{:else if view === 'editor'}

	<!-- Language filter chips -->
	<div class="chip-bar">
		{#each languages as lang}
			<button
				class="chip"
				class:chip--selected={selectedLangs.includes(lang)}
				onclick={() => toggleLang(lang)}
			>
				{lang}
			</button>
		{/each}
	</div>

	<!-- Desktop table (md+) -->
	<div class="table-wrap hidden md:block">
		<div class="overflow-x-auto custom-scrollbar">
			<table class="trans-table">
				<thead>
					<tr>
						<th class="trans-table__key-header">Key</th>
						{#each visibleLangs as lang}
							<th class="trans-table__lang-header">{lang}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each keys as key}
						<tr class="trans-table__row">
							<td class="trans-table__key">{key}</td>
							{#each visibleLangs as lang}
								<td class="trans-table__cell">
									<textarea
										class="trans-table__textarea"
										value={locales[lang]?.content[key] ?? ''}
										oninput={(e) => updateTranslation(lang, key, e.target.value)}
										placeholder="Missing…"
									></textarea>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if keys.length === 0}
			<div class="empty-state">
				<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-40"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
				<p>No translation keys found in <code>{localesCfg.localesPath}</code></p>
			</div>
		{/if}
	</div>

	<!-- Mobile card list (< md) -->
	<div class="card-list md:hidden">
		{#each keys as key}
			<div class="key-card">
				<div class="key-card__key">{key}</div>
				{#each visibleLangs as lang}
					<div class="key-card__field">
						<span class="key-card__lang">{lang}</span>
						<textarea
							class="key-card__textarea"
							value={locales[lang]?.content[key] ?? ''}
							oninput={(e) => updateTranslation(lang, key, e.target.value)}
							placeholder="Missing…"
						></textarea>
					</div>
				{/each}
			</div>
		{/each}
		{#if keys.length === 0}
			<div class="empty-state">
				<p>No translation keys found.</p>
			</div>
		{/if}
	</div>

	{/if}
</main>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- EXTENDED FAB                                                    -->
<!-- ═══════════════════════════════════════════════════════════════ -->
{#if view === 'editor'}
<button
	class="fab"
	class:fab--disabled={!pendingChanges || editorLoading}
	disabled={!pendingChanges || editorLoading}
	onclick={handleSubmit}
	aria-label={cfg.submitMode === 'pr' ? 'Create Pull Request' : 'Commit Changes'}
>
	{#if editorLoading}
		<div class="spinner spinner--sm spinner--on-primary"></div>
		<span>Working…</span>
	{:else if cfg.submitMode === 'pr'}
		<!-- Merge / PR icon -->
		<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
		<span>Create PR</span>
	{:else}
		<!-- Commit icon -->
		<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>
		<span>Commit</span>
	{/if}
</button>
{/if}

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SETTINGS PANEL                                                  -->
<!-- ═══════════════════════════════════════════════════════════════ -->
{#if isSettingsOpen}
<!-- Backdrop -->
<div class="settings-backdrop" onclick={() => isSettingsOpen = false} aria-hidden="true"></div>

<!-- Panel -->
<div class="settings-panel" role="dialog" aria-modal="true" aria-label="Settings">
	<div class="settings-panel__handle" aria-hidden="true"></div>

	<h2 class="settings-panel__title">Settings</h2>

	<div class="field">
		<label class="field__label" for="s-repo">Repository</label>
		<input id="s-repo" class="field__input" type="text" bind:value={settingsRepo} placeholder="owner/repo" />
	</div>

	<div class="field">
		<label class="field__label" for="s-branch">Branch</label>
		<input id="s-branch" class="field__input" type="text" bind:value={settingsBranch} placeholder="main" />
	</div>

	<div class="field">
		<label class="field__label" for="s-locales">Locales path</label>
		<input id="s-locales" class="field__input" type="text" bind:value={settingsLocalesPath} placeholder="src/locales" />
	</div>

	<fieldset class="settings-panel__fieldset">
		<legend class="field__label">Submit mode</legend>
		<label class="radio-label">
			<input type="radio" bind:group={settingsSubmitMode} value="pr" />
			<span>
				<strong>Create Pull Request</strong>
				<span class="radio-desc">Recommended — submits for review before merging</span>
			</span>
		</label>
		<label class="radio-label">
			<input type="radio" bind:group={settingsSubmitMode} value="direct" />
			<span>
				<strong>Push directly</strong>
				<span class="radio-desc">For repo owners — commits straight to branch</span>
			</span>
		</label>
	</fieldset>

	<div class="settings-panel__actions">
		<button class="btn-filled" onclick={saveSettings}>Save &amp; Reload</button>
		<button class="btn-text" onclick={() => isSettingsOpen = false}>Cancel</button>
	</div>

	<div class="settings-panel__footer">
		<button class="btn-text btn--danger" onclick={handleSignOut}>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
			Sign out
		</button>
	</div>
</div>
{/if}

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SNACKBAR                                                        -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<Snackbar
	bind:visible={snackVisible}
	message={snackMessage}
	variant={snackVariant}
	actionLabel={snackActionLabel}
	onaction={snackAction}
/>

<style>
/* ── Layout ────────────────────────────────────────────────────── */
.top-bar {
	position: sticky;
	top: 0;
	z-index: 10;
	display: flex;
	align-items: center;
	height: 64px;
	padding: 0 4px 0 4px;
	background-color: var(--md-sys-color-surface-container);
	border-bottom: 1px solid var(--md-sys-color-outline-variant);
}
.top-bar__leading  { display: flex; align-items: center; width: 56px; }
.top-bar__trailing { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.top-bar__title {
	flex: 1;
	text-align: center;
	font-size: 22px;
	font-weight: 400;
	letter-spacing: 0;
	color: var(--md-sys-color-on-surface);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.main {
	min-height: calc(100vh - 64px);
	padding-bottom: 96px;
}

/* ── Center page layout (auth/setup/loading) ────────────────────── */
.center-page {
	display: flex;
	align-items: flex-start;
	justify-content: center;
	padding: 32px 16px;
	min-height: calc(100vh - 64px);
}

/* ── Auth card ──────────────────────────────────────────────────── */
.auth-card {
	width: 100%;
	max-width: 400px;
	background: var(--md-sys-color-surface-container-low);
	border-radius: 28px;
	padding: 32px 24px;
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.auth-card__icon {
	width: 64px;
	height: 64px;
	border-radius: 50%;
	background: var(--md-sys-color-primary-container);
	color: var(--md-sys-color-on-primary-container);
	display: flex;
	align-items: center;
	justify-content: center;
	margin: 0 auto 8px;
}
.auth-card__icon--tertiary {
	background: var(--md-sys-color-tertiary-container);
	color: var(--md-sys-color-on-tertiary-container);
}
.auth-card__title {
	font-size: 24px;
	font-weight: 400;
	color: var(--md-sys-color-on-surface);
	text-align: center;
	margin: 0;
}
.auth-card__subtitle {
	font-size: 14px;
	color: var(--md-sys-color-on-surface-variant);
	text-align: center;
	margin: 0;
	line-height: 1.5;
}
.auth-card__actions {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 8px;
}

/* ── Buttons (MD3) ──────────────────────────────────────────────── */
.btn-filled {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	background: var(--md-sys-color-primary);
	color: var(--md-sys-color-on-primary);
	border: none;
	border-radius: 20px;
	padding: 10px 24px;
	font-size: 14px;
	font-weight: 500;
	letter-spacing: 0.1px;
	cursor: pointer;
	min-height: 40px;
	transition: box-shadow 0.2s, filter 0.15s;
}
.btn-filled:hover  { filter: brightness(1.08); box-shadow: 0 1px 3px rgba(0,0,0,.3); }
.btn-filled:active { filter: brightness(0.95); }
.btn-filled:disabled { opacity: 0.38; cursor: not-allowed; }

.btn-outlined {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	background: transparent;
	color: var(--md-sys-color-primary);
	border: 1px solid var(--md-sys-color-outline);
	border-radius: 20px;
	padding: 10px 24px;
	font-size: 14px;
	font-weight: 500;
	letter-spacing: 0.1px;
	cursor: pointer;
	min-height: 40px;
	transition: background 0.15s;
}
.btn-outlined:hover { background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent); }

.btn-text {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	background: transparent;
	color: var(--md-sys-color-primary);
	border: none;
	border-radius: 20px;
	padding: 10px 12px;
	font-size: 14px;
	font-weight: 500;
	letter-spacing: 0.1px;
	cursor: pointer;
	min-height: 40px;
	transition: background 0.15s;
}
.btn-text:hover { background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent); }
.btn--full  { width: 100%; }
.btn--danger { color: var(--md-sys-color-error); }
.btn--danger:hover { background: color-mix(in srgb, var(--md-sys-color-error) 8%, transparent); }

/* ── Icon button ────────────────────────────────────────────────── */
.icon-btn {
	width: 48px;
	height: 48px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	border-radius: 50%;
	color: var(--md-sys-color-on-surface-variant);
	cursor: pointer;
	transition: background 0.15s;
}
.icon-btn:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent); }

/* ── Avatar ─────────────────────────────────────────────────────── */
.avatar-img {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	object-fit: cover;
}
.avatar-letter {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	background: var(--md-sys-color-primary-container);
	color: var(--md-sys-color-on-primary-container);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 14px;
	font-weight: 500;
}

/* ── Auth divider ───────────────────────────────────────────────── */
.auth-divider {
	display: flex;
	align-items: center;
	gap: 12px;
	color: var(--md-sys-color-outline);
	font-size: 12px;
}
.auth-divider::before,
.auth-divider::after {
	content: '';
	flex: 1;
	height: 1px;
	background: var(--md-sys-color-outline-variant);
}

/* ── Device code ────────────────────────────────────────────────── */
.device-code-wrap {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	background: var(--md-sys-color-surface-container-highest);
	border-radius: 12px;
	padding: 16px;
	margin: 4px 0;
}
.device-code {
	font-family: 'Roboto Mono', ui-monospace, monospace;
	font-size: 28px;
	font-weight: 500;
	letter-spacing: 0.25em;
	color: var(--md-sys-color-on-surface);
}
.device-code__copy {
	color: var(--md-sys-color-on-surface-variant);
	width: 36px;
	height: 36px;
}

/* Polling indicator */
.device-polling {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	color: var(--md-sys-color-on-surface-variant);
	font-size: 13px;
}

.auth-error {
	color: var(--md-sys-color-error);
	font-size: 13px;
	text-align: center;
	margin: 0;
}

/* ── Setup user display ─────────────────────────────────────────── */
.setup-user {
	display: flex;
	align-items: center;
	gap: 10px;
	justify-content: center;
	padding-bottom: 4px;
}
.setup-avatar {
	width: 36px;
	height: 36px;
	border-radius: 50%;
}
.setup-username {
	font-size: 14px;
	color: var(--md-sys-color-on-surface-variant);
}

/* ── Loading ────────────────────────────────────────────────────── */
.loading-wrap {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20px;
	padding-top: 80px;
}
.loading-text {
	color: var(--md-sys-color-on-surface-variant);
	font-size: 16px;
}

/* ── Spinner ────────────────────────────────────────────────────── */
.spinner {
	width: 24px;
	height: 24px;
	border: 2.5px solid var(--md-sys-color-primary-container);
	border-top-color: var(--md-sys-color-primary);
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}
.spinner--large { width: 48px; height: 48px; border-width: 4px; }
.spinner--sm    { width: 18px; height: 18px; border-width: 2px; }
.spinner--on-primary {
	border-color: color-mix(in srgb, var(--md-sys-color-on-primary) 30%, transparent);
	border-top-color: var(--md-sys-color-on-primary);
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Field (MD3 filled) ─────────────────────────────────────────── */
.field {
	display: flex;
	flex-direction: column;
	gap: 0;
}
.field__label {
	font-size: 12px;
	font-weight: 500;
	color: var(--md-sys-color-primary);
	padding: 8px 16px 0;
	letter-spacing: 0.4px;
}
.field__input {
	background: var(--md-sys-color-surface-container-highest);
	border: none;
	border-bottom: 1px solid var(--md-sys-color-on-surface-variant);
	border-radius: 4px 4px 0 0;
	padding: 8px 16px 12px;
	font-family: inherit;
	font-size: 16px;
	color: var(--md-sys-color-on-surface);
	outline: none;
	transition: border-bottom-width 0.1s;
	width: 100%;
	box-sizing: border-box;
}
.field__input:focus {
	border-bottom: 2px solid var(--md-sys-color-primary);
}
.field__input::placeholder {
	color: var(--md-sys-color-on-surface-variant);
}
.field__helper {
	font-size: 12px;
	color: var(--md-sys-color-on-surface-variant);
	padding: 4px 16px 0;
	letter-spacing: 0.4px;
}
code {
	font-family: 'Roboto Mono', ui-monospace, monospace;
	font-size: 0.9em;
	background: var(--md-sys-color-surface-container-highest);
	padding: 1px 5px;
	border-radius: 4px;
}

/* ── Chip bar ───────────────────────────────────────────────────── */
.chip-bar {
	display: flex;
	gap: 8px;
	padding: 12px 16px;
	overflow-x: auto;
	scrollbar-width: none;
}
.chip-bar::-webkit-scrollbar { display: none; }

.chip {
	display: inline-flex;
	align-items: center;
	height: 32px;
	padding: 0 16px;
	border-radius: 8px;
	font-size: 14px;
	font-weight: 500;
	border: 1px solid var(--md-sys-color-outline);
	background: transparent;
	color: var(--md-sys-color-on-surface-variant);
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.chip--selected {
	background: var(--md-sys-color-secondary-container);
	color: var(--md-sys-color-on-secondary-container);
	border-color: transparent;
}

/* ── Desktop table ──────────────────────────────────────────────── */
.table-wrap {
	margin: 0 16px;
	border-radius: 16px;
	overflow: hidden;
	border: 1px solid var(--md-sys-color-outline-variant);
	background: var(--md-sys-color-surface-container);
}
.trans-table {
	width: 100%;
	border-collapse: collapse;
}
.trans-table__key-header {
	padding: 14px 20px;
	text-align: left;
	font-size: 11px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.8px;
	color: var(--md-sys-color-outline);
	border-right: 1px solid var(--md-sys-color-outline-variant);
	position: sticky;
	left: 0;
	background: var(--md-sys-color-surface-container-high);
	z-index: 2;
	min-width: 200px;
	width: 22%;
}
.trans-table__lang-header {
	padding: 14px 20px;
	text-align: center;
	font-size: 12px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 1px;
	color: var(--md-sys-color-primary);
	border-right: 1px solid var(--md-sys-color-outline-variant);
	min-width: 280px;
	background: var(--md-sys-color-surface-container-high);
}
.trans-table__lang-header:last-child { border-right: none; }
.trans-table thead { border-bottom: 1px solid var(--md-sys-color-outline-variant); }

.trans-table__row { border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.trans-table__row:last-child { border-bottom: none; }
.trans-table__row:hover .trans-table__key {
	color: var(--md-sys-color-primary);
	background: color-mix(in srgb, var(--md-sys-color-surface-container-high) 90%, var(--md-sys-color-primary) 10%);
}

.trans-table__key {
	padding: 12px 20px;
	font-family: 'Roboto Mono', ui-monospace, monospace;
	font-size: 12px;
	color: var(--md-sys-color-on-surface-variant);
	border-right: 1px solid var(--md-sys-color-outline-variant);
	position: sticky;
	left: 0;
	background: var(--md-sys-color-surface-container);
	z-index: 1;
	vertical-align: top;
	word-break: break-all;
	transition: color 0.15s, background 0.15s;
}
.trans-table__cell {
	padding: 0;
	border-right: 1px solid var(--md-sys-color-outline-variant);
	vertical-align: top;
}
.trans-table__cell:last-child { border-right: none; }
.trans-table__textarea {
	width: 100%;
	min-height: 72px;
	padding: 12px 20px;
	background: transparent;
	border: none;
	resize: vertical;
	font-family: inherit;
	font-size: 14px;
	line-height: 1.6;
	color: var(--md-sys-color-on-surface);
	outline: none;
	box-sizing: border-box;
	transition: background 0.15s;
}
.trans-table__textarea::placeholder { color: var(--md-sys-color-outline); }
.trans-table__textarea:focus {
	background: color-mix(in srgb, var(--md-sys-color-primary) 6%, var(--md-sys-color-surface-container));
}

/* Custom scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
.custom-scrollbar::-webkit-scrollbar-track { background: var(--md-sys-color-surface-container); }
.custom-scrollbar::-webkit-scrollbar-thumb {
	background: var(--md-sys-color-surface-container-highest);
	border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--md-sys-color-outline); }

/* Empty state */
.empty-state {
	padding: 64px 24px;
	text-align: center;
	color: var(--md-sys-color-outline);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
	font-size: 15px;
}

/* ── Mobile card list ───────────────────────────────────────────── */
.card-list {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 0 16px 16px;
}
.key-card {
	background: var(--md-sys-color-surface-container-low);
	border-radius: 16px;
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.key-card__key {
	font-family: 'Roboto Mono', ui-monospace, monospace;
	font-size: 12px;
	font-weight: 500;
	color: var(--md-sys-color-primary);
	word-break: break-all;
	padding-bottom: 4px;
	border-bottom: 1px solid var(--md-sys-color-outline-variant);
}
.key-card__field {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.key-card__lang {
	font-size: 11px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.8px;
	color: var(--md-sys-color-on-surface-variant);
}
.key-card__textarea {
	background: var(--md-sys-color-surface-container-highest);
	border: none;
	border-bottom: 1px solid var(--md-sys-color-on-surface-variant);
	border-radius: 4px 4px 0 0;
	padding: 10px 12px;
	font-family: inherit;
	font-size: 14px;
	line-height: 1.5;
	color: var(--md-sys-color-on-surface);
	resize: vertical;
	outline: none;
	min-height: 60px;
	width: 100%;
	box-sizing: border-box;
	transition: border-bottom-width 0.1s;
}
.key-card__textarea::placeholder { color: var(--md-sys-color-outline); }
.key-card__textarea:focus { border-bottom: 2px solid var(--md-sys-color-primary); }

/* ── Extended FAB ───────────────────────────────────────────────── */
.fab {
	position: fixed;
	bottom: 16px;
	right: 16px;
	display: flex;
	align-items: center;
	gap: 12px;
	background: var(--md-sys-color-primary-container);
	color: var(--md-sys-color-on-primary-container);
	border: none;
	border-radius: 16px;
	padding: 16px 20px;
	font-size: 14px;
	font-weight: 500;
	letter-spacing: 0.1px;
	cursor: pointer;
	box-shadow: 0 3px 5px -1px rgba(0,0,0,.3), 0 6px 10px rgba(0,0,0,.2), 0 1px 18px rgba(0,0,0,.15);
	z-index: 10;
	transition: box-shadow 0.2s, filter 0.15s;
}
.fab:hover:not(:disabled) {
	box-shadow: 0 5px 5px -3px rgba(0,0,0,.3), 0 8px 10px 1px rgba(0,0,0,.2), 0 3px 14px 2px rgba(0,0,0,.15);
	filter: brightness(1.05);
}
.fab:active:not(:disabled) { filter: brightness(0.95); }
.fab--disabled { opacity: 0.38; cursor: not-allowed; box-shadow: none; }

@media (min-width: 600px) {
	.fab { bottom: 24px; right: 24px; }
}

/* ── Settings panel ─────────────────────────────────────────────── */
.settings-backdrop {
	position: fixed;
	inset: 0;
	background: rgba(0,0,0,.5);
	z-index: 50;
}
.settings-panel {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	max-height: 90dvh;
	overflow-y: auto;
	background: var(--md-sys-color-surface-container-low);
	border-radius: 28px 28px 0 0;
	padding: 12px 24px 32px;
	z-index: 51;
	display: flex;
	flex-direction: column;
	gap: 16px;
	animation: slide-up-panel 250ms cubic-bezier(0.2, 0, 0, 1);
}
@keyframes slide-up-panel {
	from { transform: translateY(100%); }
	to   { transform: translateY(0); }
}
.settings-panel__handle {
	width: 32px;
	height: 4px;
	border-radius: 2px;
	background: var(--md-sys-color-on-surface-variant);
	opacity: 0.4;
	margin: 0 auto 8px;
}
.settings-panel__title {
	font-size: 22px;
	font-weight: 400;
	color: var(--md-sys-color-on-surface);
	margin: 0;
}
.settings-panel__actions {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	margin-top: 4px;
}
.settings-panel__footer {
	padding-top: 8px;
	border-top: 1px solid var(--md-sys-color-outline-variant);
}
.settings-panel__fieldset {
	border: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.settings-panel__fieldset legend { margin-bottom: 8px; }

.radio-label {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	cursor: pointer;
	font-size: 14px;
	color: var(--md-sys-color-on-surface);
}
.radio-label input[type="radio"] { margin-top: 2px; accent-color: var(--md-sys-color-primary); }
.radio-desc {
	display: block;
	font-size: 12px;
	color: var(--md-sys-color-on-surface-variant);
	margin-top: 2px;
}

/* Desktop: convert panel to centered dialog */
@media (min-width: 600px) {
	.settings-backdrop { background: rgba(0,0,0,.4); backdrop-filter: blur(2px); }
	.settings-panel {
		top: 50%;
		left: 50%;
		right: auto;
		bottom: auto;
		transform: translate(-50%, -50%);
		width: min(480px, calc(100vw - 48px));
		max-height: 85dvh;
		border-radius: 28px;
		animation: dialog-pop 200ms cubic-bezier(0.2, 0, 0, 1);
	}
	.settings-panel__handle { display: none; }
	@keyframes dialog-pop {
		from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
		to   { opacity: 1; transform: translate(-50%, -50%); }
	}
}
</style>
