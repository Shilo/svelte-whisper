import { get } from 'svelte/store';
import { githubConfig } from './store.js';

const apiFetch = async (endpoint, options = {}) => {
    const { repo, token } = get(githubConfig);

    if (!token || !repo) {
        throw new Error('Missing GitHub repository or token.');
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers
    };

    const response = await fetch(`https://api.github.com/repos/${repo}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GitHub API Error: ${response.status} ${response.statusText} - ${errorData.message || ''}`);
    }

    return response.json();
};

export const fetchTree = async (branch) => {
    const ref = await apiFetch(`/git/ref/heads/${branch}`);
    const commit = await apiFetch(`/git/commits/${ref.object.sha}`);
    const tree = await apiFetch(`/git/trees/${commit.tree.sha}?recursive=1`);
    return tree.tree;
};

export const fetchFileContent = async (fileSha) => {
    const file = await apiFetch(`/git/blobs/${fileSha}`);
    // Content is base64 encoded
    const decode = atob(file.content);
    // Handle utf-8 encoding properly since atob breaks on multi-byte characters
    const bytes = new Uint8Array(decode.length);
    for (let i = 0; i < decode.length; i++) {
        bytes[i] = decode.charCodeAt(i);
    }
    const text = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(text);
};

export const pushTranslations = async (branch, filesData, commitMessage) => {
    // 1. Get current commit
    const ref = await apiFetch(`/git/ref/heads/${branch}`);
    const currentCommitSha = ref.object.sha;
    const currentCommit = await apiFetch(`/git/commits/${currentCommitSha}`);
    const treeSha = currentCommit.tree.sha;

    // 2. Create blobs for each file
    const treeEntries = await Promise.all(
        filesData.map(async (file) => {
            // Encode JSON to utf-8 bytes to base64
            const text = JSON.stringify(file.content, null, 2) + '\n';
            const encoder = new TextEncoder();
            const bytes = encoder.encode(text);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Content = btoa(binary);

            const blob = await apiFetch('/git/blobs', {
                method: 'POST',
                body: JSON.stringify({
                    content: base64Content,
                    encoding: 'base64'
                })
            });
            return {
                path: file.path,
                mode: '100644',
                type: 'blob',
                sha: blob.sha
            };
        })
    );

    // 3. Create a new tree
    const newTree = await apiFetch('/git/trees', {
        method: 'POST',
        body: JSON.stringify({
            base_tree: treeSha,
            tree: treeEntries
        })
    });

    // 4. Create a new commit
    const newCommit = await apiFetch('/git/commits', {
        method: 'POST',
        body: JSON.stringify({
            message: commitMessage,
            tree: newTree.sha,
            parents: [currentCommitSha]
        })
    });

    // 5. Update the reference
    await apiFetch(`/git/refs/heads/${branch}`, {
        method: 'PATCH',
        body: JSON.stringify({
            sha: newCommit.sha,
            force: false
        })
    });

    return newCommit.sha;
};
