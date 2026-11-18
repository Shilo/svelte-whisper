// svelte-whisper dev overlay: lists missing translation keys while you work.
// init() imports it only under import.meta.env.DEV, so it never reaches a production build.
// Everything lives in a closed shadow root on #svelte-whisper-devtools and leaves the page alone.

const CSS = `
:host { all: initial; --fg: #ececf1; --muted: #a9adb8; --line: #3a3c44; --hover: #2a2c33; --amber: #f5b83d; --amber-fg: #f5c35a; --amber-bg: #3a2f12; --ok: #7ee2a0; }
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
.badge, .panel { position: fixed; z-index: 2147483647; direction: ltr; text-align: left; color: var(--fg); font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; }
button { font: inherit; color: inherit; cursor: pointer; }
code { font: 12px/1.4 ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; }
:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
svg { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.badge {
    right: 16px; bottom: 16px; display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px 0 9px;
    border: 0; border-radius: 15px; background: var(--amber); color: #1d1600; font-weight: 700; font-variant-numeric: tabular-nums;
    box-shadow: 0 0 0 1px rgb(0 0 0 / .35), 0 4px 14px -2px rgb(0 0 0 / .35); touch-action: none; user-select: none;
}
.badge:hover { background: #ffc955; }
.badge:focus-visible { outline: 0; box-shadow: 0 0 0 2px #1d1600, 0 0 0 4px var(--amber); }
.badge.dragging { cursor: grabbing; }
.badge.bump { animation: bump .3s cubic-bezier(.2, 0, 0, 1); }
@keyframes bump { 40% { transform: scale(1.1); } }

.panel {
    display: flex; flex-direction: column; width: 360px; max-height: 480px; overflow: hidden;
    background: #18191d; border: 1px solid var(--line); border-radius: 10px;
    box-shadow: 0 18px 50px -10px rgb(0 0 0 / .55), 0 2px 6px rgb(0 0 0 / .3); animation: open .16s cubic-bezier(.2, 0, 0, 1);
}
.panel:focus { outline: 0; }
@keyframes open { from { opacity: 0; transform: translateY(4px); } }

header, footer { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 14px; }
header { border-bottom: 1px solid var(--line); }
footer { border-top: 1px solid var(--line); }
h2 { margin: 0; font-size: 13px; font-weight: 650; }
.total, .chip[aria-pressed='true'] { background: var(--amber-bg); color: var(--amber-fg); }
.total { padding: 0 7px; border-radius: 9px; font-size: 12px; font-weight: 700; }
.close { margin-left: auto; display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 6px; background: none; color: var(--muted); }
.filters { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 14px 2px; }
.chip, .action { border: 1px solid var(--line); background: none; font-size: 12px; }
.chip { padding: 2px 9px; border-radius: 12px; }
.chip[aria-pressed='true'] { border-color: var(--amber); }
.action { padding: 4px 10px; border-radius: 6px; font-weight: 600; white-space: nowrap; }
.close:hover, .chip:hover, .action:hover, .key:hover, .key:focus-visible { background: var(--hover); color: #fff; }

.list { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 4px 0 8px; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
h3 { margin: 10px 14px 4px; color: var(--muted); font-size: 11px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
ul { margin: 0; padding: 0; list-style: none; }
.key { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 14px; border: 0; background: none; text-align: left; }
.key:focus-visible { outline-offset: -2px; }
.key code { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.hint { display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 11px; opacity: 0; }
.key:hover .hint, .key:focus-visible .hint, .copied .hint { opacity: 1; }
.copied .hint, .status.ok { color: var(--ok); }
.status { flex: 1; min-width: 0; margin: 0; color: var(--muted); font-size: 12px; }
.status.error { color: #ff9b8f; }
.empty { margin: 0; padding: 22px 16px; color: var(--muted); text-align: center; }
.offscreen { position: fixed; left: -9999px; opacity: 0; }

@media (prefers-reduced-motion: reduce) { .badge.bump, .panel { animation: none; } }
@media print { .badge, .panel { display: none !important; } }
`;

