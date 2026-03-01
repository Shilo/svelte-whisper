<script>
  import { t, locale } from 'svelte-whisper';
  let userName = $state('Developer');
</script>

<main>
  <h1>{$t('app.title')}</h1>
  <p class="desc">{$t('app.description')}</p>

  <div class="card">
    <p class="greeting">{$t('greeting', { user: userName })}</p>
    <input type="text" bind:value={userName} placeholder="Type a name..." />
    
    <div class="features">
      <p>{$t('app.features', ['lazy loading', 'string interpolation', 'nested keys'])}</p>
      <p class="fallback-demo">{$t('only_en')}</p>
    </div>
  </div>

  <div class="controls">
    <p>{$t('status', { lang: $locale })}</p>
    <div class="buttons">
      <button onclick={() => locale.set('en')} class:active={$locale === 'en'}>
        {$t('buttons.switch_en')}
      </button>
      <button onclick={() => locale.set('es')} class:active={$locale === 'es'}>
        {$t('buttons.switch_es')}
      </button>
      <button onclick={() => locale.set('fr')} class:active={$locale === 'fr'}>
        {$t('buttons.switch_fr')}
      </button>
    </div>
  </div>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: system-ui, -apple-system, sans-serif;
  }
  h1 {
    color: var(--color-primary);
    margin-bottom: 0.5rem;
  }
  .desc {
    color: var(--color-text-desc);
    margin-top: 0;
    margin-bottom: 2rem;
  }
  .card {
    background: var(--color-bg-card);
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    text-align: left;
  }
  .greeting {
    font-size: 1.5rem;
    font-weight: bold;
    margin-top: 0;
  }
  .features {
    padding-left: 1rem;
    border-left: 4px solid var(--color-primary);
  }
  .fallback-demo {
    font-style: italic;
    color: #888;
  }
  .controls {
    text-align: center;
  }
  .buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 1rem;
  }
  button {
    padding: 0.75rem 1.5rem;
    border: 2px solid transparent;
    border-radius: 6px;
    background: var(--color-bg-btn);
    color: inherit;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }
  button:hover {
    background: var(--color-bg-btn-hover);
  }
  button.active {
    border-color: var(--color-primary);
    background: var(--color-bg-btn-active);
    color: var(--color-text-btn-active);
  }
</style>
