<script>
	import { untrack } from 'svelte';
	import { normaliseRepo } from '../session.svelte.js';

	/**
	 * @type {{
	 *   initial: { repo: string, branch: string, dir: string },
	 *   submitLabel?: string,
	 *   busy?: boolean,
	 *   onsubmit: (v: { repo: string, branch: string, dir: string }) => void,
	 *   children?: import('svelte').Snippet
	 * }}
	 */
	let { initial, submitLabel = 'Load files', busy = false, onsubmit, children } = $props();

	// Local copies so that cancelling a dialog leaves the saved settings untouched.
	const start = untrack(() => ({ ...initial }));
	let repo = $state(start.repo);
	let branch = $state(start.branch);
	let dir = $state(start.dir);
	let error = $state('');

	/** @param {SubmitEvent} e */
	function submit(e) {
		e.preventDefault();
		const r = normaliseRepo(repo);
		if (!/^[\w.-]+\/[\w.-]+$/.test(r)) return (error = 'Use the form owner/repository, for example Shilo/svelte-whisper.');
		error = '';
		repo = r;
		onsubmit({ repo: r, branch: branch.trim() || 'main', dir: dir.trim().replace(/^\/+|\/+$/g, '') || 'src/locales' });
	}
</script>

<form class="connect" onsubmit={submit} novalidate>
	<div class="field">
		<label class="caption" for="c-repo">Repository</label>
		<input
			id="c-repo"
			class="input mono"
			bind:value={repo}
			placeholder="owner/repository"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			required
			aria-describedby="c-repo-hint"
			aria-invalid={!!error}
		/>
		<p id="c-repo-hint" class="hint">A GitHub URL works too.</p>
	</div>
	<div class="row">
		<div class="field">
			<label class="caption" for="c-branch">Branch</label>
			<input id="c-branch" class="input mono" bind:value={branch} placeholder="main" autocapitalize="off" spellcheck="false" />
		</div>
		<div class="field">
			<label class="caption" for="c-dir">Locales folder</label>
			<input id="c-dir" class="input mono" bind:value={dir} placeholder="src/locales" autocapitalize="off" spellcheck="false" />
		</div>
	</div>
	{#if error}<p class="error-text" role="alert">{error}</p>{/if}
	{@render children?.()}
	<button class="btn solid submit" disabled={busy}>{busy ? 'Loading…' : submitLabel}</button>
</form>

<style>
	.connect {
		display: grid;
		gap: 1rem;
	}
	.row {
		display: grid;
		gap: 1rem;
	}
	@media (min-width: 30rem) {
		.row {
			grid-template-columns: 1fr 1fr;
		}
	}
	.submit {
		min-height: 2.75rem;
	}
</style>
