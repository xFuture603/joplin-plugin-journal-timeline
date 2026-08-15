# Changelog

# [1.4.0](https://github.com/xFuture603/joplin-plugin-journal-timeline/compare/v1.3.0...v1.4.0) (2026-08-15)


### Features

* add date picker option ([b53fd50](https://github.com/xFuture603/joplin-plugin-journal-timeline/commit/b53fd50750c23339b29e71849bedb83088d1a12b))

# [1.3.0](https://github.com/xFuture603/joplin-plugin-journal-timeline/compare/v1.2.0...v1.3.0) (2026-08-13)


### Features

* **ui:** minor styling improvements ([fbbeb9a](https://github.com/xFuture603/joplin-plugin-journal-timeline/commit/fbbeb9a161248af34e8c5489d7a79ac2a91da87c))

# [1.2.0](https://github.com/xFuture603/joplin-plugin-journal-timeline/compare/v1.1.0...v1.2.0) (2026-08-13)


### Features

* on-this day as a feature ([b7352be](https://github.com/xFuture603/joplin-plugin-journal-timeline/commit/b7352beacebb3bee5147044bbfca89c3684d7788))

# [1.1.0](https://github.com/xFuture603/joplin-plugin-journal-timeline/compare/v1.0.2...v1.1.0) (2026-08-11)


### Features

* changed to github maintainer name ([061590c](https://github.com/xFuture603/joplin-plugin-journal-timeline/commit/061590c909095fc7c3fdfc99fa23419f8c51052c))

## [1.0.2](https://github.com/xFuture603/joplin-plugin-journal-timeline/compare/v1.0.1...v1.0.2) (2026-08-10)


### Bug Fixes

* clean up README.md ([3011707](https://github.com/xFuture603/joplin-plugin-journal-timeline/commit/301170746ca93c77b7010717937cd14c575eeea5))

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
