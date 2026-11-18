// Persistent settings and the signed-in session.
//
// The GitHub token lives in sessionStorage only: it survives a reload but not
// closing the tab, and it is never written to localStorage. Repository settings
// and the signed-in user's public login/avatar are not secret and live in
// localStorage so the next visit can pick up where the last one stopped.

const CONFIG_KEY = 'whisper.config';
const TOKEN_KEY = 'whisper.token';
const USER_KEY = 'whisper.user';

/** @param {Storage | undefined} store @param {string} key */
function read(store, key) {
	try {
		const raw = store?.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
/** @param {Storage | undefined} store @param {string} key @param {unknown} value */
function write(store, key, value) {
	try {
		if (value == null) store?.removeItem(key);
		else store?.setItem(key, JSON.stringify(value));
	} catch {
		/* storage can be unavailable (private mode, quota); the app still works */
	}
}

/** @param {'localStorage' | 'sessionStorage'} name @returns {Storage | undefined} */
function storage(name) {
	try {
		return globalThis[name]; // throws when site data is blocked
	} catch {
		return undefined;
	}
}
const local = storage('localStorage');
const session = storage('sessionStorage');

/**
 * @typedef {{ repo: string, branch: string, dir: string, source: string, mode: 'pr' | 'commit' }} Config
 */

/** @type {Config} */
/** An empty branch means the repository's default branch. */
const defaults = { repo: '', branch: '', dir: 'src/locales', source: 'en', mode: 'pr' };

export const config = $state({ ...defaults, ...read(local, CONFIG_KEY) });

/** @param {Partial<Config>} next */
export function saveConfig(next) {
	Object.assign(config, next);
	write(local, CONFIG_KEY, $state.snapshot(config));
}

export const auth = $state({
	/** @type {string} */
	token: read(session, TOKEN_KEY) || '',
	/** @type {{ login: string, avatar: string } | null} */
	user: read(local, USER_KEY)
});

/** @param {string} token @param {{ login: string, avatar: string } | null} user */
export function setSession(token, user) {
	auth.token = token;
	auth.user = user;
	write(session, TOKEN_KEY, token || null);
	write(local, USER_KEY, user);
}

export function clearSession() {
	setSession('', null);
}

/**
 * Normalise what people paste into the repository field:
 * "https://github.com/owner/repo/tree/main" -> "owner/repo".
 * @param {string} input
 */
export function normaliseRepo(input) {
	const m = input
		.trim()
		.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
		.replace(/\.git$/i, '')
		.match(/^([\w.-]+)\/([\w.-]+)/);
	return m ? `${m[1]}/${m[2]}` : input.trim();
}
