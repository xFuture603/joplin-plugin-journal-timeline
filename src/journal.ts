import joplin from 'api';
import { parseJournalTitle, sameDayYearsAgo } from './dates';

export interface Folder {
	id: string;
	title: string;
	parent_id: string;
}

interface Note {
	id: string;
	title: string;
	updated_time?: number;
}

export interface JournalEntry {
	id: string;
	title: string;
	date: Date;
	/** Part of the render cache key, so an edited entry is re-rendered. */
	updatedTime: number;
}

export interface NoteContent {
	body: string;
	/** 1 = Markdown, 2 = HTML. */
	markupLanguage: number;
}

const PAGE_LIMIT = 100;

// Guards against a server that keeps reporting `has_more`; 500 pages is far
// beyond any realistic notebook and stops the loop from hanging Joplin.
const MAX_PAGES = 500;

/**
 * The data API returns at most `limit` items per call, so every listing has to
 * be paged through. Reading only the first page silently hides notebooks and
 * notes once a collection grows past 100 items.
 */
const getAll = async <T>(path: string[], query: Record<string, unknown> = {}): Promise<T[]> => {
	const items: T[] = [];

	for (let page = 1; page <= MAX_PAGES; page++) {
		const response = await joplin.data.get(path, { ...query, page, limit: PAGE_LIMIT });
		const pageItems: T[] = response?.items ?? [];

		items.push(...pageItems);

		if (!response?.has_more || !pageItems.length) break;
	}

	return items;
};

export interface FolderPath {
	id: string;
	/** Full "Parent/Child" path, used as the dropdown label. */
	path: string;
}

const getFolders = () => getAll<Folder>(['folders'], { fields: ['id', 'title', 'parent_id'] });

/** Returns a single notebook, or null when it no longer exists. */
export const getFolderById = async (id: string): Promise<Folder | null> => {
	if (!id) return null;

	try {
		return await joplin.data.get(['folders', id], { fields: ['id', 'title', 'parent_id'] }) as Folder;
	} catch (error) {
		return null;
	}
};

const buildFolderPath = (folder: Folder, byId: Map<string, Folder>): string => {
	const parts = [folder.title];
	const visited = new Set([folder.id]);
	let current = folder;

	// `visited` guards against a corrupt parent chain looping forever.
	while (current.parent_id && byId.has(current.parent_id) && !visited.has(current.parent_id)) {
		current = byId.get(current.parent_id);
		visited.add(current.id);
		parts.unshift(current.title);
	}

	return parts.join('/');
};

/** Every notebook with its full path, sorted by path. */
export const getFolderPaths = async (): Promise<FolderPath[]> => {
	const folders = await getFolders();
	const byId = new Map(folders.map(folder => [folder.id, folder]));

	return folders
		.map(folder => ({ id: folder.id, path: buildFolderPath(folder, byId) }))
		.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }));
};

const splitFolderPath = (folderPath: string): string[] => {
	return folderPath.split('/').map(segment => segment.trim()).filter(Boolean);
};

/**
 * Notebook titles are matched case-insensitively but otherwise exactly, so
 * "Journals" and "journals" are the same notebook while "My Journal" and
 * "My-Journal" stay distinct.
 */
const findChild = (folders: Folder[], parentId: string, title: string): Folder | undefined => {
	const wanted = title.toLowerCase();
	return folders.find(folder => (folder.parent_id || '') === parentId && folder.title.trim().toLowerCase() === wanted);
};

/** Resolves a "Parent/Child" path to a notebook, or null when it does not exist. */
export const findFolderByPath = async (folderPath: string): Promise<Folder | null> => {
	const segments = splitFolderPath(folderPath);
	if (!segments.length) return null;

	const folders = await getFolders();
	let parentId = '';
	let current: Folder | null = null;

	for (const segment of segments) {
		current = findChild(folders, parentId, segment) ?? null;
		if (!current) return null;
		parentId = current.id;
	}

	return current;
};

/**
 * Like `findFolderByPath`, but creates the missing notebooks along the path.
 * Only called when the user asks for a note to be created - rendering the panel
 * must never create notebooks as a side effect.
 */
export const findOrCreateFolderByPath = async (folderPath: string): Promise<Folder> => {
	const segments = splitFolderPath(folderPath);
	if (!segments.length) throw new Error('The journal notebook path is empty.');

	const folders = await getFolders();
	let parentId = '';
	let current: Folder | null = null;

	for (const segment of segments) {
		let folder = findChild(folders, parentId, segment);

		if (!folder) {
			const body = parentId ? { title: segment, parent_id: parentId } : { title: segment };
			folder = await joplin.data.post(['folders'], null, body) as Folder;
			folders.push(folder);
		}

		current = folder;
		parentId = folder.id;
	}

	return current as Folder;
};

export interface JournalListing {
	entries: JournalEntry[];
	/** Dated notes in the notebook before `maxEntries` was applied. */
	total: number;
	/** Today's month and day in earlier years, most recent first. */
	onThisDay: JournalEntry[];
}

/** Every note in the notebook whose title is a valid date, most recent first. */
export const listJournalEntries = async (folderId: string, maxEntries: number): Promise<JournalListing> => {
	// Bodies are deliberately not requested here: only the entries that end up
	// on screen are fetched, and only when they are not already rendered.
	const notes = await getAll<Note>(['folders', folderId, 'notes'], { fields: ['id', 'title', 'updated_time'] });

	const entries: JournalEntry[] = [];
	for (const note of notes) {
		const date = parseJournalTitle(note.title);
		if (date) entries.push({ id: note.id, title: note.title.trim(), date, updatedTime: Number(note.updated_time) || 0 });
	}

	entries.sort((a, b) => b.date.getTime() - a.date.getTime());

	return {
		total: entries.length,
		entries: maxEntries > 0 ? entries.slice(0, maxEntries) : entries,
		// Taken from the full list rather than the slice: last year's entry is
		// almost never among the most recent `maxEntries`. This costs no extra
		// request - every dated note has already been listed above.
		onThisDay: entries.filter(entry => sameDayYearsAgo(entry.date) > 0),
	};
};

/**
 * Returns the id of the note titled `title` in the given notebook, creating the
 * note when it is missing.
 */
export const findOrCreateJournalNote = async (folderId: string, title: string): Promise<string> => {
	const notes = await getAll<Note>(['folders', folderId, 'notes'], { fields: ['id', 'title'] });
	const existing = notes.find(note => note.title.trim() === title);
	if (existing) return existing.id;

	// Created empty: the panel already shows the date as the entry heading, so a
	// "# 2026-08-10" body would just repeat it.
	const created = await joplin.data.post(['notes'], null, {
		title,
		parent_id: folderId,
		body: '',
	}) as Note;

	return created.id;
};

export const getNoteContent = async (noteId: string): Promise<NoteContent> => {
	const note = await joplin.data.get(['notes', noteId], { fields: ['body', 'markup_language'] });

	return {
		body: `${note?.body ?? ''}`,
		markupLanguage: Number(note?.markup_language) || 1,
	};
};
