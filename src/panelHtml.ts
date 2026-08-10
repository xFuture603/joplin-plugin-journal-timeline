import { JournalEntry } from './journal';
import { daysFromToday, parseJournalTitle } from './dates';

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

const relativeLabel = (date: Date): string => {
	const offset = daysFromToday(date);
	if (offset === 0) return 'Today';
	if (offset === -1) return 'Yesterday';
	if (offset === 1) return 'Tomorrow';
	return '';
};

const iconButton = (action: string, icon: string, label: string): string => `
	<button type="button" class="jt-icon-button" data-action="${action}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
		<i class="fas ${icon}" aria-hidden="true"></i>
	</button>
`;

/** Font Awesome 5 is already loaded in plugin webviews; FA6-only names render blank. */
const renderTopBar = (title: string, folderLabel: string): string => `
	<header class="jt-topbar">
		<div class="jt-topbar__lead">
			<span class="jt-topbar__folder" title="${escapeHtml(folderLabel)}">${escapeHtml(folderLabel)}</span>
		</div>
		<h1 class="jt-topbar__title">${escapeHtml(title)}</h1>
		<div class="jt-topbar__actions">
			${iconButton('open-today', 'fa-calendar-day', 'Go to today')}
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

const renderEntryHeader = (entry: JournalEntry): string => `
	<div class="jt-entry__header">
		<button type="button" class="jt-entry__date" data-action="open-note" data-note-id="${escapeHtml(entry.id)}" title="Open ${escapeHtml(entry.title)}">
			${escapeHtml(formatEntryDate(entry.date))}
		</button>
		${renderBadge(relativeLabel(entry.date))}
	</div>
`;

// data-note-id lets panel.js move the selection highlight without a re-render.
// data-action on the article makes the whole entry open its note; the heading
// stays a real button so the entry is still reachable by keyboard.
const renderEntry = (entry: JournalEntry, body: string, isToday: boolean, isSelected: boolean): string => `
	<article class="jt-entry${isToday ? ' jt-entry--today' : ''}${isSelected ? ' jt-entry--selected' : ''}" data-action="open-note" data-note-id="${escapeHtml(entry.id)}" data-year="${entry.date.getFullYear()}">
		${renderEntryHeader(entry)}
		${body
		? `<div class="jt-md">${body}</div>`
		: `<p class="jt-entry__empty">This entry is empty. <button type="button" class="jt-link" data-action="open-note" data-note-id="${escapeHtml(entry.id)}">Write something</button></p>`}
	</article>
`;

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

/**
 * The heading names the year you are reading, not the range the panel holds -
 * panel.js retargets it as you scroll. This is only the starting value, for the
 * top of the list.
 */
const openingYear = (entries: JournalEntry[]): string => {
	return `${(entries.length ? entries[0].date : new Date()).getFullYear()}`;
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

	const hasToday = entries.some(entry => entry.title === todayTitle);

	// Offering to start today's entry against a notebook that has vanished would
	// silently recreate it, so the placeholder is held back.
	const placeholder = hasToday || state.status === 'missing' ? '' : renderPlaceholder(todayTitle);

	const selected = new Set(state.selectedNoteIds);
	const articles = entries
		.map(entry => renderEntry(entry, bodies.get(entry.id) ?? '', entry.title === todayTitle, selected.has(entry.id)))
		.join('');

	const footer = truncated
		? renderNotice(`Showing the ${maxEntries} most recent entries. Change the limit in Preferences → Journal Timeline.`)
		: '';

	return `
		<div class="jt${state.showImages ? '' : ' jt--no-images'}">
			${renderTopBar(openingYear(entries), state.folderLabel)}
			<div class="jt-scroll">
				${renderStatusNotice(state)}
				${placeholder}
				${articles}
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
