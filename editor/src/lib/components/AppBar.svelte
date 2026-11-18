<script>
	import Icon from './Icon.svelte';
	import { auth } from '../session.svelte.js';

	/**
	 * @type {{
	 *   address?: { repo: string, branch: string, dir: string } | null,
	 *   demo?: boolean,
	 *   onsettings?: () => void,
	 *   onsignout?: () => void,
	 *   onexitdemo?: () => void
	 * }}
	 */
	let { address = null, demo = false, onsettings, onsignout, onexitdemo } = $props();
</script>

<header class="bar">
	<span class="mark">
		<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
			<rect x="1.5" y="1.5" width="21" height="21" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" />
			<path d="M6 8h12M6 12h8M6 16h4" stroke="var(--air)" stroke-width="1.75" stroke-linecap="round" />
		</svg>
		<span class="word">whisper</span><span class="sub">editor</span>
	</span>

	{#if address}
		<button class="address" onclick={onsettings} title="Change repository, branch or folder">
			<span class="repo">{address.repo}</span>
			<span class="meta"><span class="sep">on</span> {address.branch} <span class="sep">in</span> {address.dir}</span>
			<Icon name="settings" size={16} />
		</button>
	{:else if demo}
		<button class="address" onclick={onsettings} title="Demo settings">
			<span class="repo">Sample files</span>
			<span class="meta"><span class="sep">in</span> src/locales</span>
			<Icon name="settings" size={16} />
		</button>
	{/if}

	<div class="end">
		{#if demo}
			<span class="demo-tag">Demo</span>
			<button class="btn quiet" onclick={onexitdemo}>Exit demo</button>
		{:else if auth.token}
			{#if auth.user}
				<span class="user">
					{#if auth.user.avatar}<img src={auth.user.avatar} alt="" width="24" height="24" />{/if}
					<span class="login">{auth.user.login}</span>
				</span>
			{/if}
			<button class="btn quiet icon" aria-label="Sign out" title="Sign out" onclick={onsignout}><Icon name="out" /></button>
		{/if}
	</div>
</header>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: var(--bar-h);
		padding: 0 0.5rem 0 0.75rem;
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.mark {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--form-ink);
		text-decoration: none;
		flex: none;
	}
	.word {
		font-weight: 700;
		font-size: 1rem;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.sub {
		font-size: var(--t-cap);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--form-ink);
		padding-top: 0.15rem;
	}
	.address {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		min-height: 2.25rem;
		padding: 0 0.625rem;
		border: 1px solid var(--rule);
		border-radius: var(--radius);
		background: var(--field);
		color: var(--form-ink);
		font-family: var(--mono);
		font-size: var(--t-sm);
		cursor: pointer;
	}
	.address:hover {
		border-color: var(--form-ink);
	}
	.repo {
		color: var(--ink);
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.meta {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sep {
		font-family: var(--font);
		color: var(--ink-2);
	}
	.end {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-left: auto;
		flex: none;
	}
	.user {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--ink-2);
	}
	.user img {
		border-radius: 50%;
		border: 1px solid var(--rule);
	}
	.demo-tag {
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--form-ink);
		color: var(--form-ink);
		font-size: var(--t-cap);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	@media (max-width: 47.99rem) {
		.sub,
		.meta,
		.login {
			display: none;
		}
	}
	@media (max-width: 26rem) {
		.word {
			display: none;
		}
	}
</style>
