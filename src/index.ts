import joplin from 'api';
import { MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import { JournalPanel } from './panel';
import { adoptMatchingFolder, refreshFolderOptions, registerSettings, SettingKey } from './settings';

const COMMAND_TOGGLE = 'journalTimelineToggle';
const COMMAND_OPEN_TODAY = 'journalTimelineOpenToday';
const COMMAND_REFRESH = 'journalTimelineRefresh';

const registerCommands = async (panel: JournalPanel) => {
	await joplin.commands.register({
		name: COMMAND_TOGGLE,
		label: 'Toggle Journal Timeline',
		iconName: 'fas fa-book-open',
		execute: () => panel.toggle(),
	});

	await joplin.commands.register({
		name: COMMAND_OPEN_TODAY,
		label: 'Open today\'s journal entry',
		iconName: 'fas fa-pen',
		execute: () => panel.openEntry(),
	});

	// The panel keeps itself current, so this has no toolbar button - it is here
	// for the command palette and for anyone who wants to bind a shortcut.
	await joplin.commands.register({
		name: COMMAND_REFRESH,
		label: 'Refresh Journal Timeline',
		iconName: 'fas fa-sync-alt',
		execute: () => panel.refresh(),
	});

	await joplin.views.toolbarButtons.create(
		'journalTimelineToggleButton',
		COMMAND_TOGGLE,
		// The third argument is a ToolbarButtonLocation - passing anything else
		// leaves the button out of the toolbar entirely.
		ToolbarButtonLocation.NoteToolbar,
	);

	await joplin.views.menus.create('journalTimelineMenu', 'Journal Timeline', [
		{ commandName: COMMAND_TOGGLE, accelerator: 'CmdOrCtrl+Alt+J' },
		{ commandName: COMMAND_OPEN_TODAY },
		{ commandName: COMMAND_REFRESH },
	], MenuItemLocation.Tools);
};

joplin.plugins.register({
	onStart: async () => {
		await registerSettings();

		// Adopt a notebook that already matches the configured name before the
		// first render, so an existing journal notebook is picked up rather than
		// the panel offering to create a duplicate.
		await adoptMatchingFolder();
		await refreshFolderOptions();

		const panel = new JournalPanel();
		await panel.create();
		await registerCommands(panel);

		// Show the panel on the first run only. Showing it on every start would
		// override the user's choice to hide it.
		if (!await joplin.settings.value(SettingKey.PanelIntroduced)) {
			await joplin.settings.setValue(SettingKey.PanelIntroduced, true);
			await panel.show();
		}

		await joplin.settings.onChange(() => {
			// Only this plugin's settings reach this handler.
			panel.render().catch(error => console.error('Journal Timeline: refresh after a settings change failed', error));
		});

		// Keeps the timeline in step with notes added, renamed, moved or deleted
		// anywhere in the app, including by sync.
		await joplin.workspace.onNoteChange(() => panel.scheduleRender());
		await joplin.workspace.onSyncComplete(() => panel.scheduleRender());

		await joplin.workspace.onNoteSelectionChange(() => {
			// Highlight whichever entry is now open in the editor.
			panel.syncSelection().catch(error => console.error('Journal Timeline: could not update the selection', error));

			// The panel can also be revealed from Joplin's own layout controls,
			// which raise no event, so catch up the next time the user moves around.
			if (panel.needsRefresh) panel.scheduleRender();
		});
	},
});
