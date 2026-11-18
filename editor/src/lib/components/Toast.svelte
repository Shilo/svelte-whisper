<script>
	import { toast, dismiss } from '../toast.svelte.js';
	import Icon from './Icon.svelte';
</script>

<!-- The live region is always present so screen readers announce new messages. -->
<div class="region" role={toast.current?.tone === 'error' ? 'alert' : 'status'} aria-live={toast.current?.tone === 'error' ? 'assertive' : 'polite'}>
	{#if toast.current}
		{@const t = toast.current}
		<div class="toast {t.tone}">
			<p>{t.text}</p>
			{#if t.action?.href}
				<a class="btn quiet" href={t.action.href} target="_blank" rel="noopener noreferrer">{t.action.label} <Icon name="external" size={14} /></a>
			{:else if t.action?.run}
				<button class="btn quiet" onclick={() => (t.action.run(), dismiss())}>{t.action.label}</button>
			{/if}
			<button class="btn quiet icon" aria-label="Dismiss" onclick={dismiss}><Icon name="x" size={16} /></button>
		</div>
	{/if}
</div>

<style>
	.region {
		position: fixed;
		z-index: 60;
		left: 50%;
		bottom: calc(var(--bar-h) + 1rem + env(safe-area-inset-bottom));
		translate: -50% 0;
		width: min(34rem, calc(100vw - 2rem));
		pointer-events: none;
	}
	.toast {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.375rem 0.375rem 0.875rem;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius);
		background: var(--field);
		box-shadow: var(--shadow);
		pointer-events: auto;
		animation: rise 220ms var(--ease);
	}
	.toast.error {
		border-color: var(--alert);
		background: var(--alert-wash);
	}
	.toast.error p {
		color: var(--alert);
	}
	.toast.success {
		border-color: var(--air);
	}
	p {
		flex: 1;
		font-size: var(--t-ui);
		padding: 0.25rem 0;
	}
	.toast :global(.btn.quiet) {
		color: var(--air);
	}
	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 0.5rem;
		}
	}
</style>
