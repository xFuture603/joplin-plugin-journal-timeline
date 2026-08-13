import joplin from 'api';
import { ViewHandle } from 'api/types';
import { findOrCreateFolderByPath, findOrCreateJournalNote, getFolderPaths, listJournalEntries } from './journal';
import { buildErrorHtml, buildPanelHtml, FolderStatus } from './panelHtml';
import { CREATE_NEW_FOLDER, getSettings, refreshFolderOptions, setFolderId } from './settings';
import { renderEntryBodies } from './render';
import { todayTitle } from './dates';

const PANEL_ID = 'journalTimelinePanel';

// Note changes arrive in bursts, especially during sync; coalesce them.
const REFRESH_DEBOUNCE_MS = 400;

// Which day is "today" is decided while rendering, so a panel left open
// overnight would keep badging yesterday as today and offer to create an entry
// for a day that has passed. Polling beats scheduling a timer for midnight: it
// also copes with the machine being suspended and with the clock or time zone
// being changed.
const DAY_WATCH_INTERVAL_MS = 60 * 1000;

interface PanelMessage {
	type: 'refresh' | 'openToday' | 'openNote' | 'openLink';
	noteId?: string;
	url?: string;
}

interface ResolvedFolder {
	id: string | null;
	label: string;
	status: FolderStatus;
}

const logError = (context: string) => (error: unknown) => {
	console.error(`Journal Timeline: ${context}`, error);
};

/** Works out which notebook the timeline should show, and how to label it. */
const resolveFolder = async (): Promise<ResolvedFolder> => {
	const { folderId, newFolderName } = await getSettings();

	if (folderId === CREATE_NEW_FOLDER) return { id: null, label: newFolderName, status: 'pending' };

	// Looked up through the full list rather than by id so the header can show
	// the same "Parent/Child" path as the settings dropdown.
	const folder = (await getFolderPaths()).find(candidate => candidate.id === folderId);
	if (folder) return { id: folder.id, label: folder.path, status: 'ready' };

	return { id: null, label: newFolderName, status: 'missing' };
};

export class JournalPanel {
	private handle: ViewHandle;

	// Renders are serialised: two overlapping setHtml() calls would race and the
	// slower one could overwrite fresher content.
	private rendering = false;
	private renderPending = false;

	private refreshTimer: ReturnType<typeof setTimeout> | null = null;

	// Set when something changed while the panel was hidden, so it can be
	// brought up to date the moment it becomes visible again.
	private stale = false;

	/** The day the panel was last drawn for, watched for midnight rollover. */
	private renderedDay = '';

	// Joplin always has a note open, so seeding the highlight from the editor
	// meant the panel opened with an entry already picked out - one restored from
	// the last session, that the reader had not chosen and had no reason to be
	// looking at. The highlight is earned by a selection made since startup, not
	// assumed from whatever the app happened to be showing.
	private selectionSeen = false;

	public async create(): Promise<void> {
		this.handle = await joplin.views.panels.create(PANEL_ID);

		// Scripts are loaded once and survive every setHtml(), so this must not
		// be repeated per render.
		await joplin.views.panels.addScript(this.handle, './webview/panel.css');
		await joplin.views.panels.addScript(this.handle, './webview/panel.js');

		await joplin.views.panels.onMessage(this.handle, (message: PanelMessage) => this.onMessage(message));

		// Rendered unconditionally: at startup the panel may not have been added
		// to the app layout yet, and a visibility check would wrongly report it
		// as hidden and leave it blank.
		await this.renderNow();

		setInterval(() => {
			// `stale` already means "redraw when next shown", so there is nothing
			// to do until the panel comes back.
			if (this.stale || todayTitle() === this.renderedDay) return;

			this.render().catch(logError('the midnight refresh failed'));
		}, DAY_WATCH_INTERVAL_MS);
	}

	/**
	 * Redraws whether or not anything is known to have changed, and rebuilds the
	 * notebook list with it. Backs the "Refresh Journal Timeline" command and the
	 * retry link shown when a render fails.
	 */
	public async refresh(): Promise<void> {
		await refreshFolderOptions();
		await this.renderNow();
	}

	/** True when the panel is showing content that is known to be out of date. */
	public get needsRefresh(): boolean {
		return this.stale;
	}

	public async toggle(): Promise<void> {
		if (await joplin.views.panels.visible(this.handle)) {
			await joplin.views.panels.hide(this.handle);
			return;
		}

		await this.show();
	}

	public async show(): Promise<void> {
		await joplin.views.panels.show(this.handle);
		if (this.stale) await this.renderNow();
	}

