# eyemono.md

A browser-based markdown note-taking app that runs entirely in the browser. All notes are stored locally using IndexedDB.

## Features

- **Markdown editor** with CodeMirror 6
- **Path-based navigation** - each note has a unique URL path
- **Command palette** - search commands and pages with Cmd/Ctrl+K
- **Tree sidebar** - hierarchical note navigation
- **Auto-save** - changes are saved automatically
- **Multi-tab sync** - changes sync across browser tabs
- **Dark/light theme** - supports system preference

## Tech Stack

- SolidJS + TypeScript
- RxDB with IndexedDB
- CodeMirror 6
- Ark UI components
- UnoCSS

## Development

```bash
# Install dependencies
vp install

# Run dev server
vp dev

# Build for production
vp build
```

## License

MIT
