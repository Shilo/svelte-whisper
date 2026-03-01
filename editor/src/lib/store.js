import { writable } from 'svelte/store';

const getLocal = (key, defaultVal) => {
    if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem(key);
        return v !== null ? v : defaultVal;
    }
    return defaultVal;
};

const getSession = (key, defaultVal) => {
    if (typeof sessionStorage !== 'undefined') {
        const v = sessionStorage.getItem(key);
        return v !== null ? v : defaultVal;
    }
    return defaultVal;
};

// Migrate old PAT from 'token' localStorage key → sessionStorage 'authToken'
const migrateToken = () => {
    if (typeof localStorage === 'undefined') return '';
    const old = localStorage.getItem('token');
    if (old) {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('authToken', old);
        localStorage.removeItem('token');
        return old;
    }
    return getSession('authToken', '');
};

export const githubConfig = writable({
    repo: getLocal('repo', ''),
    branch: getLocal('branch', 'main'),
    submitMode: getLocal('submitMode', 'pr'),
});

if (typeof localStorage !== 'undefined') {
    githubConfig.subscribe((val) => {
        localStorage.setItem('repo', val.repo);
        localStorage.setItem('branch', val.branch);
        localStorage.setItem('submitMode', val.submitMode);
    });
}

export const translationsConfig = writable({
    localesPath: getLocal('localesPath', 'src/locales')
});

if (typeof localStorage !== 'undefined') {
    translationsConfig.subscribe((val) => {
        localStorage.setItem('localesPath', val.localesPath);
    });
}

export const authStore = writable({
    token: migrateToken(),
    method: getLocal('authMethod', null),    // 'oauth' | 'pat' | null
    userLogin: getLocal('userLogin', null),
    userAvatar: getLocal('userAvatar', null),
    flowState: 'idle',                       // 'idle' | 'device-pending' | 'polling' | 'authenticated' | 'error'
    deviceCode: null,
    userCode: null,
    verificationUri: null,
    errorMessage: null,
});

if (typeof sessionStorage !== 'undefined') {
    authStore.subscribe((val) => {
        if (val.token) sessionStorage.setItem('authToken', val.token);
        else sessionStorage.removeItem('authToken');
    });
}

if (typeof localStorage !== 'undefined') {
    authStore.subscribe((val) => {
        if (val.method) localStorage.setItem('authMethod', val.method);
        else localStorage.removeItem('authMethod');
        if (val.userLogin) localStorage.setItem('userLogin', val.userLogin);
        else localStorage.removeItem('userLogin');
        if (val.userAvatar) localStorage.setItem('userAvatar', val.userAvatar);
        else localStorage.removeItem('userAvatar');
    });
}

export const translationsData = writable({
    keys: [],
    data: {},
    languages: [],
    loading: false,
    error: null
});
