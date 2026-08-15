import joplin from 'api';
import { SettingItemType } from 'api/types';
import { findFolderByPath, FolderPath, getFolderPaths } from './journal';

const SETTINGS_SECTION = 'journalTimeline';

const DEFAULT_FOLDER_NAME = 'Journals';

const DEFAULT_MAX_ENTRIES = 30;

/** Above this, a refresh renders enough notes to be felt. */
export const MAX_ENTRIES_LIMIT = 365;

/**
 * Dropdown value meaning "no existing notebook chosen" - the notebook named by
 * `NewFolderName` is used instead, and created on demand.
 */
export const CREATE_NEW_FOLDER = '__create__';

export enum SettingKey {
	FolderId = 'folderId',
	NewFolderName = 'newFolderName',
	MaxEntries = 'maxEntries',
	ShowImages = 'showImages',
	ShowOnThisDay = 'showOnThisDay',
	// Private: lets us show the panel on the very first run without overriding
	// the user's choice to hide it on every subsequent start.
	PanelIntroduced = 'panelIntroduced',
}

export interface JournalSettings {
	/** Chosen notebook, or CREATE_NEW_FOLDER when none has been picked. */
	folderId: string;
	newFolderName: string;
	maxEntries: number;
	showImages: boolean;
	showOnThisDay: boolean;
}

export const buildFolderOptions = (folders: FolderPath[], selectedId: string): Record<string, string> => {
	// Insertion order is the order shown in the dropdown, so the create entry
	// goes first - it is the one that matters when no journal notebook exists.
	const options: Record<string, string> = {
		[CREATE_NEW_FOLDER]: '+ Create a new notebook…',
	};

	for (const folder of folders) options[folder.id] = folder.path;

	// A <select> whose value matches no option renders blank, which looks like
	// the setting was lost. Keep a placeholder for a notebook that has gone.
	if (selectedId && !options[selectedId]) {
		options[selectedId] = '(the selected notebook no longer exists)';
	}

	return options;
};

const folderSetting = (folderOptions: Record<string, string>) => ({
	value: CREATE_NEW_FOLDER,
	type: SettingItemType.String,
	section: SETTINGS_SECTION,
	public: true,
	isEnum: true,
	options: folderOptions,
	label: 'Journal notebook',
	description: 'The notebook holding your dated journal notes. Pick one you already use, or choose "Create a new notebook" and give it a name below.',
});

export const registerSettings = async () => {
	await joplin.settings.registerSection(SETTINGS_SECTION, {
		label: 'Journal Timeline',
		iconName: 'fas fa-book-open',
		description: 'Timeline panel for notes titled with a date (YYYY-MM-DD).',
	});

	await joplin.settings.registerSettings({
		[SettingKey.FolderId]: folderSetting(buildFolderOptions(await getFolderPaths(), '')),

		[SettingKey.NewFolderName]: {
			value: DEFAULT_FOLDER_NAME,
			type: SettingItemType.String,
			section: SETTINGS_SECTION,
			public: true,
			label: 'Name for the new notebook',
			description: `Used only when "Create a new notebook" is selected above. The notebook is created the first time you add an entry. Use "/" to nest it, for example "${DEFAULT_FOLDER_NAME}/Personal".`,
		},

		// Deliberately a String rather than an Int. Joplin renders Int settings
		// as a controlled <input type="number"> whose value is pushed back from
		// state on every keystroke, so clearing the field writes 0 and the "0"
		// reappears immediately - you cannot simply type a new number over it.
		// A plain text field behaves, and the value is validated below anyway.
		[SettingKey.MaxEntries]: {
			value: '30',
			type: SettingItemType.String,
			section: SETTINGS_SECTION,
			public: true,
			label: 'Entries shown',
			description: `How many of the most recent entries the panel renders, up to ${MAX_ENTRIES_LIMIT}. Each one is rendered in full, so large values make refreshing slower. Set to 0 to render every entry.`,
		},

		[SettingKey.ShowImages]: {
			value: true,
			type: SettingItemType.Bool,
			section: SETTINGS_SECTION,
			public: true,
			label: 'Show images in entries',
			description: 'Turn this off to hide attached images in the panel. The notes themselves are not changed - images still appear in the editor and the note viewer.',
		},

		[SettingKey.ShowOnThisDay]: {
			value: true,
			type: SettingItemType.Bool,
			section: SETTINGS_SECTION,
			public: true,
			label: 'Show "On this day"',
			description: 'Puts the entries from today\'s date in earlier years above the timeline. The section only appears on days you have written about before.',
		},

		[SettingKey.PanelIntroduced]: {
			value: false,
			type: SettingItemType.Bool,
			public: false,
			label: 'Panel has been shown once',
		},
	});
};

