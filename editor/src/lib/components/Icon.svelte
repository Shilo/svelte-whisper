<script>
	/** One stroke icon set, 24px grid, 1.75 stroke. Decorative unless labelled by the parent. */
	const paths = {
		search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
		plus: 'M12 5v14M5 12h14',
		more: 'M5 12h.01M12 12h.01M19 12h.01',
		trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
		undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
		settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
		out: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
		copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
		x: 'M6 6l12 12M18 6 6 18',
		check: 'M5 12.5 10 17 19 7',
		download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
		next: 'M12 5v14M6 13l6 6 6-6',
		external: 'M14 5h5v5M19 5l-8 8M17 14v5H5V7h5',
		pencil: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
		send: 'M4 12 20 4l-4 16-4-7-8-1zM12 13l8-9',
		lang: 'M4 5h9M8.5 3v2M6 5c0 4 3 7 7 8M11 5c0 4-3 7-7 9M13 21l4-9 4 9M14.5 18h5'
	};

	/** @type {{ name: keyof typeof paths, size?: number }} */
	let { name, size = 18 } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"><path d={paths[name]} /></svg
>
