import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode, isPreview }) => {
	// An empty prefix returns every variable, from .env files and the shell (the shell wins).
	const env = loadEnv(mode, '.', '');
	let proxy = '';
	try {
		proxy = env.VITE_CORS_PROXY_URL ? new URL(env.VITE_CORS_PROXY_URL).origin : '';
	} catch {
		throw new Error('VITE_CORS_PROXY_URL is not a valid URL');
	}

	// The page holds a GitHub token, so it may only talk to GitHub (and the
	// sign-in proxy) and only run its own scripts. Svelte sets styles through the
	// CSSOM and Vite links CSS files, so no inline styles are allowed either.
	const csp = [
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self'",
		"img-src 'self' data: https://avatars.githubusercontent.com",
		`connect-src 'self' https://api.github.com${proxy ? ' ' + proxy : ''}`,
		"font-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ');

	// GitHub Pages serves the site from /<repo>/; the deploy workflow sets BASE_PATH.
	const base = command === 'serve' && !isPreview ? '/' : (env.BASE_PATH || '').replace(/\/*$/, '/');

	return {
		base,
		plugins: [
			svelte(),
			{
				name: 'csp',
				apply: 'build', // the dev server needs inline styles and a websocket for hot reload
				transformIndexHtml: (html) => html.replace('<meta charset="utf-8" />', `$&
		<meta http-equiv="content-security-policy" content="${csp}" />`)
			}
		],
		build: { modulePreload: { polyfill: false } }
	};
});
