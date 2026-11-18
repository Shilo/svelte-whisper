// GitHub sign-in: OAuth device flow (RFC 8628) through a CORS proxy, or a
// personal access token. Device flow needs no client secret, so nothing secret
// is ever shipped in the bundle.

import { getUser } from './github.js';
import { setSession, clearSession } from './session.svelte.js';

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const PROXY = (import.meta.env.VITE_CORS_PROXY_URL || '').replace(/\/$/, '');

export const oauthAvailable = !!(CLIENT_ID && PROXY);

export const PAT_URL =
	'https://github.com/settings/personal-access-tokens/new?name=svelte-whisper%20editor&description=Edit%20locale%20files%20with%20the%20svelte-whisper%20editor';
export const CLASSIC_PAT_URL = 'https://github.com/settings/tokens/new?scopes=public_repo&description=svelte-whisper%20editor';

/** @param {string} path @param {Record<string, string>} params */
async function post(path, params) {
	const res = await fetch(PROXY + path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
		body: new URLSearchParams(params)
	});
	if (!res.ok) throw new Error(`Sign-in service returned ${res.status}.`);
	return res.json();
}

/**
 * Start the device flow. Resolves with the code to show; `done` settles when
 * the user approves (or the code expires, or `cancel` is called).
 * @returns {Promise<{ userCode: string, verificationUri: string, done: Promise<void>, cancel: () => void }>}
 */
export async function startDeviceFlow() {
	if (!oauthAvailable) throw new Error('GitHub sign-in is not configured for this copy of the editor. Use a token instead.');
	const start = await post('/login/device/code', { client_id: CLIENT_ID, scope: 'public_repo' });
	if (start.error) throw new Error(start.error_description || start.error);

	let timer = 0;
	let cancelled = false;
	let interval = (start.interval || 5) * 1000;
	const expires = Date.now() + (start.expires_in || 900) * 1000;

	const done = new Promise((resolve, reject) => {
		const poll = async () => {
			if (cancelled) return;
			if (Date.now() > expires) return reject(new Error('The code expired. Start again.'));
			try {
				const r = await post('/login/oauth/access_token', {
					client_id: CLIENT_ID,
					device_code: start.device_code,
					grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
				});
				if (cancelled) return;
				if (r.access_token) {
					await finishSignIn(r.access_token);
					return resolve();
				}
				if (r.error === 'slow_down') interval += 5000;
				else if (r.error === 'access_denied') return reject(new Error('Sign-in was declined on GitHub.'));
				else if (r.error === 'expired_token') return reject(new Error('The code expired. Start again.'));
				else if (r.error !== 'authorization_pending') return reject(new Error(r.error_description || r.error));
			} catch {
				/* transient network error: keep polling until the code expires */
			}
			timer = window.setTimeout(poll, interval);
		};
		timer = window.setTimeout(poll, interval);
	});

	return {
		userCode: start.user_code,
		verificationUri: start.verification_uri || 'https://github.com/login/device',
		done,
		cancel() {
			cancelled = true;
			clearTimeout(timer);
		}
	};
}

/**
 * Validate a token against GitHub and keep it for this tab.
 * @param {string} token
 */
export async function finishSignIn(token) {
	const t = token.trim();
	const user = await getUser(t);
	setSession(t, user);
	return user;
}

export function signOut() {
	clearSession();
}
