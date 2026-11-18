// Minimal GitHub REST client. Every call goes straight from the browser to
// api.github.com with the user's token; there is no server in between.

import { isLocaleFile } from './lang.js';

const API = 'https://api.github.com';

class GitHubError extends Error {
	/** @param {string} message @param {number} status */
	constructor(message, status) {
		super(message);
		this.status = status;
	}
}

/**
 * @param {string} token
 * @param {string} path
 * @param {{ method?: string, body?: unknown, accept?: string, raw?: boolean }} [opts]
 */
export async function api(token, path, opts = {}) {
	const res = await fetch(API + path, {
		method: opts.method || 'GET',
		headers: {
			Accept: opts.accept || 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(opts.body ? { 'Content-Type': 'application/json' } : {})
		},
		body: opts.body ? JSON.stringify(opts.body) : undefined,
		cache: 'no-store'
	});
	if (!res.ok) {
		const detail = await res.json().catch(() => ({}));
		throw new GitHubError(explain(res.status, detail.message, path), res.status);
	}
	if (res.status === 204) return null;
	return opts.raw ? res.text() : res.json();
}

/** @param {number} status @param {string | undefined} message @param {string} path */
function explain(status, message, path) {
	if (status === 401) return 'GitHub rejected the token. Sign in again.';
	if (status === 403 && /rate limit/i.test(message || '')) return 'GitHub rate limit reached. Wait a few minutes and try again.';
	if (status === 404) {
		if (path.includes('/contents/')) return 'That folder or branch was not found. Check both names.';
		if (path.includes('/git/ref')) return 'That branch was not found. Check its name.';
		return 'Repository not found. Check the owner/name and branch, and that the GitHub account you signed in with (or your token) can see this repository.';
	}
	if (status === 409 || (status === 422 && /fast.?forward/i.test(message || ''))) {
		return 'Someone else changed the branch while you were sending. Reload to get the latest files, then send again; your edits are kept as a draft.';
	}
	return `GitHub returned ${status}${message ? `: ${message}` : ''}.`;
}

/** @param {string} p */
const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

/** @param {string} token */
export async function getUser(token) {
	const u = await api(token, '/user');
	return { login: u.login, avatar: u.avatar_url };
}

/**
 * @param {string} token
 * @param {string} repo  "owner/name"
 */
export async function getRepo(token, repo) {
	const r = await api(token, `/repos/${repo}`);
	return { defaultBranch: r.default_branch, canPush: !!r.permissions?.push };
}

/**
 * List the locale files (named like a language tag) in a folder with their blob SHAs.
 * `skipped` names the other `.json` files, such as notes.json or pt_BR.json.
 * @param {string} token @param {string} repo @param {string} branch @param {string} dir
 * @returns {Promise<{ files: { name: string, path: string, sha: string }[], skipped: string[] }>}
 */
export async function listLocaleFiles(token, repo, branch, dir) {
	const items = await api(token, `/repos/${repo}/contents/${encodePath(dir)}?ref=${encodeURIComponent(branch)}`);
	if (!Array.isArray(items)) throw new GitHubError(`${dir} is a file, not a folder.`, 400);
	const json = items.filter((i) => i.type === 'file' && i.name.endsWith('.json'));
	return {
		files: json.filter((i) => isLocaleFile(i.name)).map((i) => ({ name: i.name, path: i.path, sha: i.sha })),
		skipped: json.filter((i) => !isLocaleFile(i.name)).map((i) => i.name)
	};
}

/** @param {string} token @param {string} repo @param {string} branch @param {string} path */
export function readFile(token, repo, branch, path) {
	return api(token, `/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, {
		accept: 'application/vnd.github.raw+json',
		raw: true
	});
}

/**
 * Commit whole-file contents on top of `parent` and move `branch` to it.
 * Uses inline tree content, so the commit costs three requests however many files change.
 * @param {string} token @param {string} repo @param {string} branch @param {string} parent
 * @param {{ path: string, text: string }[]} files @param {string} message
 */
async function commitFiles(token, repo, branch, parent, files, message) {
	const commit = await api(token, `/repos/${repo}/git/commits/${parent}`);
	const tree = await api(token, `/repos/${repo}/git/trees`, {
		method: 'POST',
		body: {
			base_tree: commit.tree.sha,
			tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.text }))
		}
	});
	const next = await api(token, `/repos/${repo}/git/commits`, {
		method: 'POST',
		body: { message, tree: tree.sha, parents: [parent] }
	});
	await api(token, `/repos/${repo}/git/refs/heads/${encodePath(branch)}`, {
		method: 'PATCH',
		body: { sha: next.sha, force: false }
	});
	return next.sha;
}

/** @param {string} token @param {string} repo @param {string} branch */
async function headSha(token, repo, branch) {
	const ref = await api(token, `/repos/${repo}/git/ref/heads/${encodePath(branch)}`);
	return ref.object.sha;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Submit edited locale files as a pull request or a direct commit.
 *
 * Before writing, the current SHAs of the touched files are compared with the
 * SHAs seen at load time, so the editor never overwrites changes someone else
 * pushed in the meantime. Contributors without push access get a fork.
 *
 * @param {{
 *   token: string, repo: string, branch: string, dir: string, mode: 'pr' | 'commit',
 *   files: { path: string, text: string, sha: string | null }[],
 *   title: string, body: string, canPush: boolean
 * }} o
 * @returns {Promise<{ mode: 'pr', url: string, number: number } | { mode: 'commit', sha: string }>}
 */
export async function submit(o) {
	const { files: current } = await listLocaleFiles(o.token, o.repo, o.branch, o.dir);
	const shaByPath = new Map(current.map((f) => [f.path, f.sha]));
	const stale = o.files.filter((f) => (shaByPath.get(f.path) ?? null) !== f.sha);
	if (stale.length) {
		throw new GitHubError(
			`${stale.map((f) => f.path.split('/').pop()).join(', ')} changed on ${o.branch} since you loaded it. Reload to get the latest version; your edits are kept as a draft.`,
			409
		);
	}

	const base = await headSha(o.token, o.repo, o.branch);

	if (o.mode === 'commit') {
		const sha = await commitFiles(o.token, o.repo, o.branch, base, o.files, o.title);
		return { mode: 'commit', sha };
	}

	// Pull request: write to a new branch in the repository, or in the user's fork.
	let target = o.repo;
	let headOwner = '';
	if (!o.canPush) {
		const fork = await api(o.token, `/repos/${o.repo}/forks`, { method: 'POST', body: { default_branch_only: true } });
		target = fork.full_name;
		headOwner = fork.owner.login;
	}
	const branch = `whisper/translations-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
	// A fresh fork can take a few seconds before it accepts writes.
	for (let attempt = 0; ; attempt++) {
		try {
			await api(o.token, `/repos/${target}/git/refs`, {
				method: 'POST',
				body: { ref: `refs/heads/${branch}`, sha: base }
			});
			break;
		} catch (e) {
			if (target === o.repo || attempt >= 8) throw e;
			await wait(1500);
		}
	}
	await commitFiles(o.token, target, branch, base, o.files, o.title);
	const pr = await api(o.token, `/repos/${o.repo}/pulls`, {
		method: 'POST',
		body: {
			title: o.title,
			body: o.body,
			head: headOwner ? `${headOwner}:${branch}` : branch,
			base: o.branch,
			maintainer_can_modify: true
		}
	});
	return { mode: 'pr', url: pr.html_url, number: pr.number };
}
