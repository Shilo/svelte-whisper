<script>
	import { oauthAvailable, startDeviceFlow, finishSignIn, PAT_URL } from '../auth.js';
	import Icon from './Icon.svelte';

	/** @type {{ ondemo: () => void }} */
	let { ondemo } = $props();

	let showToken = $state(!oauthAvailable);
	let token = $state('');
	let busy = $state(false);
	let error = $state('');
	/** @type {{ userCode: string, verificationUri: string, cancel: () => void } | null} */
	let device = $state(null);
	let copied = $state(false);

	async function github() {
		error = '';
		busy = true;
		try {
			const flow = await startDeviceFlow();
			device = flow;
			flow.done.catch((e) => (error = e.message)).finally(() => (device = null));
		} catch (e) {
			error = e.message;
		} finally {
			busy = false;
		}
	}

	function cancel() {
		device?.cancel();
		device = null;
	}

	/** @param {SubmitEvent} e */
	async function useToken(e) {
		e.preventDefault();
		if (!token.trim()) return (error = 'Paste a token first.');
		error = '';
		busy = true;
		try {
			await finishSignIn(token);
			token = '';
		} catch (err) {
			error = err.status === 401 ? 'GitHub did not accept that token. Check it was copied in full and has not expired.' : err.message;
		} finally {
			busy = false;
		}
	}

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(device?.userCode ?? '');
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* clipboard blocked; the code is visible and selectable */
		}
	}
</script>