const ICONS = {
    flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const POSITION_KEY = 'svelte-whisper-devtools';
let mounted = false;

export function mount({ keys, listen, clear }) {
    if (mounted || typeof document === 'undefined') return;
    mounted = true;

    const host = document.createElement('div');
    host.id = 'svelte-whisper-devtools';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${CSS}</style>
<button class="badge" type="button" aria-expanded="false" aria-controls="panel" hidden
    title="Missing translation keys. Drag, or Alt + arrow keys, to move.">${icon('flag')}<span class="n"></span></button>
<section class="panel" id="panel" role="dialog" aria-labelledby="title" tabindex="-1" hidden>
    <header><h2 id="title">Missing keys</h2><span class="total"></span>
        <button class="close" type="button" aria-label="Close">${icon('close')}</button></header>
    <div class="filters" role="group" aria-label="Show locale" hidden></div>
    <div class="list"><p class="empty" hidden>Nothing missing right now. Keys come back here the next time they are rendered.</p></div>
    <footer><p class="status" role="status"></p>
        <button class="action copy-all" type="button">Copy JSON</button>
        <button class="action clear" type="button">Clear</button></footer>
</section>`;

    const $ = selector => root.querySelector(selector);
    const badge = $('.badge'), panel = $('.panel'), list = $('.list'), filters = $('.filters');
    const status = $('.status'), empty = $('.empty'), copyAll = $('.copy-all');

    const entries = [];
    const groups = new Map(); // locale → { section, ul, count }
    let filter = '';
    let statusTimer, drag, suppressClick = false;

    // --- Entries: appended one at a time, never re-rendered ---

    function add(entry) {
        entries.push(entry);
        let group = groups.get(entry.locale);
        if (!group) {
            const section = document.createElement('section');
            section.innerHTML = `<h3><span></span><span class="c"></span></h3><ul></ul>`;
            section.querySelector('span').textContent = entry.locale;
            section.hidden = !!filter && filter !== entry.locale;
            group = { section, ul: section.querySelector('ul'), count: 0 };
            groups.set(entry.locale, group);
            list.append(section);
            filters.append(makeChip(entry.locale, entry.locale));
        }
        const li = document.createElement('li');
        li.innerHTML = `<button class="key" type="button"><code></code><span class="hint">${icon('copy')}Copy</span></button>`;
        const button = li.firstChild;
        button.firstChild.textContent = entry.key;
        button.dataset.key = entry.key;
        button.setAttribute('aria-label', `Copy ${entry.key} (${entry.locale})`);
        group.ul.append(li);
        group.section.querySelector('.c').textContent = `· ${++group.count}`;
    }

    function makeChip(label, value) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = label;
        chip.dataset.filter = value;
        chip.setAttribute('aria-pressed', String(filter === value));
        return chip;
    }

    function update(grew) {
        const n = entries.length;
        const label = n > 99 ? '99+' : String(n);
        $('.n').textContent = label;
        $('.total').textContent = label;
        badge.setAttribute('aria-label', `${n} missing translation key${n === 1 ? '' : 's'}`);
        badge.hidden = !n && panel.hidden;
        empty.hidden = !!n;
        copyAll.disabled = !n;
        filters.hidden = groups.size < 2;
        // A badge moved while hidden was clamped with zero width; clamp again now that it shows.
        if (!badge.hidden && badge.style.left) moveTo(parseFloat(badge.style.left), parseFloat(badge.style.top));
        if (grew) {
            badge.classList.remove('bump');
            void badge.offsetWidth; // restart the animation
            badge.classList.add('bump');
        }
    }

    function setFilter(value) {
        filter = value;
        for (const chip of filters.children) chip.setAttribute('aria-pressed', String(chip.dataset.filter === value));
        for (const [locale, group] of groups) group.section.hidden = !!value && value !== locale;
        copyAll.setAttribute('aria-label', value ? `Copy missing ${value} keys as JSON` : 'Copy all missing keys as JSON');
    }

    // --- Open, close, place ---

    function open() {
        panel.hidden = false;
        badge.setAttribute('aria-expanded', 'true');
        place();
        panel.focus();
        document.addEventListener('pointerdown', outside, true);
    }

    function close(returnFocus) {
        panel.hidden = true;
        badge.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', outside, true);
        update();
        if (returnFocus && !badge.hidden) badge.focus();
    }

    function outside(event) {
        if (!event.composedPath().includes(host)) close(false);
    }

    // Opens toward the side of the badge with more room and never leaves the viewport.
    function place() {
        if (panel.hidden) return;
        const rect = badge.getBoundingClientRect();
        const margin = 12, gap = 8;
        const width = Math.min(360, innerWidth - margin * 2);
        const below = innerHeight - rect.bottom - gap - margin;
        const above = rect.top - gap - margin;
        Object.assign(panel.style, {
            width: width + 'px',
            left: Math.max(margin, Math.min(rect.right - width, innerWidth - width - margin)) + 'px',
            top: below >= above ? rect.bottom + gap + 'px' : 'auto',
            bottom: below >= above ? 'auto' : innerHeight - rect.top + gap + 'px',
            maxHeight: Math.min(480, Math.max(below, above)) + 'px',
        });
    }

    // --- Moving the badge ---

    function moveTo(x, y, save) {
        x = Math.max(4, Math.min(x, innerWidth - badge.offsetWidth - 4));
        y = Math.max(4, Math.min(y, innerHeight - badge.offsetHeight - 4));
        Object.assign(badge.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
        place();
        if (save) try { sessionStorage.setItem(POSITION_KEY, JSON.stringify([x, y])); } catch { }
    }

    badge.addEventListener('pointerdown', event => {
        if (event.button) return;
        const rect = badge.getBoundingClientRect();
        drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
        badge.setPointerCapture(event.pointerId);
    });
    badge.addEventListener('pointermove', event => {
        if (!drag) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 4) return;
        drag.moved = true;
        badge.classList.add('dragging');
        moveTo(drag.left + dx, drag.top + dy);
    });
    const endDrag = () => {
        if (drag?.moved) {
            suppressClick = true;
            const rect = badge.getBoundingClientRect();
            moveTo(rect.left, rect.top, true);
        }
        badge.classList.remove('dragging');
        drag = null;
    };
    badge.addEventListener('pointerup', endDrag);
    badge.addEventListener('pointercancel', endDrag);
    badge.addEventListener('click', () => {
        if (suppressClick) return void (suppressClick = false);
        panel.hidden ? open() : close(false);
    });
    badge.addEventListener('keydown', event => {
        const step = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
        if (!step || !event.altKey) return;
        event.preventDefault();
        const rect = badge.getBoundingClientRect();
        moveTo(rect.left + step[0], rect.top + step[1], true);
    });
    addEventListener('resize', () => {
        if (badge.style.left) moveTo(parseFloat(badge.style.left), parseFloat(badge.style.top));
        place();
    }, { passive: true });

    // --- Panel actions: one delegated listener ---

    panel.addEventListener('click', event => {
        const target = event.target.closest('button');
        if (!target) return;
        if (target.classList.contains('close')) close(true);
        else if (target.classList.contains('chip')) setFilter(filter === target.dataset.filter ? '' : target.dataset.filter);
        else if (target.classList.contains('key')) copy(target.dataset.key, `Copied ${target.dataset.key}`, target);
        else if (target === copyAll) copySkeleton();
        else if (target.classList.contains('clear')) {
            clear();
            entries.length = 0;
            groups.clear();
            for (const section of list.querySelectorAll('section')) section.remove();
            filters.replaceChildren(makeChip('All', ''));
            setFilter('');
            update();
            say('Cleared. Keys still missing reappear when next rendered.');
            panel.focus();
        }
    });

    root.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) {
            event.stopPropagation();
            close(true);
        } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && event.target.classList?.contains('key')) {
            event.preventDefault();
            const visible = [...list.querySelectorAll('section:not([hidden]) .key')];
            visible[visible.indexOf(event.target) + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
        }
    });

    // --- Clipboard: async API on secure origins, execCommand fallback elsewhere ---

    function copySkeleton() {
        const locales = filter ? [filter] : [...groups.keys()];
        const tree = {};
        for (const { locale, key } of entries) {
            if (!locales.includes(locale)) continue;
            let node = locales.length > 1 ? (tree[locale] ??= {}) : tree;
            const parts = key.split('.');
            const last = parts.pop();
            for (const part of parts) node = node[part] = typeof node[part] === 'object' ? node[part] : {};
            if (!(last in node)) node[last] = '';
        }
        const count = entries.filter(entry => locales.includes(entry.locale)).length;
        copy(JSON.stringify(tree, null, 4), `Copied ${count} key${count === 1 ? '' : 's'} as JSON`);
    }

    async function copy(text, message, button) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            if (!legacyCopy(text)) return say('Could not copy: this page has no clipboard access.', 'error');
        }
        say(message, 'ok');
        if (button) {
            button.classList.add('copied');
            setTimeout(() => button.classList.remove('copied'), 1200);
        }
    }

    function legacyCopy(text) {
        const focused = root.activeElement;
        const area = document.createElement('textarea');
        area.className = 'offscreen';
        area.value = text;
        area.setAttribute('readonly', '');
        root.append(area);
        area.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { }
        area.remove();
        focused?.focus();
        return ok;
    }

    function say(message, tone = '') {
        clearTimeout(statusTimer);
        status.textContent = message;
        status.className = `status ${tone}`;
        statusTimer = setTimeout(() => { status.textContent = ''; }, 2500);
    }

    // --- Start ---

    filters.append(makeChip('All', ''));
    setFilter('');
    for (const entry of keys()) add(entry);
    document.body.append(host);
    update();
    try {
        const saved = JSON.parse(sessionStorage.getItem(POSITION_KEY));
        if (saved) moveTo(saved[0], saved[1]);
    } catch { }

    listen(entry => {
        add(entry);
        update(true);
    });
}
