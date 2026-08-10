# Journal Timeline

A [Joplin](https://joplinapp.org) plugin that shows the dated notes of a journal notebook as a
timeline panel, and opens — or creates — today's entry in one click.

Any note whose **title is a calendar date** (`YYYY-MM-DD`, e.g. `2026-08-10`) is treated as a
journal entry. Notes with other titles are ignored, so the notebook can hold indexes, templates
and other material alongside the journal itself.

## Features

- Reads as a continuous journal: each entry shows its date as a heading — "Friday, 7 August" —
  followed by the note itself, rendered with Joplin's own Markdown renderer. The heading at the top
  names the year you are currently scrolled to.
- Today sits in a raised card at the top. If today's entry does not exist yet, the card offers to
  start it.
- Clicking anywhere in an entry opens that note in the editor, and the entry you are reading is
  highlighted in the timeline — wherever the selection changes from. Selecting text and following
  links still work as you would expect.
- Attachments appear as thumbnails so a photo cannot swallow an entry; click one to expand it, or
  switch them off entirely in the settings.
- Stays in step with notes created, edited, renamed, moved, deleted or synced elsewhere in the app,
  keeping your scroll position.
- Pick the journal notebook from a dropdown of the notebooks you already have, or have the plugin
  create a new one.

## Installation

Search for **Journal Timeline** in *Joplin → Preferences → Plugins*.

To install a locally built copy instead, use *Preferences → Plugins → the gear icon → Install from
file* and pick `publish/journal-timeline.jpl`.

## Usage

The panel appears in the sidebar area the first time the plugin runs. Afterwards it remembers
whether you left it open or closed.

| Action | Where |
| --- | --- |
| Show/hide the panel | Toolbar button, *Tools → Journal Timeline → Toggle Journal Timeline*, or `Ctrl/Cmd+Alt+J` |
| Open today's entry | The calendar button, or *Tools → Journal Timeline* |
| Open one entry in the editor | Click anywhere in it |
| Follow a link in an entry | Click the link — notes open in Joplin, everything else in your browser |
| Expand or shrink an image | Click the image |

The panel is narrow by default. Drag its edge, or use *View → Change application layout*, to give
the reader a comfortable measure.

There is no refresh button, because the reader keeps itself current: it redraws when a note is
created, edited, retitled, moved or deleted, when a sync finishes, when its settings change, when it
is shown after being hidden, and when the date rolls over at midnight. A **Refresh Journal Timeline**
command exists in *Tools → Journal Timeline* and the command palette for the rare case where you
want to force it, and a failed render offers its own *Try again*.

## Choosing the journal notebook

*Preferences → Journal Timeline*

| Setting | Default | Description |
| --- | --- | --- |
| Journal notebook | *(create a new one)* | Dropdown listing every notebook you have, by full path. Pick the one you already keep your journal in. |
| Name for the new notebook | `Journals` | Used only while the dropdown is set to **+ Create a new notebook…**. Supports `/` to nest, e.g. `Journals/Personal`. |
| Entries shown | `30` | How many of the most recent entries to render, up to 365. Each is rendered in full, so large values slow refreshes down. `0` renders every entry. |
| Show images in entries | on | Turn off to hide attachments in the panel. The notes are not changed — images still appear in the editor and note viewer. |

If you already have a notebook called `Journals`, the plugin adopts it on first run rather than
offering to create a second one — so an existing hand-made journal works with no setup.

Otherwise the notebook named in **Name for the new notebook** — along with any missing notebooks
along its path — is created the first time you add an entry, never merely by opening the panel.
Once created, the dropdown switches to it automatically.

The dropdown stores the notebook's id, not its name, so renaming or moving the notebook does not
break the link. If you delete it, the panel says so and stops offering to create entries until you
pick another.

## Development

The plugin is built with the [Joplin plugin generator](https://github.com/joplin/generator-joplin)
scaffold: TypeScript sources in `src/`, bundled by webpack into a `.jpl` archive.

```sh
npm install       # also runs the build via the "prepare" script
npm run dist      # rebuild -> publish/<plugin id>.jpl
npm test          # jest
```

The tests cover the pure parts — date handling, panel markup and escaping, settings parsing. The
Joplin API is stubbed by `test/mocks/`, so anything reaching for it throws: that layer is verified
by running the plugin, not by mocking the whole app.

To try a change in Joplin, point *Preferences → Plugins → Advanced settings → Development plugins*
at this directory; Joplin then loads `dist/` directly and reloads it on restart.

| Path | Role |
| --- | --- |
| `src/index.ts` | Entry point: registers settings, commands, menus, toolbar button and workspace listeners |
| `src/panel.ts` | Panel lifecycle — rendering, message handling, refresh scheduling |
| `src/panelHtml.ts` | Panel markup, with HTML escaping of all note and notebook titles |
| `src/render.ts` | Note bodies to HTML via Joplin's `renderMarkup` command, cached per revision |
| `src/settings.ts` | Setting definitions, and the notebook dropdown that is rebuilt as notebooks change |
| `src/journal.ts` | Data-API access: notebook lookup/creation, paginated note listing |
| `src/dates.ts` | Journal-title parsing and formatting, in local time |
| `src/webview/` | Panel-side script and stylesheet, copied verbatim into the bundle |
| `api/` | Joplin plugin API type definitions, refreshed by `npm run update` |

Two details of the Joplin webview are worth knowing before changing the panel:

- `setHtml()` replaces the panel's content but does **not** re-run its scripts, and re-adding an
  already-loaded script is a no-op. Event listeners must therefore be bound to `document`, which
  survives a re-render — `src/webview/panel.js` does this with a single delegated handler.
- Panel colours come from the theme variables Joplin injects into the webview
  (`--joplin-background-color`, `--joplin-color`, `--joplin-divider-color`, …). Names are derived
  from Joplin's theme keys; invented names silently fall back to nothing.

Rendering note bodies relies on three more:

- `joplin.commands.execute('renderMarkup', markupLanguage, markup, null, { bodyOnly: true })` returns
  `{ html, pluginAssets, cssStrings }` from Joplin's own renderer. `bodyOnly` suppresses the
  `#rendered-md` wrapper — several entries share one document, and duplicate ids would apply the
  app's note styles to the first entry only. The panel styles `.jt-md` itself instead, so
  `cssStrings` and `pluginAssets` are not injected; plugin-provided markdown (KaTeX, Mermaid) will
  render unstyled.
- Renders are cached by note id + `updated_time`, so a refresh only re-renders the note that
  changed.
- Plugin webviews get **Font Awesome 5.15.4**. FA6-only names such as `fa-arrows-rotate` render as
  nothing; use `fa-sync-alt` and friends.

The selection highlight goes the other way, from plugin to webview:
`joplin.views.panels.postMessage()` paired with `webviewApi.onMessage()` in `src/webview/panel.js`.
Note selection changes on every click around the app, so re-rendering for each one would be
wasteful and would disturb the reader's scroll position; the message just moves a CSS class.

Two about settings. An enum setting's `options` are read when the config screen renders, and
re-registering a setting replaces its metadata while keeping the stored value. `refreshFolderOptions()`
in `src/settings.ts` relies on both to keep the notebook dropdown current — registering the options
once at startup would freeze the list as it was when Joplin launched.

And avoid `SettingItemType.Int` for anything a user types. The config screen renders it as a
controlled `<input type="number">` fed from state, so clearing the field yields `Number('') === 0`
and React immediately writes "0" back — the value can only be nudged with the arrow keys. "Entries
shown" is a `String` validated by `parseMaxEntries()` for that reason.

To update the scaffold (`api/`, `webpack.config.js`, …) to a newer Joplin release:

```sh
npm run update
```

## License

MIT
