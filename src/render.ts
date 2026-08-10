import joplin from 'api';
import { getNoteContent, JournalEntry } from './journal';

/** Matches Joplin's MarkupLanguage enum. */
const MARKUP_MARKDOWN = 1;

const CACHE_LIMIT = 300;

// Keyed by note id + updated_time. The panel re-renders on every note change,
// so without this each refresh would re-render every visible entry; with it,
// only the entry that actually changed is fetched and rendered again.
const cache = new Map<string, string>();

const remember = (key: string, html: string): string => {
	if (cache.size >= CACHE_LIMIT) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}

	cache.set(key, html);
	return html;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Drops a leading "# 2026-08-10" heading. The panel shows the date as the entry
 * heading already, and entries written by older versions of this plugin - or by
 * hand - commonly repeat it as the first line.
 */
export const stripRepeatedTitle = (body: string, title: string): string => {
	return body.replace(new RegExp(`^\\s*#{1,6}\\s+${escapeRegExp(title)}\\s*(?:\\n|$)`), '');
};

/**
 * Renders one entry's note body to HTML via Joplin's own Markdown renderer.
 *
 * `bodyOnly` keeps the renderer's `#rendered-md` wrapper out of the output:
 * several entries share one document, and duplicate ids would mean the app's
 * note styles applied to the first entry only. The panel styles `.jt-md`
 * instead.
 */
const renderEntryBody = async (entry: JournalEntry): Promise<string> => {
	const key = `${entry.id}:${entry.updatedTime}`;

	const cached = cache.get(key);
	if (cached !== undefined) return cached;

	const { body, markupLanguage } = await getNoteContent(entry.id);
	const markup = stripRepeatedTitle(body, entry.title).trim();
	if (!markup) return remember(key, '');

	const result = await joplin.commands.execute(
		'renderMarkup',
		markupLanguage || MARKUP_MARKDOWN,
		markup,
		null,
		{ bodyOnly: true },
	);

	return remember(key, `${result?.html ?? ''}`);
};

/** Renders every entry, tolerating failures so one bad note cannot blank the panel. */
export const renderEntryBodies = async (entries: JournalEntry[]): Promise<Map<string, string>> => {
	const rendered = new Map<string, string>();

	for (const entry of entries) {
		try {
			rendered.set(entry.id, await renderEntryBody(entry));
		} catch (error) {
			console.error(`Journal Timeline: could not render "${entry.title}"`, error);
			rendered.set(entry.id, '');
		}
	}

	return rendered;
};
