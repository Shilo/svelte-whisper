// Sample locale files for the no-sign-in demo. Loaded on demand only.
// They mix nested objects and flat dotted keys, use {name}, {0} and {}
// placeholders, and leave deliberate gaps so every editor state is visible.

const en = {
	app: {
		title: 'Fieldnotes',
		tagline: 'Notes that stay out of your way.'
	},
	nav: {
		home: 'Home',
		notebooks: 'Notebooks',
		search: 'Search',
		settings: 'Settings'
	},
	greeting: 'Welcome back, {name}.',
	notes: {
		count: '{0} notes in {1}',
		empty: 'No notes yet. Start with a title.',
		new: 'New note',
		pinned: 'Pinned',
		updated: 'Edited {time}',
		delete_confirm: 'Delete “{title}”? This cannot be undone.'
	},
	share: {
		title: 'Share notebook',
		invite: 'Invite people by email',
		link_copied: 'Link copied',
		people: 'Shared with {} and {} others'
	},
	sync: {
		offline: 'You are offline. Changes will sync when you reconnect.',
		done: 'All changes saved',
		conflict: 'This note changed on another device.'
	},
	'errors.network': 'Could not reach the server. Check your connection.',
	'errors.not_found': 'That note no longer exists.',
	'footer.version': 'Version {version}'
};

const es = {
	app: { title: 'Fieldnotes', tagline: 'Notas que no estorban.' },
	nav: { home: 'Inicio', notebooks: 'Cuadernos', search: 'Buscar', settings: 'Ajustes' },
	greeting: 'Hola de nuevo, {name}.',
	notes: {
		count: '{0} notas en {1}',
		empty: 'Aún no hay notas. Empieza con un título.',
		new: 'Nota nueva',
		pinned: 'Fijadas',
		updated: 'Editada {time}',
		delete_confirm: '¿Eliminar «{title}»? No se puede deshacer.'
	},
	share: {
		title: 'Compartir cuaderno',
		invite: 'Invitar por correo',
		link_copied: 'Enlace copiado',
		people: 'Compartido con {} y {} más'
	},
	sync: {
		offline: 'Sin conexión. Los cambios se sincronizarán al volver.',
		done: 'Todo guardado'
	},
	'errors.network': 'No se pudo conectar con el servidor.',
	'errors.not_found': 'Esa nota ya no existe.',
	'footer.version': 'Versión {version}'
};

const fr = {
	app: { title: 'Fieldnotes', tagline: 'Des notes qui restent discrètes.' },
	nav: { home: 'Accueil', notebooks: 'Carnets', search: 'Rechercher', settings: 'Réglages' },
	greeting: 'Bon retour, {nom}.',
	notes: {
		count: '{0} notes dans {1}',
		empty: 'Aucune note pour le moment.',
		new: 'Nouvelle note',
		updated: 'Modifiée {time}'
	},
	share: {
		title: 'Partager le carnet',
		link_copied: 'Lien copié'
	},
	sync: {
		done: 'Modifications enregistrées'
	},
	'errors.network': 'Impossible de joindre le serveur.',
	'footer.version': 'Version {version}'
};

const de = {
	app: { title: 'Fieldnotes', tagline: 'Notizen, die nicht im Weg sind.' },
	nav: { home: 'Start', notebooks: 'Notizbücher', search: 'Suche', settings: 'Einstellungen' },
	greeting: 'Willkommen zurück, {name}.',
	notes: {
		count: '{0} Notizen in {1}',
		new: 'Neue Notiz',
		pinned: 'Angeheftet'
	},
	share: { title: 'Notizbuch teilen' },
	'footer.version': 'Version {version}'
};

const ja = {
	app: { title: 'Fieldnotes', tagline: '邪魔をしないノート。' },
	nav: { home: 'ホーム', notebooks: 'ノートブック', search: '検索', settings: '設定' },
	greeting: 'おかえりなさい、{name}さん。',
	notes: {
		count: '{1}に{0}件のノート',
		empty: 'ノートはまだありません。',
		new: '新しいノート'
	},
	sync: { offline: 'オフラインです。再接続すると同期されます。' }
};

/** @type {Record<string, object>} */
const files = { en, es, fr, de, ja };

/** Sample files as the repository would serve them. */
export const demoFiles = Object.entries(files).map(([lang, data]) => ({
	name: `${lang}.json`,
	path: `src/locales/${lang}.json`,
	sha: `demo-${lang}`,
	text: JSON.stringify(data, null, '\t') + '\n'
}));
