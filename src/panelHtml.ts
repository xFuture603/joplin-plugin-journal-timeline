import { JournalEntry } from './journal';
import { daysFromToday, parseJournalTitle, sameDayYearsAgo } from './dates';

export type FolderStatus =
	/** A notebook is selected and was found. */
	| 'ready'
	/** No notebook selected yet; one will be created on the first entry. */
	| 'pending'
	/** A notebook was selected but has since been deleted. */
	| 'missing';

export interface PanelState {
	/** Notebook path, or the name of the notebook still to be created. */
	folderLabel: string;
	status: FolderStatus;
	entries: JournalEntry[];
	/** Rendered note body per entry id. */
	bodies: Map<string, string>;
	todayTitle: string;
	maxEntries: number;
	truncated: boolean;
	/** When false, attachments are hidden with CSS - the render cache is untouched. */
	showImages: boolean;
	/** Today's date in earlier years, shown above the stream. Empty when off. */
	onThisDay: JournalEntry[];
	/**
	 * Root size in px, from Joplin's editor setting. Every other size in the
	 * panel is in `em`, so this one value scales the whole reader. 0 leaves the
	 * stylesheet's `--joplin-font-size` in charge.
	 */
	fontSize: number;
	/** Notes currently open in the editor, highlighted in the reader. */
	selectedNoteIds: string[];
}

const HTML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	'\'': '&#39;',
};

// Note titles and notebook paths are user content, so they are never
// interpolated into the panel markup as-is. Rendered note bodies are the one
// exception: they are HTML by definition, already sanitised by Joplin's
// renderer, and setHtml() assigns through innerHTML, which does not run
// scripts.
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => HTML_ESCAPES[char]);

/**
 * "Friday, 7 August". No year: the heading tracks the year you are scrolled to,
 * and the note's own title carries the full date in the button's tooltip.
 */
const formatEntryDate = (date: Date): string => date.toLocaleDateString(undefined, {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
});

/**
 * "12 August 2023", for an "on this day" card. The year leads instead of the
 * weekday: it is the only thing separating that card from today's, which sits
 * right above it under the same day and month. Which weekday it fell on years
 * ago is not why you are reading it.
 */
const formatPastDate = (date: Date): string => date.toLocaleDateString(undefined, {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
});

const relativeLabel = (date: Date): string => {
	const offset = daysFromToday(date);
	if (offset === 0) return 'Today';
	if (offset === -1) return 'Yesterday';
	if (offset === 1) return 'Tomorrow';
	return '';
};

/**
 * "3 years ago" for an "on this day" card. The date heading deliberately omits
 * the year, so without this the card would read as an undated repeat of today.
 */
const yearsAgoLabel = (date: Date): string => {
	const years = sameDayYearsAgo(date);
	if (!years) return '';

	return years === 1 ? '1 year ago' : `${years} years ago`;
};

/** Font Awesome 5 is already loaded in plugin webviews; FA6-only names render blank. */
const renderTopBar = (title: string, folderLabel: string): string => `
	<header class="jt-topbar">
		<div class="jt-topbar__lead">
			<span class="jt-topbar__folder" title="${escapeHtml(folderLabel)}">${escapeHtml(folderLabel)}</span>
		</div>
		<h1 class="jt-topbar__title">${escapeHtml(title)}</h1>
		<div class="jt-topbar__actions">
			<span class="jt-pick">
				<button type="button" class="jt-icon-button" data-action="pick-date" title="Open another day" aria-label="Open another day">
					<i class="fas fa-calendar-alt" aria-hidden="true"></i>
				</button>
				<input type="date" class="jt-pick__input" aria-hidden="true" tabindex="-1">
			</span>
			<button type="button" class="jt-icon-button" data-action="open-today" title="Open today's entry" aria-label="Open today's entry">
				<i class="fas fa-pen" aria-hidden="true"></i>
			</button>
		</div>
	</header>
`;

const renderNotice = (message: string, modifier = ''): string => `
	<p class="jt-notice${modifier}">${escapeHtml(message)}</p>
`;

const renderBadge = (label: string): string => {
	if (!label) return '';

	// Today gets a pill so it stays findable now that it has no filled card.
	const modifier = label === 'Today' ? ' jt-entry__badge--today' : '';
	return `<span class="jt-entry__badge${modifier}">${escapeHtml(label)}</span>`;
};

const renderEntryHeader = (entry: JournalEntry, badge: string, dateLabel: string): string => `
	<div class="jt-entry__header">
		<button type="button" class="jt-entry__date" data-action="open-note" data-note-id="${escapeHtml(entry.id)}" title="Open ${escapeHtml(entry.title)}">
			${escapeHtml(dateLabel)}
		</button>
		${renderBadge(badge)}
	</div>
`;

interface EntryOptions {
	isToday?: boolean;
	isSelected?: boolean;
	/** Replaces the relative-day badge; "on this day" cards name the gap in years. */
	badge?: string;
	/** Replaces the date heading; "on this day" cards carry their year. */
	dateLabel?: string;
	/**
	 * Whether panel.js's year spy should watch this entry. Off for "on this day"
	 * cards: they sit above the stream, so letting them carry data-year would
	 * retitle the heading to a year the reader has not scrolled to.
	 */
	trackYear?: boolean;
}

