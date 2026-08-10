// Runtime values from `api/types` that the source reads at module load. Kept in
// step with api/types.ts.
export enum SettingItemType {
	Int = 1,
	String = 2,
	Bool = 3,
	Array = 4,
	Object = 5,
	Button = 6,
}

export enum MenuItemLocation {
	Tools = 'tools',
}

export enum ToolbarButtonLocation {
	NoteToolbar = 'noteToolbar',
	EditorToolbar = 'editorToolbar',
}
