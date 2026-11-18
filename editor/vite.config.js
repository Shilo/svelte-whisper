import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
	plugins: [
		sveltekit({
			adapter: adapter({ fallback: '404.html' }),
			// GitHub Pages serves the site from /<repo>; the deploy workflow sets BASE_PATH.
			paths: { base: command === 'serve' ? '' : process.env.BASE_PATH || '' }
		})
	]
}));
