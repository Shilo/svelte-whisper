<script>
    let {
        message = '',
        variant = 'default',   // 'default' | 'error' | 'success'
        actionLabel = '',
        onaction = null,
        duration = 4000,
        visible = $bindable(false),
    } = $props();

    let timer = null;

    $effect(() => {
        if (visible && duration > 0) {
            clearTimeout(timer);
            timer = setTimeout(() => { visible = false; }, duration);
        }
        return () => clearTimeout(timer);
    });

    function handleAction() {
        if (onaction) onaction();
        visible = false;
    }
</script>

{#if visible}
<div
    class="snackbar"
    class:snackbar--error={variant === 'error'}
    class:snackbar--success={variant === 'success'}
    role="status"
    aria-live="polite"
>
    <span class="snackbar__text">{message}</span>
    {#if actionLabel}
        <button class="snackbar__action" onclick={handleAction}>{actionLabel}</button>
    {/if}
</div>
{/if}

<style>
    .snackbar {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        min-width: 288px;
        max-width: min(568px, calc(100vw - 32px));
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 14px 16px;
        background-color: var(--md-sys-color-inverse-surface);
        color: var(--md-sys-color-inverse-on-surface);
        border-radius: 4px;
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        letter-spacing: 0.25px;
        box-shadow: 0 3px 5px -1px rgba(0,0,0,.3), 0 6px 10px 0 rgba(0,0,0,.2), 0 1px 18px 0 rgba(0,0,0,.15);
        z-index: 200;
        animation: snackbar-slide-up 200ms cubic-bezier(0, 0, 0.2, 1);
    }

    .snackbar--error {
        background-color: var(--md-sys-color-error-container);
        color: var(--md-sys-color-on-error-container);
    }

    .snackbar--success {
        background-color: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-on-primary-container);
    }

    .snackbar__text { flex: 1; }

    .snackbar__action {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--md-sys-color-inverse-primary);
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 0.1px;
        padding: 0;
        white-space: nowrap;
        text-transform: uppercase;
    }

    .snackbar--error .snackbar__action,
    .snackbar--success .snackbar__action {
        color: var(--md-sys-color-primary);
    }

    @keyframes snackbar-slide-up {
        from { opacity: 0; transform: translateX(-50%) translateY(16px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    @media (max-width: 600px) {
        .snackbar {
            bottom: 88px;
            left: 16px;
            right: 16px;
            transform: none;
            min-width: 0;
        }
        @keyframes snackbar-slide-up {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
        }
    }
</style>
