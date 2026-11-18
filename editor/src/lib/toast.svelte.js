// A single, app-wide status message. Errors stay until dismissed; other
// messages clear themselves.

/** @typedef {{ text: string, tone: 'info' | 'error' | 'success', action?: { label: string, href?: string, run?: () => void } }} Toast */

export const toast = $state({ /** @type {Toast | null} */ current: null });

let timer = 0;

/** @param {string} text @param {Toast['tone']} [tone] @param {Toast['action']} [action] */
export function notify(text, tone = 'info', action) {
	clearTimeout(timer);
	toast.current = { text, tone, action };
	if (tone !== 'error') timer = window.setTimeout(dismiss, action ? 10000 : 5000);
}

export function dismiss() {
	clearTimeout(timer);
	toast.current = null;
}
