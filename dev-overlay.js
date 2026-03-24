// svelte-whisper dev overlay — missing translation key reporter
// Dynamically imported only when import.meta.env.DEV is true.
// Completely tree-shaken from production builds.

const STYLES = `
    :host { all: initial; }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .sw-container {
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 2147483647;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        line-height: 1.5;
        direction: ltr;
        text-align: left;
    }

    /* ---- Badge ---- */

    .sw-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 12px 0 10px;
        border: none;
        border-radius: 99px;
        background: #b45309;
        color: #fef3c7;
        font: 600 12px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0.01em;
        cursor: pointer;
        box-shadow:
            0 1px 3px rgba(0,0,0,0.35),
            0 0 0 1px rgba(180,83,9,0.25),
            inset 0 1px 0 rgba(255,255,255,0.08);
        transition: transform 0.12s cubic-bezier(0.2,0,0,1), box-shadow 0.12s ease;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
    }
    .sw-badge:hover {
        transform: translateY(-1px);
        box-shadow:
            0 4px 12px rgba(0,0,0,0.4),
            0 0 0 1px rgba(180,83,9,0.35),
            inset 0 1px 0 rgba(255,255,255,0.1);
    }
    .sw-badge:active { transform: translateY(0); }

    .sw-badge-icon { font-size: 14px; line-height: 1; }

    @keyframes sw-bump {
        0%   { transform: scale(1); }
        40%  { transform: scale(1.08); }
        100% { transform: scale(1); }
    }
    .sw-badge.bump { animation: sw-bump 0.25s cubic-bezier(0.2,0,0,1); }

    /* ---- Panel ---- */

    .sw-panel {
        position: absolute;
        bottom: 44px;
        right: 0;
        width: 340px;
        max-height: 55vh;
        background: #1c1917;
        border: 1px solid rgba(245,158,11,0.08);
        border-radius: 10px;
        box-shadow:
            0 16px 48px rgba(0,0,0,0.5),
            0 0 0 1px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        opacity: 0;
        transform: translateY(6px);
        pointer-events: none;
        transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.2,0,0,1);
        overflow: hidden;
    }
    .sw-panel.open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
    }

    /* ---- Header ---- */

    .sw-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
    }
    .sw-title {
        flex: 1;
        font-weight: 600;
        font-size: 12px;
        color: #a8a29e;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .sw-header-count {
        font-size: 11px;
        font-weight: 700;
        color: #f59e0b;
        background: rgba(245,158,11,0.1);
        padding: 1px 7px;
        border-radius: 99px;
        min-width: 20px;
        text-align: center;
    }
    .sw-close {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        border-radius: 6px;
        color: #57534e;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.1s, color 0.1s;
        line-height: 1;
    }
    .sw-close:hover { background: rgba(255,255,255,0.06); color: #d6d3d1; }

    /* ---- List ---- */

    .sw-list {
        flex: 1;
        overflow-y: auto;
        padding: 4px 0;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: rgba(120,113,108,0.3) transparent;
    }
    .sw-list::-webkit-scrollbar { width: 4px; }
    .sw-list::-webkit-scrollbar-track { background: transparent; }
    .sw-list::-webkit-scrollbar-thumb { background: rgba(120,113,108,0.3); border-radius: 99px; }

    @keyframes sw-slide-in {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
    }

    .sw-entry {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        cursor: pointer;
        border-left: 2px solid transparent;
        transition: background 0.08s, border-color 0.08s;
        animation: sw-slide-in 0.12s ease both;
    }
    .sw-entry:hover {
        background: rgba(255,255,255,0.03);
        border-left-color: #d97706;
    }
    .sw-entry:active { background: rgba(255,255,255,0.05); }

    .sw-key {
        flex: 1;
        font-family: 'SF Mono', ui-monospace, 'Cascadia Code', 'Fira Code', Consolas, monospace;
        font-size: 12px;
        color: #e7e5e4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .sw-locale {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #d97706;
        background: rgba(217,119,6,0.1);
        padding: 2px 6px;
        border-radius: 4px;
        flex-shrink: 0;
    }
    .sw-copy-hint {
        font-size: 10px;
        color: #57534e;
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.1s;
    }
    .sw-entry:hover .sw-copy-hint { opacity: 1; }
    .sw-copied { color: #16a34a !important; }

    /* ---- Footer ---- */

    .sw-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-top: 1px solid rgba(255,255,255,0.06);
    }
    .sw-brand {
        font-size: 10px;
        color: #44403c;
        letter-spacing: 0.02em;
    }
    .sw-clear {
        background: none;
        border: 1px solid rgba(255,255,255,0.08);
        color: #78716c;
        font-size: 11px;
        font-weight: 500;
        padding: 3px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.1s;
    }
    .sw-clear:hover {
        color: #d6d3d1;
        border-color: rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.04);
    }

    /* ---- Empty ---- */

    .sw-empty {
        padding: 24px 12px;
        text-align: center;
        color: #57534e;
        font-size: 12px;
    }

    /* ---- Mobile ---- */

    @media (max-width: 480px) {
        .sw-container { right: 12px; bottom: 12px; left: auto; }
        .sw-panel {
            position: fixed;
            bottom: 52px;
            left: 12px;
            right: 12px;
            width: auto;
            max-height: 45vh;
            border-radius: 12px;
        }
    }
`;