	/** Redraws the panel, unless it is hidden - then it is redrawn when shown. */
	public async render(): Promise<void> {
		if (!await joplin.views.panels.visible(this.handle)) {
			this.stale = true;
			return;
		}

		await this.renderNow();
	}

	/**
	 * Moves the highlight to whatever is open in the editor. Sent as a message
	 * rather than re-rendered: the selection changes on every click around the
	 * app, and a full refresh for each one would be wasteful and would disturb
	 * the reader's scroll position.
	 */
	public async syncSelection(): Promise<void> {
		this.selectionSeen = true;

		joplin.views.panels.postMessage(this.handle, {
			type: 'selection',
			noteIds: await joplin.workspace.selectedNoteIds(),
		});
	}

	/**
	 * Coalesces bursts of events into a single refresh. The notebook dropdown is
	 * rebuilt even when the panel is hidden, so the config screen is current
	 * whenever the user opens it.
	 */
	public scheduleRender(): void {
		if (this.refreshTimer) clearTimeout(this.refreshTimer);

		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = null;

			refreshFolderOptions()
				.catch(logError('could not refresh the notebook list'))
				.then(() => this.render())
				.catch(logError('a scheduled refresh failed'));
		}, REFRESH_DEBOUNCE_MS);
	}

	public async openToday(): Promise<void> {
		// The panel already renders from resolveFolder, and it answers exactly what
		// is needed here: an id when the notebook exists, otherwise the name to
		// create it under. Asking it again keeps the two from disagreeing about
		// which notebook the journal lives in.
		const resolved = await resolveFolder();
		let folderId = resolved.id;

		if (!folderId) {
			// Creating the notebook is what turns the "create a new notebook" choice
			// into a real selection, so the dropdown is pointed at it straight away.
			folderId = (await findOrCreateFolderByPath(resolved.label)).id;
			await setFolderId(folderId);
			await refreshFolderOptions();
		}

		const noteId = await findOrCreateJournalNote(folderId, todayTitle());
		await joplin.commands.execute('openNote', noteId);
		await this.render();
	}

	private async renderNow(): Promise<void> {
		if (this.rendering) {
			this.renderPending = true;
			return;
		}

		this.rendering = true;
		try {
			// Anything that arrived mid-render is drawn on the next pass rather than
			// dropped, so the panel always settles on the newest content.
			do {
				this.renderPending = false;
				await this.setHtml();
			} while (this.renderPending);
		} finally {
			this.rendering = false;
		}
	}

	private async setHtml(): Promise<void> {
		let label = '';

		// Recorded even when the render fails, so a persistent error cannot turn
		// the day watcher into a once-a-minute retry loop. Recovery from an error
		// is the retry link's job.
		this.renderedDay = todayTitle();

		try {
			const { maxEntries, showImages, showOnThisDay } = await getSettings();
			const folder = await resolveFolder();
			label = folder.label;

			const { entries, total, onThisDay } = folder.id
				? await listJournalEntries(folder.id, maxEntries)
				: { entries: [], total: 0, onThisDay: [] };

			// Bodies for past years are only fetched when the section is on, so
			// turning it off costs nothing per refresh. An entry appearing in both
			// lists is rendered once - renderEntryBodies keys by note id, and the
			// render cache absorbs the repeat.
			const past = showOnThisDay ? onThisDay : [];

			await joplin.views.panels.setHtml(this.handle, buildPanelHtml({
				folderLabel: folder.label,
				status: folder.status,
				entries,
				bodies: await renderEntryBodies([...entries, ...past]),
				todayTitle: todayTitle(),
				maxEntries,
				truncated: total > entries.length,
				showImages,
				onThisDay: past,
				selectedNoteIds: this.selectionSeen ? await joplin.workspace.selectedNoteIds() : [],
			}));

			this.stale = false;
		} catch (error) {
			// A failed render must still leave the panel usable, otherwise the
			// user is stuck with stale content and no way to retry.
			logError('could not render the panel')(error);
			await joplin.views.panels.setHtml(this.handle, buildErrorHtml(label, `${error?.message ?? error}`));
		}
	}

	private async onMessage(message: PanelMessage): Promise<void> {
		if (!message?.type) return;

		try {
			if (message.type === 'refresh') {
				await this.refresh();
			} else if (message.type === 'openToday') {
				await this.openToday();
			} else if (message.type === 'openNote' && message.noteId) {
				await joplin.commands.execute('openNote', message.noteId);
			} else if (message.type === 'openLink' && message.url) {
				// Resolves ":/noteId" links within Joplin, and sends everything
				// else to the system browser or file handler.
				await joplin.commands.execute('openItem', message.url);
			}
		} catch (error) {
			logError(`"${message.type}" failed`)(error);
		}
	}
}
