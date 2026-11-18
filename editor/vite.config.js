import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode, isPreview }) => {
	const env = { ...loadEnv(mode, '.', 'VITE_'), ...process.env };
	let proxy = '';
	try {
		proxy = env.VITE_CORS_PROXY_URL ? new URL(env.VITE_CORS_PROXY_URL).origin : '';
	} catch {
		throw new Error('VITE_CORS_PROXY_URL is not a valid URL');
	}

	return {
		plugins: [
			sveltekit({
				adapter: adapter({ fallback: '404.html' }),
				// GitHub Pages serves the site from /<repo>; the deploy workflow sets BASE_PATH.
				paths: { base: command === 'serve' && !isPreview ? '' : env.BASE_PATH || '' },
				// The page holds a GitHub token, so it may only talk to GitHub (and the
				// sign-in proxy) and only run its own scripts.
				csp: {
					mode: 'hash',
					directives: {
						'default-src': ['self'],
						'script-src': ['self'],
						'style-src': ['self', 'unsafe-inline'],
						'img-src': ['self', 'data:', 'https://avatars.githubusercontent.com'],
						'connect-src': ['self', 'https://api.github.com', ...(proxy ? [proxy] : [])],
						'font-src': ['self'],
						'object-src': ['none'],
						'base-uri': ['self'],
						'form-action': ['self']
					}
				}
			})
		]
	};
});