const TEMPLATE = `
    <div class="sw-container">
        <button class="sw-badge" aria-label="Missing translations" style="display:none">
            <span class="sw-badge-icon">\u{1F50D}</span>
            <span class="sw-count">0</span>
        </button>
        <div class="sw-panel" role="dialog" aria-label="Missing translation keys" aria-hidden="true">
            <div class="sw-header">
                <span class="sw-title">Missing Keys</span>
                <span class="sw-header-count">0</span>
                <button class="sw-close" aria-label="Close">\u00D7</button>
            </div>
            <div class="sw-list">
                <div class="sw-empty">No missing keys detected</div>
            </div>
            <div class="sw-footer">
                <span class="sw-brand">svelte-whisper</span>
                <button class="sw-clear">Clear</button>
            </div>
        </div>
    </div>
`;

let mounted = false;

export function mount({ subscribe, getKeys, clear }) {
    if (mounted || typeof document === 'undefined') return;
    mounted = true;

    const entries = getKeys();
    let expanded = false;

    // Build Shadow DOM
    const host = document.createElement('div');
    host.id = 'svelte-whisper-devtools';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>${STYLES}</style>${TEMPLATE}`;

    const badge = shadow.querySelector('.sw-badge');
    const panel = shadow.querySelector('.sw-panel');
    const listEl = shadow.querySelector('.sw-list');
    const countEl = shadow.querySelector('.sw-count');
    const headerCountEl = shadow.querySelector('.sw-header-count');

    // Event listeners
    badge.addEventListener('click', () => setExpanded(!expanded));
    shadow.querySelector('.sw-close').addEventListener('click', () => setExpanded(false));
    shadow.querySelector('.sw-clear').addEventListener('click', () => {
        clear();
        entries.length = 0;
        render();
    });

    // Escape key closes panel
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && expanded) setExpanded(false);
    });

    // Click outside closes panel
    document.addEventListener('pointerdown', (e) => {
        if (expanded && !host.contains(e.target)) setExpanded(false);
    });

    document.body.appendChild(host);
    render();

    subscribe(entry => {
        if (entry === null) { entries.length = 0; }
        else entries.push(entry);
        render();
    });

    function setExpanded(val) {
        expanded = val;
        panel.classList.toggle('open', val);
        panel.setAttribute('aria-hidden', String(!val));
    }

    function copyKey(key, hintEl) {
        navigator.clipboard.writeText(key).then(() => {
            hintEl.textContent = 'copied!';
            hintEl.classList.add('sw-copied');
            setTimeout(() => {
                hintEl.textContent = 'click to copy';
                hintEl.classList.remove('sw-copied');
            }, 1200);
        }).catch(() => {});
    }

    function render() {
        const n = entries.length;
        const label = n > 99 ? '99+' : String(n);
        countEl.textContent = label;
        headerCountEl.textContent = label;
        badge.style.display = n ? '' : 'none';

        if (!n && expanded) setExpanded(false);

        // Bump animation on new entry
        if (n) {
            badge.classList.remove('bump');
            void badge.offsetWidth;
            badge.classList.add('bump');
        }

        if (!n) {
            listEl.innerHTML = '<div class="sw-empty">No missing keys detected</div>';
            return;
        }

        listEl.innerHTML = entries.map((e, i) =>
            `<div class="sw-entry" data-idx="${i}" style="animation-delay:${Math.min(i * 20, 200)}ms">` +
                `<code class="sw-key">${esc(e.key)}</code>` +
                `<span class="sw-locale">${esc(e.locale)}</span>` +
                `<span class="sw-copy-hint">click to copy</span>` +
            `</div>`
        ).join('');

        // Attach copy handlers
        listEl.querySelectorAll('.sw-entry').forEach(el => {
            el.addEventListener('click', () => {
                const idx = +el.dataset.idx;
                const hint = el.querySelector('.sw-copy-hint');
                if (entries[idx]) copyKey(entries[idx].key, hint);
            });
        });
    }
}

function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