// data-note-id lets panel.js move the selection highlight without a re-render.
// data-action on the article makes the whole entry open its note; the heading
// stays a real button so the entry is still reachable by keyboard.
const renderEntry = (entry: JournalEntry, body: string, options: EntryOptions = {}): string => {
	const {
		isToday = false,
		isSelected = false,
		badge = relativeLabel(entry.date),
		dateLabel = formatEntryDate(entry.date),
		trackYear = true,
	} = options;

	return `
		<article class="jt-entry${isToday ? ' jt-entry--today' : ''}${isSelected ? ' jt-entry--selected' : ''}" data-action="open-note" data-note-id="${escapeHtml(entry.id)}"${trackYear ? ` data-year="${entry.date.getFullYear()}"` : ''}>
			${renderEntryHeader(entry, badge, dateLabel)}
			${body
			? `<div class="jt-md">${body}</div>`
			: `<p class="jt-entry__empty">This entry is empty. <button type="button" class="jt-link" data-action="open-note" data-note-id="${escapeHtml(entry.id)}">Write something</button></p>`}
		</article>
	`;
};

/** The same date in earlier years, rendered in full above the stream. */
const renderOnThisDay = (entries: JournalEntry[], bodies: Map<string, string>, selected: Set<string>): string => {
	if (!entries.length) return '';

	const cards = entries.map(entry => renderEntry(entry, bodies.get(entry.id) ?? '', {
		isSelected: selected.has(entry.id),
		badge: yearsAgoLabel(entry.date),
		dateLabel: formatPastDate(entry.date),
		trackYear: false,
	})).join('');

	return `
		<section class="jt-onthisday">
			<h2 class="jt-onthisday__title">On this day</h2>
			${cards}
		</section>
	`;
};

/** Stand-in card for a day that has no note yet. */
const renderPlaceholder = (todayTitle: string): string => {
	const date = parseJournalTitle(todayTitle);

	return `
		<article class="jt-entry jt-entry--today jt-entry--placeholder" data-year="${(date ?? new Date()).getFullYear()}">
			<div class="jt-entry__header">
				<span class="jt-entry__date jt-entry__date--plain">${escapeHtml(date ? formatEntryDate(date) : todayTitle)}</span>
				${renderBadge('Today')}
			</div>
			<button type="button" class="jt-start" data-action="open-today">
				<i class="fas fa-plus" aria-hidden="true"></i> Start today's entry
			</button>
		</article>
	`;
};

const renderStatusNotice = (state: PanelState): string => {
	if (state.status === 'missing') {
		return renderNotice('The selected notebook no longer exists. Choose another in Preferences → Journal Timeline.', ' jt-notice--warn');
	}

	if (state.status === 'pending') {
		return renderNotice(`No notebook selected yet. "${state.folderLabel}" is created the first time you add an entry - or pick an existing notebook in Preferences → Journal Timeline.`, ' jt-notice--warn');
	}

	if (!state.entries.length) {
		return renderNotice('No dated notes in this notebook yet. Notes appear here once their title is a date, such as 2026-01-31.');
	}

	return '';
};

export const buildPanelHtml = (state: PanelState): string => {
	const { entries, bodies, todayTitle, maxEntries, truncated } = state;

	// The heading names the year you are reading, not the range the panel holds -
	// panel.js retargets it as you scroll. This is only the starting value, for
	// the top of the list.
	const openingYear = (entries.length ? entries[0].date : new Date()).getFullYear();

	const todayIndex = entries.findIndex(entry => entry.title === todayTitle);

	// Offering to start today's entry against a notebook that has vanished would
	// silently recreate it, so the placeholder is held back.
	const placeholder = todayIndex >= 0 || state.status === 'missing' ? '' : renderPlaceholder(todayTitle);

	const selected = new Set(state.selectedNoteIds);
	const renderStreamEntry = (entry: JournalEntry) => renderEntry(entry, bodies.get(entry.id) ?? '', {
		isToday: entry.title === todayTitle,
		isSelected: selected.has(entry.id),
	});

	// "On this day" is slotted in under today rather than above it. Today is what
	// the panel is for, and leading with a card from years back - headed by the
	// same day and month - reads as though the panel opened on the wrong date.
	// With no note for today the split lands at 0, which puts the section just
	// below the placeholder standing in for it.
	const splitAt = todayIndex + 1;
	const throughToday = entries.slice(0, splitAt).map(renderStreamEntry).join('');
	const earlier = entries.slice(splitAt).map(renderStreamEntry).join('');

	const footer = truncated
		? renderNotice(`Showing the ${maxEntries} most recent entries. Change the limit in Preferences → Journal Timeline.`)
		: '';

	return `
		<div class="jt${state.showImages ? '' : ' jt--no-images'}"${state.fontSize ? ` style="font-size: ${state.fontSize}px"` : ''}>
			${renderTopBar(`${openingYear}`, state.folderLabel)}
			<div class="jt-scroll">
				${renderStatusNotice(state)}
				${placeholder}
				${throughToday}
				${renderOnThisDay(state.onThisDay, bodies, selected)}
				${earlier}
				${footer}
			</div>
		</div>
	`;
};

// The reader refreshes itself on note, sync, settings and date changes, so the
// only place a manual retry earns its keep is here, where the last attempt
// failed.
export const buildErrorHtml = (folderLabel: string, message: string): string => `
	<div class="jt">
		${renderTopBar('Journal', folderLabel)}
		<div class="jt-scroll">
			${renderNotice(`The timeline could not be loaded: ${message}`, ' jt-notice--error')}
			<p class="jt-notice"><button type="button" class="jt-link" data-action="refresh">Try again</button></p>
		</div>
	</div>
`;
