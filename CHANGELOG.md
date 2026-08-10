# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

First public release.

### Added

- Panel that reads dated notes (`YYYY-MM-DD`) from one notebook as a continuous journal, each entry
  showing its date as a heading followed by the note rendered with Joplin's Markdown renderer.
- The heading at the top of the panel names the year you are scrolled to.
- Today is badged, and offered as a card to create when the entry does not exist yet.
- The entry currently open in the editor is highlighted, wherever the selection changed from.
- Clicking anywhere in an entry opens its note; links inside entries open in Joplin or the browser.
- Attachments render as thumbnails, expandable by clicking, and can be switched off entirely.
- Journal notebook chosen from a dropdown of existing notebooks, kept in step as notebooks change,
  or created on demand from a name.
- An existing notebook matching the configured name is adopted on first run rather than duplicated.
- Refreshes itself on note, sync and settings changes, when shown, and when the date rolls over.
- Commands to toggle the panel (`Ctrl/Cmd+Alt+J`), open today's entry, and force a refresh.
