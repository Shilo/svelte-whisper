// App-wide status messages. Errors stay until dismissed; other messages clear
// themselves. A message that names files or lost edits is pinned: it stays, above
// the others, until the user closes it.

/** @typedef {{ text: string, tone: 'info' | 'error' | 'success', action?: { label: string, href?: string, run?: () => void } }} Toast */

export const toast = $state({ /** @type {Toast | null} */ current: null, /** @type {Toast | null} */ pinned: null });

let timer = 0;

/**
 * @param {string} text @param {Toast['tone']} [tone] @param {Toast['action']} [action]
 * @param {boolean} [pin]  keep it until the user closes it
 */
export function notify(text, tone = 'info', action, pin = false) {
	if (pin) {
		toast.pinned = { text, tone, action };
		return;
	}
	clearTimeout(timer);
	toast.current = { text, tone, action };
	if (tone !== 'error') timer = window.setTimeout(dismiss, action ? 10000 : 5000);
}

/** @param {'current' | 'pinned'} [which] */
export function dismiss(which = 'current') {
	if (which === 'current') clearTimeout(timer);
	toast[which] = null;
}
