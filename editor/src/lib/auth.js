import { get } from 'svelte/store';
import { authStore } from './store.js';

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const CORS_PROXY = (import.meta.env.VITE_CORS_PROXY_URL || '').replace(/\/$/, '');

let _pollTimer = null;

async function githubPost(path, params) {
    const url = CORS_PROXY ? `${CORS_PROXY}${path}` : `https://github.com${path}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) throw new Error(`OAuth request failed: ${res.status}`);
    return res.json();
}

export const isOAuthConfigured = () => !!CLIENT_ID;

export async function startDeviceFlow() {
    if (!CLIENT_ID) {
        throw new Error('No OAuth App configured. Please use a Personal Access Token instead.');
    }

    authStore.update(s => ({ ...s, flowState: 'device-pending', errorMessage: null }));

    let data;
    try {
        data = await githubPost('/login/device/code', {
            client_id: CLIENT_ID,
            scope: 'repo',
        });
    } catch (e) {
        authStore.update(s => ({ ...s, flowState: 'error', errorMessage: e.message }));
        throw e;
    }

    authStore.update(s => ({
        ...s,
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri || 'https://github.com/login/device',
        flowState: 'device-pending',
    }));

    window.open(data.verification_uri || 'https://github.com/login/device', '_blank');
    _startPolling(data.device_code, data.interval || 5);

    return { userCode: data.user_code };
}

function _startPolling(deviceCode, interval) {
    authStore.update(s => ({ ...s, flowState: 'polling' }));
    let currentInterval = interval;

    const poll = async () => {
        try {
            const data = await githubPost('/login/oauth/access_token', {
                client_id: CLIENT_ID,
                device_code: deviceCode,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            });

            if (data.error === 'authorization_pending') {
                _pollTimer = setTimeout(poll, currentInterval * 1000);
            } else if (data.error === 'slow_down') {
                currentInterval += 5;
                _pollTimer = setTimeout(poll, currentInterval * 1000);
            } else if (data.error === 'expired_token') {
                authStore.update(s => ({ ...s, flowState: 'error', errorMessage: 'Code expired. Please try again.' }));
            } else if (data.access_token) {
                const userRes = await fetch('https://api.github.com/user', {
                    headers: { 'Authorization': `Bearer ${data.access_token}` }
                });
                const user = userRes.ok ? await userRes.json() : {};
                authStore.update(s => ({
                    ...s,
                    token: data.access_token,
                    method: 'oauth',
                    userLogin: user.login || null,
                    userAvatar: user.avatar_url || null,
                    flowState: 'authenticated',
                    deviceCode: null,
                    userCode: null,
                    verificationUri: null,
                    errorMessage: null,
                }));
            } else {
                authStore.update(s => ({
                    ...s,
                    flowState: 'error',
                    errorMessage: data.error_description || data.error || 'Unknown error',
                }));
            }
        } catch {
            // Network error — retry
            _pollTimer = setTimeout(poll, currentInterval * 1000);
        }
    };

    _pollTimer = setTimeout(poll, currentInterval * 1000);
}

export function cancelDeviceFlow() {
    if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
    authStore.update(s => ({
        ...s,
        flowState: 'idle',
        deviceCode: null,
        userCode: null,
        verificationUri: null,
        errorMessage: null,
    }));
}

export function signInWithPat(token) {
    authStore.update(s => ({
        ...s,
        token: token.trim(),
        method: 'pat',
        flowState: 'authenticated',
        userLogin: null,
        userAvatar: null,
        errorMessage: null,
    }));
}

export function signOut() {
    if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
    authStore.set({
        token: '',
        method: null,
        userLogin: null,
        userAvatar: null,
        flowState: 'idle',
        deviceCode: null,
        userCode: null,
        verificationUri: null,
        errorMessage: null,
    });
}

export function openPatCreationPage() {
    window.open(
        'https://github.com/settings/tokens/new?scopes=repo&description=svelte-whisper+editor',
        '_blank'
    );
}
