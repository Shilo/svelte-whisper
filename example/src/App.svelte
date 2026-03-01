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
    color: #ff3e00;
    margin-bottom: 0.5rem;
  }
  .desc {
    color: #666;
    margin-top: 0;
    margin-bottom: 2rem;
  }
  .card {
    background: #f4f4f4;
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
    border-left: 4px solid #ff3e00;
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
    background: #e0e0e0;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }
  button:hover {
    background: #d0d0d0;
  }
  button.active {
    border-color: #ff3e00;
    background: white;
    color: #ff3e00;
  }
</style>
