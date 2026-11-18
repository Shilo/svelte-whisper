import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, listLocaleFiles, readFile, submit } from '../src/lib/github.js';
import { makeDoc, LocaleDoc } from './helpers.js';

// A fake GitHub API: routes are "METHOD /path" -> handler(body) returning [status, json or bytes].
// Moving a branch (PATCH) succeeds unless a test says otherwise.
/** @type {Record<string, (body: any) => [number, any]>} */
let routes;
/** @type {{ method: string, path: string, body: any }[]} */
let calls;

beforeEach(() => {
	routes = {};
	calls = [];
	globalThis.fetch = async (url, init = {}) => {
		const path = String(url).replace('https://api.github.com', '');
		const method = init.method || 'GET';
		const body = init.body ? JSON.parse(init.body) : undefined;
		calls.push({ method, path, body });
		const route = routes[`${method} ${path.split('?')[0]}`] ?? (method === 'PATCH' && (() => [200, {}]));
		const [status, json] = route ? route(body) : [404, { message: 'Not Found' }];
		// Raw file contents are bytes, as GitHub sends them.
		return new Response(status === 204 ? null : json instanceof Uint8Array ? json : JSON.stringify(json), { status });
	};
});

const listing = (files) => () => [200, files.map(([name, sha, type = 'file']) => ({ name, sha, type, path: `src/locales/${name}` }))];
const writes = () => calls.filter((c) => c.method !== 'GET');

test('listLocaleFiles keeps files named like a language and reports the other .json files', async () => {
	routes['GET /repos/o/app/contents/src/locales'] = listing([
		['en.json', 's1'],
		['pt_BR.json', 's2'],
		['notes.json', 's3'],
		['README.md', 's4'],
		['fr.json', 's5', 'dir'],
		['pt-BR.json', 's6']
	]);
	const { files, skipped } = await listLocaleFiles('t', 'o/app', 'main', 'src/locales');
	assert.deepEqual(
		files.map((f) => f.name),
		['en.json', 'pt-BR.json']
	);
	assert.deepEqual(files[0], { name: 'en.json', path: 'src/locales/en.json', sha: 's1' });
	assert.deepEqual(skipped, ['pt_BR.json', 'notes.json']);
});

/** A repository with en and fr on main, and the write endpoints a submit needs. */
function repo(target = 'o/app') {
	routes['GET /repos/o/app/contents/src/locales'] = listing([
		['en.json', 'sha-en'],
		['fr.json', 'sha-fr'],
		['de.json', 'sha-de']
	]);
	routes['GET /repos/o/app/git/ref/heads/main'] = () => [200, { object: { sha: 'base' } }];
	routes[`POST /repos/${target}/git/refs`] = () => [201, {}];
	routes[`GET /repos/${target}/git/commits/base`] = () => [200, { tree: { sha: 'tree0' } }];
	routes[`POST /repos/${target}/git/trees`] = () => [201, { sha: 'tree1' }];
	routes[`POST /repos/${target}/git/commits`] = () => [201, { sha: 'next' }];
	routes['POST /repos/o/app/pulls'] = () => [201, { html_url: 'https://github.com/o/app/pull/7', number: 7 }];
}

const options = (files, more = {}) => ({
	token: 't',
	repo: 'o/app',
	branch: 'main',
	dir: 'src/locales',
	mode: /** @type {const} */ ('pr'),
	files,
	title: 'Update translations',
	body: '',
	canPush: true,
	...more
});

test('a file changed on the branch since loading stops submit before anything is written', async () => {
	repo();
	const files = [{ path: 'src/locales/fr.json', text: '{}', sha: 'sha-fr-old' }];
	await assert.rejects(submit(options(files)), { status: 409, message: /fr\.json changed on main since you loaded it/ });
	assert.deepEqual(writes(), []);
});

