# Changelog

## [1.0.1](https://github.com/xFuture603/joplin-plugin-journal-timeline/compare/v1.0.0...v1.0.1) (2026-08-10)


### Bug Fixes

* render the README screenshot on npmjs.com ([aa9f1de](https://github.com/xFuture603/joplin-plugin-journal-timeline/commit/aa9f1de55d05a4348a4a42549a63ab7bc96cf53c))
* render the README screenshot on npmjs.com ([6deccd4](https://github.com/xFuture603/joplin-plugin-journal-timeline/commit/6deccd4a7f970d42d0b0935d1cc9413355b363f5))
* use the canonical GitHub owner casing in project URLs ([1e2f1df](https://github.com/xFuture603/joplin-plugin-journal-timeline/commit/1e2f1df10e57a0c29a8ed4f38eea38c3e44f9769))

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
