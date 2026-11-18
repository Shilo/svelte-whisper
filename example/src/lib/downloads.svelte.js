// Every locale file the browser has actually downloaded, read from the Resource Timing API.
// Not part of svelte-whisper: it only makes the library's network traffic visible.
// Dev serves `/src/locales/es.json?import`; a build serves `/assets/locales/es-<hash>.js`.
const LOCALE_FILE = /\/locales\/([^/?]+?)(?:-[\w-]{8})?\.js(?:on)?(?:\?|$)/;

export const downloads = $state([]);

if (typeof PerformanceObserver !== 'undefined') {
    new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
            const match = LOCALE_FILE.exec(entry.name);
            if (!match) continue;
            downloads.push({
                locale: match[1],
                file: entry.name.split('/').pop().split('?')[0],
                bytes: entry.encodedBodySize,
                cached: entry.transferSize === 0,
                at: entry.startTime,
            });
        }
    }).observe({ type: 'resource', buffered: true });
}
