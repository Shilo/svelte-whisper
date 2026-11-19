/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
export default {
    // Runes everywhere, except src/lib/LegacyCount.svelte, which switches them off for itself.
    compilerOptions: { runes: true },
};
