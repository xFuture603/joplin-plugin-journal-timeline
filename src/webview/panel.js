// Panel-side script. It is loaded once, when the panel is created, and is *not*
// re-executed when the plugin calls setHtml() - that only swaps the content of
// the plugin container. Listeners therefore have to live on `document`, which
// outlives every re-render; anything bound to an element inside the panel would
// stop working after the first refresh.

(() => {
	const send = (message) => {
		if (typeof webviewApi === 'undefined') {
			console.error('Journal Timeline: webviewApi is unavailable');
			return;
		}

		webviewApi.postMessage(message).catch((error) => {
			console.error('Journal Timeline: the plugin rejected a message', message, error);
		});
	};

	// Attachments render as thumbnails; clicking one toggles it to full width.
	// Tracked by src so the choice survives a re-render.
	const expandedImages = new Set();

	const restoreExpandedImages = (root) => {
		if (!expandedImages.size) return;

		for (const image of root.querySelectorAll('.jt-md img')) {
			if (expandedImages.has(image.getAttribute('src'))) image.classList.add('-expanded');
		}
	};

	// Links inside an entry are plain anchors, so letting one through would
	// navigate the whole panel away from the reader. Caught during capture so
	// the click never reaches the anchor, then handed to the app to open in the
	// right place - Joplin's `openItem` resolves note links, files and URLs.
	document.addEventListener('click', (event) => {
		const link = event.target instanceof Element ? event.target.closest('.jt-md a') : null;
		if (!link) return;

		event.preventDefault();
		event.stopPropagation();

		const url = link.getAttribute('href');

		// "#foo" is an anchor within the note, which means nothing here.
		if (url && url.charAt(0) !== '#') send({ type: 'openLink', url: url });
	}, true);

	// Anything that is not a link, an image or a form control opens the entry.
	const opensEntry = (element) => {
		return !element.closest('.jt-md a, .jt-md input, .jt-md label, .jt-md textarea, .jt-md select');
	};

	// Distinguishes a click from the end of a drag-select: at click time a plain
	// click has already collapsed any selection, while a drag leaves one behind.
	const isSelectingText = () => {
		const selection = window.getSelection();
		return !!selection && !selection.isCollapsed && selection.toString().trim() !== '';
	};

	document.addEventListener('click', (event) => {
		const image = event.target;
		if (image instanceof HTMLImageElement && image.closest('.jt-md')) {
			// Stops a linked image from navigating the panel away.
			event.preventDefault();

			const src = image.getAttribute('src');
			if (image.classList.toggle('-expanded')) expandedImages.add(src);
			else expandedImages.delete(src);
			return;
		}

		const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
		if (!target) return;

		switch (target.getAttribute('data-action')) {
			case 'refresh':
				send({ type: 'refresh' });
				break;
			case 'open-today':
				send({ type: 'openToday' });
				break;
			case 'open-note':
				// Reading an entry means selecting text in it, which must not be
				// mistaken for a click on the entry.
				if (isSelectingText() || !opensEntry(event.target)) return;
				send({ type: 'openNote', noteId: target.getAttribute('data-note-id') });
				break;
		}
	});

	// The plugin pushes the editor's note selection here instead of re-rendering,
	// so the highlight moves without rebuilding the reader. `null` means nothing
	// has been pushed yet and the server-rendered highlight should stand.
	let selectedNoteIds = null;

	const applySelection = (root) => {
		if (!selectedNoteIds) return;

		for (const article of root.querySelectorAll('.jt-entry[data-note-id]')) {
			const isSelected = selectedNoteIds.indexOf(article.getAttribute('data-note-id')) !== -1;
			article.classList.toggle('jt-entry--selected', isSelected);
		}
	};

	if (typeof webviewApi !== 'undefined') {
		webviewApi.onMessage((event) => {
			const message = event && event.message;
			if (!message || message.type !== 'selection') return;

			selectedNoteIds = message.noteIds || [];
			applySelection(document);
		});
	}

	// A re-render replaces the scrolling element, which would otherwise throw the
	// reader back to the top every time any note changed. Track the position and
	// put it back once the new content is in place.
	let savedScroll = 0;

	document.addEventListener('scroll', (event) => {
		const target = event.target;
		if (target instanceof Element && target.classList.contains('jt-scroll')) {
			savedScroll = target.scrollTop;
		}
	}, true); // Capture: scroll events do not bubble.

	// The heading names the year you are reading. Entries crossing the top of the
	// reader are what counts, so the year changes as that boundary is passed.
	let yearSpy = null;

	const trackVisibleYear = (root, scroller) => {
		if (yearSpy) yearSpy.disconnect();

		const heading = root.querySelector('.jt-topbar__title');
		if (!scroller || !heading) return;

		const atTop = new Set();

		const showTopmostYear = () => {
			let topmost = null;
			atTop.forEach((entry) => {
				if (!topmost || entry.offsetTop < topmost.offsetTop) topmost = entry;
			});

			// With nothing in the band - in the padding below the last entry, say -
			// the heading keeps whatever it last showed.
			if (!topmost) return;

			const year = topmost.getAttribute('data-year');
			if (year && heading.textContent.trim() !== year) heading.textContent = year;
		};

		yearSpy = new IntersectionObserver((records) => {
			for (const record of records) {
				if (record.isIntersecting) atTop.add(record.target);
				else atTop.delete(record.target);
			}

			showTopmostYear();
		}, {
			root: scroller,
			// Narrows the observed region to a band across the top of the reader.
			rootMargin: '0px 0px -80% 0px',
		});

		for (const entry of root.querySelectorAll('.jt-entry[data-year]')) yearSpy.observe(entry);
	};

	// Everything that has to be reapplied after the plugin swaps the content in.
	let lastScroller = null;

	const onContentReplaced = (root) => {
		const scroller = root.querySelector('.jt-scroll');

		// Identity only changes on a real re-render. Without this guard, writing
		// the year into the heading would itself trip the observer and loop.
		if (scroller === lastScroller) return;
		lastScroller = scroller;

		if (scroller && savedScroll) scroller.scrollTop = savedScroll;
		restoreExpandedImages(root);
		applySelection(root);
		trackVisibleYear(root, scroller);
	};

	const watchForRerender = () => {
		const root = document.getElementById('joplin-plugin-content');

		// The host creates this container on DOMContentLoaded, which may not have
		// happened yet when this script runs.
		if (!root) {
			setTimeout(watchForRerender, 50);
			return;
		}

		new MutationObserver(() => onContentReplaced(root)).observe(root, { childList: true, subtree: true });

		// The panel may already hold content by the time this script runs.
		onContentReplaced(root);
	};

	watchForRerender();
})();
