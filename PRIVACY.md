# Privacy Policy

_Last updated: 2026-05-04_

## Summary

**eyemono.md** is a browser-based, offline-first markdown note-taking app.
All your data stays on your device — nothing is ever sent to any external server.

## Data Storage

- **Notes and attachments** are stored locally using the [Origin Private File System (OPFS)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), a sandboxed storage area provided by your browser. Only this app can access it.
- **Application preferences** (theme, layout, sidebar state, etc.) are saved in your browser's `localStorage`. This data never leaves your device.

## Data Sharing

This app does not collect, transmit, or share any data. There are no:

- External servers or backends
- Analytics or telemetry
- Advertising networks
- Third-party services of any kind

## Network Requests

The app may load resources (fonts, icons) from a CDN on first use if they are not already cached. After the initial load, the app works fully offline. No note content or personal data is included in these requests.

### Embedded Content (Optional)

When the **Embed links** setting is enabled (on by default), bare URLs to supported services are rendered as embedded players instead of plain links. Each service loads content from its own domain:

| Service      | Domain                                           | Privacy Policy                                  |
| ------------ | ------------------------------------------------ | ----------------------------------------------- |
| YouTube      | `www.youtube-nocookie.com`                       | <https://policies.google.com/privacy>           |
| Twitter / X  | `platform.x.com` (widget script) + `twitter.com` | <https://x.com/privacy>                         |
| Spotify      | `open.spotify.com`                               | <https://www.spotify.com/legal/privacy-policy/> |
| SoundCloud   | `w.soundcloud.com`                               | <https://soundcloud.com/pages/privacy>          |
| ニコニコ動画 | `embed.nicovideo.jp`                             | <https://dwango.co.jp/terms/privacy/>           |

These services may set cookies and collect data according to their own policies. If you prefer not to load embedded content, you can disable this feature in the settings.

You can disable all embeds — or individual services — in **Settings → Preview → Embed links**.
If you never paste bare service URLs into your notes, no embed requests are made.

## Deleting Your Data

Because all data is stored locally on your device, you are in full control. To delete all notes, attachments, and preferences:

1. Open your browser's **Site Settings** for this origin (usually accessible via the lock icon in the address bar).
2. Find **Storage** or **Site data** and click **Delete** / **Clear data**.

This removes all OPFS files (notes and attachments) and localStorage entries associated with this app. The action is irreversible, so consider exporting your notes beforehand.

## Contact

If you have any questions about this policy, you can reach us at [eyemono.moe@gmail.com](mailto:eyemono.moe@gmail.com).

## Changes to This Policy

This policy may be updated from time to time. The complete change history is available on GitHub.