<div class="page">
	<section class="intro">
		<h1>Translate a Svelte app without touching JSON.</h1>
		<p>
			Open the locale files of any GitHub repository that uses
			<a href="https://github.com/Shilo/svelte-whisper" target="_blank" rel="noopener noreferrer">svelte-whisper</a>, fill
			in what is missing, and send it back as a pull request. Everything runs in this tab; there is no server.
		</p>
		<figure class="specimen" aria-label="Example: one row per key, one box per language">
			<div class="s-row s-head"><span>Key</span><span><b>en</b> English</span><span><b>fr</b> French</span></div>
			<div class="s-row"><code><i>nav.</i>home</code><span>Home</span><span>Accueil</span></div>
			<div class="s-row"><code>greeting</code><span>Hi, {'{name}'}</span><span class="s-edit">Salut, {'{name}'}</span></div>
			<div class="s-row"><code><i>nav.</i>help</code><span>Help</span><span class="s-miss">Not translated</span></div>
			<figcaption class="hint">
				<span class="m-edit" aria-hidden="true"></span> your edit
				<span class="m-miss" aria-hidden="true"></span> still missing
			</figcaption>
		</figure>
	</section>

	<section class="form" aria-labelledby="signin-title">
		<header>
			<h2 id="signin-title">Sign in with GitHub</h2>
			<p class="hint">Needed to read the files and open a pull request.</p>
		</header>

		{#if device}
			<div class="block device">
				<p>Enter this code on GitHub, then come back here.</p>
				<div class="code">
					<output aria-label="Device code">{device.userCode}</output>
					<button class="btn icon" onclick={copyCode} aria-label={copied ? 'Copied' : 'Copy code'}>
						<Icon name={copied ? 'check' : 'copy'} />
					</button>
				</div>
				<a class="btn solid wide" href={device.verificationUri} target="_blank" rel="noopener noreferrer">
					Open github.com/login/device <Icon name="external" size={16} />
				</a>
				<p class="waiting" aria-live="polite"><span class="pulse" aria-hidden="true"></span>Waiting for approval</p>
				<button class="btn quiet" onclick={cancel}>Cancel</button>
			</div>
		{:else}
			{#if oauthAvailable}
				<div class="block">
					<button class="btn solid wide" onclick={github} disabled={busy}>
						<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
							><path
								d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
							/></svg
						>
						Continue with GitHub
					</button>
					{#if !showToken}
						<button class="btn quiet" onclick={() => (showToken = true)}>Use a personal access token instead</button>
					{/if}
				</div>
			{/if}

			{#if showToken}
				<form class="block" onsubmit={useToken}>
					<div class="field">
						<label class="caption" for="token">Personal access token</label>
						<input
							id="token"
							class="input mono"
							type="password"
							autocomplete="off"
							spellcheck="false"
							placeholder="github_pat_…"
							bind:value={token}
						/>
						<p class="hint">
							<a href={PAT_URL} target="_blank" rel="noopener noreferrer">Create a fine-grained token</a> for the repository
							with <strong>Contents</strong> and <strong>Pull requests</strong> set to read and write.
						</p>
					</div>
					<button class="btn solid wide" disabled={busy}>{busy ? 'Checking…' : 'Sign in with token'}</button>
				</form>
			{/if}
		{/if}

		{#if error}<p class="error-text block-pad" role="alert">{error}</p>{/if}

		<div class="block demo">
			<div>
				<h3>Just looking?</h3>
				<p class="hint">Try the editor on sample files. Nothing is sent anywhere.</p>
			</div>
			<button class="btn" onclick={ondemo}>Open the demo</button>
		</div>

		<footer class="hint">
			Your token stays in this browser tab (session storage), is sent only to api.github.com, and is forgotten when the tab
			closes.
		</footer>
	</section>
</div>

<style>
	.page {
		display: grid;
		gap: 2.5rem;
		align-content: start;
		width: min(64rem, 100%);
		margin: 0 auto;
		padding: clamp(1.5rem, 6vw, 5rem) 1rem 3rem;
	}
	@media (min-width: 52rem) {
		.page {
			grid-template-columns: 1fr 26rem;
			align-items: start;
			gap: 4rem;
		}
	}
	.intro {
		display: grid;
		gap: 1rem;
		max-width: 34rem;
		padding-top: 0.5rem;
	}
	.intro h1 {
		font-size: clamp(var(--t-xl), 4vw, 2.5rem);
		line-height: 1.1;
		letter-spacing: -0.025em;
	}
	.intro p {
		font-size: 1rem;
		line-height: 1.6;
		color: var(--ink-2);
		max-width: 60ch;
	}
	.specimen {
		margin: 0.75rem 0 0;
		border: 1px solid var(--rule-strong);
		background: var(--field);
		font-size: var(--t-ui);
	}
	.s-row {
		display: grid;
		grid-template-columns: 8.5rem 1fr 1fr;
		border-bottom: 1px solid var(--rule);
	}
	.s-row > * {
		position: relative;
		padding: 0.5rem 0.625rem;
		border-right: 1px solid var(--rule);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.s-row > :last-child {
		border-right: 0;
	}
	.s-row code {
		background: var(--paper);
		color: var(--form-ink);
		font-size: var(--t-sm);
		font-weight: 600;
	}
	.s-row i {
		font-style: normal;
		font-weight: 400;
		opacity: 0.72;
	}
	.s-head > * {
		background: var(--paper-2);
		color: var(--ink-2);
		font-size: var(--t-sm);
	}
	.s-head b {
		font: 600 var(--t-sm) var(--mono);
		color: var(--form-ink);
		margin-right: 0.25rem;
	}
	.s-head > :first-child {
		font-size: var(--t-cap);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--form-ink);
	}
	.s-edit::after,
	.m-edit {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 0.625rem;
		height: 0.625rem;
		background: linear-gradient(225deg, var(--air) 50%, transparent 50%);
	}
	.s-miss {
		color: var(--ink-2);
		background: linear-gradient(to right, var(--rule-strong) 40%, transparent 40%) left 0.625rem bottom 0.45rem / 5px 1px repeat-x;
	}
	.specimen figcaption {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.4rem 0.625rem;
		font-size: var(--t-sm);
	}
	.m-edit {
		position: static;
		display: inline-block;
	}
	.m-miss {
		display: inline-block;
		width: 1.25rem;
		height: 0.5rem;
		margin-left: 0.75rem;
		background: linear-gradient(to right, var(--rule-strong) 40%, transparent 40%) left bottom / 5px 1px repeat-x;
	}
	@media (max-width: 30rem) {
		.s-row {
			grid-template-columns: 6.5rem 1fr 1fr;
		}
	}
	.form {
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius);
		background: var(--field);
	}
	.form > header {
		display: grid;
		gap: 0.25rem;
		padding: 1rem 1.25rem;
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.form h2 {
		font-size: var(--t-lg);
	}
	.block {
		display: grid;
		gap: 0.75rem;
		padding: 1.25rem;
		border-bottom: 1px solid var(--rule);
	}
	.block-pad {
		padding: 0.75rem 1.25rem 0;
	}
	.wide {
		width: 100%;
		min-height: 2.75rem;
	}
	.demo {
		grid-template-columns: 1fr auto;
		align-items: center;
		border-bottom: 0;
		border-top: 1px dashed var(--rule-strong);
	}
	.demo h3 {
		font-size: var(--t-body);
	}
	footer {
		padding: 0.875rem 1.25rem;
		border-top: 1px solid var(--rule);
		background: var(--paper);
		font-size: var(--t-cap);
		line-height: 1.5;
	}
	.device p {
		color: var(--ink-2);
	}
	.code {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.5rem 0.5rem 1rem;
		border: 1px dashed var(--rule-strong);
		background: var(--paper);
	}
	.code output {
		font: 600 1.75rem/1.2 var(--mono);
		letter-spacing: 0.12em;
		user-select: all;
	}
	.waiting {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--t-sm);
	}
	.pulse {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--form-ink);
		animation: pulse 1.6s var(--ease) infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.25;
		}
	}
</style>
