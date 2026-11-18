<script>
	import Icon from './Icon.svelte';

	/**
	 * Native modal dialog: focus trapping, Escape and the backdrop come from the platform.
	 * @type {{
	 *   open: boolean,
	 *   title: string,
	 *   wide?: boolean,
	 *   onclose?: () => void,
	 *   children: import('svelte').Snippet,
	 *   footer?: import('svelte').Snippet
	 * }}
	 */
	let { open = $bindable(), title, wide = false, onclose, children, footer } = $props();

	/** @type {HTMLDialogElement | undefined} */
	let el = $state();
	const id = `dlg-${Math.random().toString(36).slice(2, 8)}`;

	$effect(() => {
		if (!el) return;
		if (open && !el.open) el.showModal();
		else if (!open && el.open) el.close();
	});
</script>

<dialog
	bind:this={el}
	class:wide
	aria-labelledby={id}
	onclose={() => {
		open = false;
		onclose?.();
	}}
	onclick={(e) => e.target === el && el.close()}
>
	{#if open}
		<header>
			<h2 {id}>{title}</h2>
			<button class="btn quiet icon" aria-label="Close" onclick={() => el?.close()}><Icon name="x" /></button>
		</header>
		<div class="body">{@render children()}</div>
		{#if footer}<footer>{@render footer()}</footer>{/if}
	{/if}
</dialog>

<style>
	dialog {
		width: min(30rem, calc(100vw - 1.5rem));
		max-height: min(46rem, calc(100dvh - 2rem));
		padding: 0;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius);
		background: var(--field);
		color: var(--ink);
		box-shadow: var(--shadow);
		overflow: hidden;
		flex-direction: column;
	}
	dialog[open] {
		display: flex;
		animation: open 200ms var(--ease);
	}
	dialog.wide {
		width: min(52rem, calc(100vw - 1.5rem));
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0.5rem 0.5rem 1.25rem;
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	h2 {
		font-size: var(--t-lg);
	}
	.body {
		padding: 1.25rem;
		overflow: auto;
		display: grid;
		gap: 1rem;
		align-content: start;
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--rule-strong);
		background: var(--paper);
	}
	@media (max-width: 30rem) {
		dialog {
			width: 100vw;
			max-width: 100vw;
			max-height: 92dvh;
			margin: auto 0 0;
			border-width: 1px 0 0;
		}
		dialog.wide {
			width: 100vw;
		}
	}
	@keyframes open {
		from {
			opacity: 0;
			translate: 0 0.75rem;
		}
	}
</style>
