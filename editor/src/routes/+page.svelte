<script>
	import { get } from 'svelte/store';
	import { githubConfig, translationsConfig } from '$lib/store.js';
	import { fetchTree, fetchFileContent, pushTranslations } from '$lib/github.js';
	
	let config = $state($githubConfig);
	githubConfig.subscribe(val => config = val);

	let uiState = $state({
		loading: false,
		error: null,
		success: null,
		view: config.token && config.repo ? 'editor' : 'setup'
	});

	let locales = $state({});
	let languages = $state([]);
	let keys = $state([]);
	let pendingChanges = $state(false);

	async function loadLocales() {
		uiState.loading = true;
		uiState.error = null;
		uiState.success = null;
		try {
			const tree = await fetchTree(config.branch);
			const localesPath = get(translationsConfig).localesPath;
			
			const localeFiles = tree.filter(t => t.path.startsWith(localesPath + '/') && t.path.endsWith('.json'));
			
			if (localeFiles.length === 0) {
				throw new Error(`No JSON files found in ${localesPath}`);
			}

			const newLocales = {};
			const newLanguages = [];
			const allKeys = new Set();
			
			for (const file of localeFiles) {
				const lang = file.path.replace(localesPath + '/', '').replace('.json', '');
				newLanguages.push(lang);
				
				const content = await fetchFileContent(file.sha);
				newLocales[lang] = { path: file.path, content };
				
				Object.keys(content).forEach(key => allKeys.add(key));
			}

			locales = newLocales;
			languages = newLanguages.sort();
			keys = Array.from(allKeys).sort();
			uiState.view = 'editor';
			pendingChanges = false;
		} catch (e) {
			uiState.error = e.message;
			uiState.view = 'setup';
		} finally {
			uiState.loading = false;
		}
	}

	function handleSetup() {
		githubConfig.set(config);
		loadLocales();
	}

	function updateTranslation(lang, key, value) {
		if (locales[lang]) {
			locales[lang].content[key] = value;
			pendingChanges = true;
		}
	}

	async function commitChanges() {
		uiState.loading = true;
		uiState.error = null;
		uiState.success = null;
		
		try {
			const filesData = languages.map(lang => ({
				path: locales[lang].path,
				content: locales[lang].content
			}));

			await pushTranslations(config.branch, filesData, 'Update translations via Editor');
			uiState.success = "Successfully pushed changes to GitHub.";
			pendingChanges = false;
		} catch (e) {
			uiState.error = e.message;
		} finally {
			uiState.loading = false;
		}
	}
	
	function resetSetup() {
	    uiState.error = null;
	    uiState.success = null;
	    uiState.view = 'setup';
	}
</script>

