import { writable } from 'svelte/store';

// We need to run client-side only
const getStorage = (key, defaultVal) => {
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key) || defaultVal;
    }
    return defaultVal;
};

export const githubConfig = writable({
    repo: getStorage('repo', ''),
    token: getStorage('token', ''),
    branch: getStorage('branch', 'main')
});

if (typeof localStorage !== 'undefined') {
    githubConfig.subscribe((val) => {
        localStorage.setItem('repo', val.repo);
        localStorage.setItem('token', val.token);
        localStorage.setItem('branch', val.branch);
    });
}

export const translationsConfig = writable({
    localesPath: getStorage('localesPath', 'src/locales')
});

if (typeof localStorage !== 'undefined') {
    translationsConfig.subscribe((val) => {
        localStorage.setItem('localesPath', val.localesPath);
    });
}

export const translationsData = writable({
    keys: [], // array of key strings
    data: {}, // { 'key1': { 'en': 'Hello', 'de': 'Hallo' } }
    languages: [], // ['en', 'de']
    loading: false,
    error: null
});
