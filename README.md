# eyemono.md

> A minimal markdown note-taking app — runs entirely in your browser, no backend required.

All notes and attachments are stored locally using the [Origin Private File System (OPFS)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), keeping your data private and offline-first.

---

## Features

- **Markdown editor** powered by CodeMirror 6
- **Path-based navigation** — each note has a unique URL (`/my-note/child`)
- **Split view** — edit and preview side by side
- **Command palette** — `Cmd/Ctrl+K` to search notes and run commands
- **Image attachments** — paste or upload images, stored in OPFS
- **Auto-save** — changes are persisted automatically
- **Real-time multi-tab sync** — edits propagate across browser tabs instantly
- **Dark / light theme** — follows system preference
- **PWA** — installable, works offline

## Tech Stack

| Layer      | Library                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| UI         | [SolidJS](https://solidjs.com) + TypeScript                                                                        |
| Editor     | [CodeMirror 6](https://codemirror.net)                                                                             |
| Storage    | [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) via Web Worker |
| Reactivity | [TanStack DB](https://tanstack.com/db)                                                                             |
| Components | [Ark UI](https://ark-ui.com)                                                                                       |
| Styling    | [UnoCSS](https://unocss.dev)                                                                                       |
| Markdown   | [unified](https://unifiedjs.com) / remark                                                                          |

## Development

```bash
vp install   # install dependencies
vp dev       # start dev server
vp run check # type check + lint + format
vp build     # production build
```

## License

MIT