test('only the changed files go into the commit tree', async () => {
	repo();
	const doc = makeDoc({ en: { a: 'A' }, fr: { a: 'Ah' }, de: { a: 'Ach' } });
	doc.set('fr', 'a', 'Ahh');
	const files = doc.outputFiles().map((f) => ({ path: f.path, text: f.text, sha: `sha-${f.lang}` }));
	await submit(options(files, { mode: 'commit' }));
	const tree = calls.find((c) => c.path === '/repos/o/app/git/trees');
	assert.deepEqual(
		tree?.body.tree.map((t) => t.path),
		['src/locales/fr.json']
	);
	assert.equal(tree?.body.base_tree, 'tree0');
	assert.deepEqual(calls.at(-1), { method: 'PATCH', path: '/repos/o/app/git/refs/heads/main', body: { sha: 'next', force: false } });
});

test('without push access the branch goes to a fork and the pull request targets the original repository', async () => {
	repo('me/app');
	routes['POST /repos/o/app/forks'] = () => [202, { full_name: 'me/app', owner: { login: 'me' } }];
	const files = [{ path: 'src/locales/fr.json', text: '{}', sha: 'sha-fr' }];
	const result = await submit(options(files, { canPush: false }));
	assert.deepEqual(result, { mode: 'pr', url: 'https://github.com/o/app/pull/7', number: 7 });
	const ref = calls.find((c) => c.method === 'POST' && c.path === '/repos/me/app/git/refs');
	const branch = ref?.body.ref.replace('refs/heads/', '');
	assert.match(branch, /^whisper\/translations-/);
	assert.ok(calls.some((c) => c.method === 'PATCH' && c.path === `/repos/me/app/git/refs/heads/${branch}`));
	assert.ok(!calls.some((c) => c.method !== 'GET' && c.path.startsWith('/repos/o/app/git/')), 'nothing written to the original');
	const pr = calls.find((c) => c.path === '/repos/o/app/pulls');
	assert.deepEqual(pr?.body, { title: 'Update translations', body: '', head: `me:${branch}`, base: 'main', maintainer_can_modify: true });
});

test('GitHub errors map to messages a translator can act on', async () => {
	const cases = [
		[401, '', '/user', 'GitHub rejected the token. Sign in again.'],
		[403, 'API rate limit exceeded', '/user', 'GitHub rate limit reached. Wait a few minutes and try again.'],
		[403, 'Resource not accessible by integration', '/repos/o/app/pulls', 'GitHub returned 403: Resource not accessible by integration.'],
		[404, '', '/repos/o/app/contents/src', 'That folder or branch was not found. Check both names.'],
		[404, '', '/repos/o/app/git/ref/heads/x', 'That branch was not found. Check its name.'],
		[404, '', '/repos/o/app', /^Repository not found\./],
		[409, '', '/repos/o/app/git/refs/heads/main', /^Someone else changed the branch/],
		[422, 'Update is not a fast forward', '/repos/o/app/git/refs/heads/main', /^Someone else changed the branch/],
		[422, 'Validation Failed', '/repos/o/app/pulls', 'GitHub returned 422: Validation Failed.']
	];
	for (const [status, message, path, expected] of cases) {
		routes[`GET ${path}`] = () => [status, { message }];
		await assert.rejects(api('t', path), (e) => {
			assert.equal(e.status, status);
			if (typeof expected === 'string') assert.equal(e.message, expected);
			else assert.match(e.message, expected);
			return true;
		});
	}
});

test('a file with a byte order mark is read, edited and sent back with it, every other byte unchanged', async () => {
	repo();
	const original = '﻿{\r\n    "a": "Ah",\r\n    "b": "Bé"\r\n}';
	const bytes = new TextEncoder().encode(original);
	assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
	routes['GET /repos/o/app/contents/src/locales/fr.json'] = () => [200, bytes];
	const text = await readFile('t', 'o/app', 'main', 'src/locales/fr.json');
	assert.equal(text, original);
	const doc = new LocaleDoc([{ name: 'fr.json', path: 'src/locales/fr.json', sha: 'sha-fr', text }], 'src/locales', 'fr');
	doc.set('fr', 'a', 'Ahh');
	const files = doc.outputFiles().map((f) => ({ path: f.path, text: f.text, sha: f.sha }));
	await submit(options(files, { mode: 'commit' }));
	const sent = calls.find((c) => c.path === '/repos/o/app/git/trees')?.body.tree[0].content;
	const expected = new TextEncoder().encode(original.replace('"Ah"', '"Ahh"'));
	assert.deepEqual([...new TextEncoder().encode(sent)], [...expected]);
});