<main class="min-h-screen p-6 md:p-12 max-w-[1600px] mx-auto">
	<header class="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
		<h1 class="text-3xl font-extrabold bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent drop-shadow-sm">Localization Editor</h1>
		{#if uiState.view === 'editor'}
		<div class="flex gap-4 items-center">
			<button class="px-5 py-2.5 text-sm font-medium bg-surface-variant text-on-surface hover:bg-secondary-container rounded-xl transition-all shadow-sm" onclick={resetSetup}>Settings</button>
			<button 
				class="px-6 py-2.5 bg-primary text-on-primary font-bold rounded-xl shadow-md disabled:opacity-50 disabled:hover:scale-100 transition-all hover:scale-105 active:scale-95"
				disabled={!pendingChanges || uiState.loading}
				onclick={commitChanges}
			>
				{uiState.loading ? 'Saving...' : 'Commit Changes'}
			</button>
		</div>
		{/if}
	</header>

	{#if uiState.error}
		<div class="bg-error/10 border border-error/50 text-error px-5 py-4 rounded-2xl mb-8 flex items-center gap-3 shadow-sm animate-pulse-fade">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="min-w-6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
			<span><strong class="font-bold">Error:</strong> {uiState.error}</span>
		</div>
	{/if}
	
	{#if uiState.success}
		<div class="bg-primary/10 border border-primary/50 text-primary px-5 py-4 rounded-2xl mb-8 flex items-center gap-3 shadow-sm">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="min-w-6"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
			<span class="font-medium">{uiState.success}</span>
		</div>
	{/if}

	{#if uiState.view === 'setup'}
		<div class="max-w-md mx-auto bg-surface-container/50 backdrop-blur-md p-8 md:p-10 rounded-[2rem] shadow-2xl mt-12 md:mt-24 border border-outline/10">
			<h2 class="text-2xl font-bold mb-8 text-center bg-gradient-to-br from-on-surface to-outline bg-clip-text text-transparent">Connect to GitHub</h2>
			<div class="space-y-6">
				<div>
					<label class="block text-sm font-semibold mb-2 text-on-surface/80 uppercase tracking-wider text-xs">Repository (user/repo)</label>
					<input class="w-full bg-background/80 border border-outline/20 rounded-xl px-4 py-3.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm shadow-inner" bind:value={config.repo} placeholder="e.g. Shilocity/svelte-whisper" />
				</div>
				<div>
					<label class="block text-sm font-semibold mb-2 text-on-surface/80 uppercase tracking-wider text-xs">Branch</label>
					<input class="w-full bg-background/80 border border-outline/20 rounded-xl px-4 py-3.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm shadow-inner" bind:value={config.branch} placeholder="main" />
				</div>
				<div>
					<label class="block text-sm font-semibold mb-2 text-on-surface/80 uppercase tracking-wider text-xs">Personal Access Token</label>
					<input class="w-full bg-background/80 border border-outline/20 rounded-xl px-4 py-3.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm shadow-inner" type="password" bind:value={config.token} placeholder="ghp_..." />
					<p class="text-[11px] text-outline mt-3 font-medium">Requires 'repo' scope. Securely stored in your browser.</p>
				</div>
				<button class="w-full bg-primary text-on-primary py-4 rounded-xl font-bold text-lg hover:brightness-110 active:scale-[0.98] transition-all mt-8 shadow-lg shadow-primary/20 flex justify-center items-center gap-2" disabled={uiState.loading} onclick={handleSetup}>
					{#if uiState.loading}
						<svg class="animate-spin h-5 w-5 text-on-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
						Connecting...
					{:else}
						Connect Repository
					{/if}
				</button>
			</div>
		</div>
	{:else}
		<div class="bg-surface-container rounded-[2rem] shadow-2xl overflow-hidden border border-outline/10 backdrop-blur-sm">
			<div class="overflow-x-auto custom-scrollbar">
				<table class="w-full text-left border-collapse">
					<thead>
						<tr class="bg-surface/80 border-b border-outline/10">
							<th class="p-5 font-bold w-1/4 min-w-[200px] border-r border-outline/5 sticky left-0 bg-surface z-10 text-outline text-xs uppercase tracking-wider">Message Key</th>
							{#each languages as lang}
								<th class="p-5 font-bold min-w-[300px] border-r border-outline/5 last:border-r-0 text-center uppercase tracking-[0.2em] text-sm text-primary">{lang}</th>
							{/each}
						</tr>
					</thead>
					<tbody class="divide-y divide-outline/5">
						{#each keys as key}
							<tr class="hover:bg-surface/40 transition-colors group">
								<td class="p-5 border-r border-outline/5 select-all font-mono text-xs md:text-sm text-on-surface/80 sticky left-0 bg-surface-container group-hover:bg-surface/90 group-hover:text-primary transition-colors z-10 w-1/4 align-top break-all">
									<div class="mt-2">{key}</div>
								</td>
								{#each languages as lang}
									<td class="p-0 border-r border-outline/5 last:border-r-0 relative group/cell">
										<textarea 
											class="w-full h-full min-h-[80px] p-5 bg-transparent resize-y outline-none focus:bg-background/80 focus:ring-inset focus:ring-2 focus:ring-primary/50 transition-all font-medium leading-relaxed group-hover/cell:bg-surface-variant/30"
											value={locales[lang]?.content[key] || ''}
											oninput={(e) => updateTranslation(lang, key, e.target.value)}
											placeholder="Missing translation..."
										></textarea>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if keys.length === 0}
			    <div class="p-16 text-center text-outline flex flex-col items-center justify-center gap-4">
			        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-50"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
			        <p class="text-lg">No translation keys found. Make sure your JSON files are in <code class="bg-surface p-1 rounded font-mono text-sm">src/locales</code></p>
			    </div>
			{/if}
		</div>
	{/if}
</main>

<style>
	/* Custom aesthetics for standard webkit scrollbar matching MD3 dark */
	.custom-scrollbar::-webkit-scrollbar {
		width: 10px;
		height: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: var(--md-sys-color-surface-container);
		border-radius: 8px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--md-sys-color-surface-variant);
		border-radius: 8px;
		min-height: 40px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--md-sys-color-outline);
	}
</style>
