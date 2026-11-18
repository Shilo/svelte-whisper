import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
    // Deploying under a sub-path? `BASE_PATH=/svelte-whisper/ npm run build`
    base: process.env.BASE_PATH || '/',
    plugins: [svelte()],
    build: {
        rolldownOptions: {
            output: {
                // Each locale is already its own chunk; this only names it `assets/locales/<id>-<hash>.js`.
                chunkFileNames: chunk =>
                    chunk.facadeModuleId?.includes('/locales/') ? 'assets/locales/[name]-[hash].js' : 'assets/[name]-[hash].js',
            },
        },
    },
});