export const getSettings = async (): Promise<JournalSettings> => {
	const values = await joplin.settings.values([
		SettingKey.FolderId,
		SettingKey.NewFolderName,
		SettingKey.MaxEntries,
		SettingKey.ShowImages,
		SettingKey.ShowOnThisDay,
	]);

	const newFolderName = `${values[SettingKey.NewFolderName] ?? ''}`.trim();

	return {
		folderId: `${values[SettingKey.FolderId] ?? ''}`.trim() || CREATE_NEW_FOLDER,
		newFolderName: newFolderName || DEFAULT_FOLDER_NAME,
		maxEntries: parseMaxEntries(values[SettingKey.MaxEntries]),
		showImages: values[SettingKey.ShowImages] !== false,
		showOnThisDay: values[SettingKey.ShowOnThisDay] !== false,
	};
};

/**
 * The setting is free text, so anything can arrive: 0 means "no limit", a
 * sensible number is capped, and nonsense falls back to the default rather than
 * silently rendering the whole journal.
 */
export const parseMaxEntries = (raw: unknown): number => {
	const text = `${raw ?? ''}`.trim();
	if (text === '0') return 0;

	const value = Number(text);
	if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_ENTRIES;

	return Math.min(Math.floor(value), MAX_ENTRIES_LIMIT);
};

export const setFolderId = (folderId: string) => joplin.settings.setValue(SettingKey.FolderId, folderId);

// Joplin's own editor font size. This is an internal setting key rather than a
// documented plugin-API constant, so every read of it is defensive.
const EDITOR_FONT_SIZE_KEY = 'style.editor.fontSize';

/**
 * The size notes are read at, in px, or 0 to leave the panel inheriting
 * `--joplin-font-size`.
 *
 * The panel renders note bodies, so it belongs at the editor's size rather than
 * the UI's: `--joplin-font-size` measures menus, the sidebar and the note list,
 * and is usually the smaller of the two. Read separately from `getSettings` so
 * only the render pays for it.
 */
export const getEditorFontSize = async (): Promise<number> => {
	try {
		const [value] = await joplin.settings.globalValues([EDITOR_FONT_SIZE_KEY]);
		const size = Number(value);

		return Number.isFinite(size) && size > 0 ? size : 0;
	} catch (error) {
		// An unknown key throws rather than returning nothing, and a Joplin that
		// renames it must leave the panel readable, not unstyled.
		return 0;
	}
};

let lastOptionsSignature = '';

/**
 * Rebuilds the notebook dropdown. Joplin calls `options()` when the config
 * screen renders and re-registering a setting replaces its metadata, so this is
 * what keeps the list in step with notebooks added or removed since startup.
 * The signature check avoids pointless re-registration on every event.
 */
export const refreshFolderOptions = async (): Promise<void> => {
	const folders = await getFolderPaths();
	const { folderId } = await getSettings();
	const options = buildFolderOptions(folders, folderId === CREATE_NEW_FOLDER ? '' : folderId);

	const signature = JSON.stringify(options);
	if (signature === lastOptionsSignature) return;
	lastOptionsSignature = signature;

	await joplin.settings.registerSettings({ [SettingKey.FolderId]: folderSetting(options) });
};

/**
 * If no notebook has been chosen but one already matches the configured name,
 * adopt it. This is what makes an existing, hand-made "Journals" notebook work
 * on first run instead of the plugin offering to create a second one.
 */
export const adoptMatchingFolder = async (): Promise<void> => {
	const { folderId, newFolderName } = await getSettings();
	if (folderId !== CREATE_NEW_FOLDER) return;

	const folder = await findFolderByPath(newFolderName);
	if (folder) await setFolderId(folder.id);
};
