---
marp: true
paginate: true
---

<!-- markdownlint-disable-file MD025 MD028 MD034 -->

# Inline Formatting

## Bold / Italic / Strikethrough

**bold** and _italic_ and _**bold italic**_.
Plain `inline code` between text.
~~strikethrough~~ via remark-gfm.

Text with a hard line break (two trailing spaces):\
second line after hard break.

## Autolinks (GFM)

Bare URL autolink: https://example.com

Email autolink: user@example.com

---

# Links & Images

## Inline Links

[Visit example.com](https://example.com "Example Domain")

Internal-style relative link: [About](/about)

## Images

Inline image syntax with alt text and title:

![Alt text for a placeholder image](https://placehold.jp/320x120.png "Placeholder")

---

# Code Blocks

## TypeScript

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

async function fetchUser(id: number): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<User>;
}
```

---

# Lists

## Unordered List

- Alpha
- Beta
  - Beta-1
  - Beta-2
    - Beta-2-a
- Gamma

---

## Ordered List

1. First item
2. Second item
   1. Nested 2-1
   2. Nested 2-2
3. Third item

---

# Tables (GFM)

| Left-aligned | Center-aligned | Right-aligned |
| :----------- | :------------: | ------------: |
| Apple        |       🍎       |         $1.00 |
| Banana       |       🍌       |         $0.50 |
| Cherry       |       🍒       |         $2.50 |

---

# Blockquotes

> Single-level blockquote.
> Continues on the next line.

> **Nested blockquotes:**
>
> > Inner quote level 2.
> >
> > > Innermost level 3.

> [!NOTE]
> This is a GitHub-style alert blockquote. It is rendered as a plain blockquote
> in this app (no special alert styling), which is expected behavior.

---

# Emoji Shortcodes

Emoji inserted via `:shortcode:` syntax (rendered by `remark-emoji`):

| Input     | Output  |
| --------- | ------- |
| `:smile:` | :smile: |
| `:+1:`    | :+1:    |
| `:tada:`  | :tada:  |
| `:fire:`  | :fire:  |

---

# Footnotes

Footnotes are parsed by `remark-gfm`[^gfm] and back-links are added by the
custom `remarkFootnoteBackLink` plugin[^fn-backlink].

Here is a sentence with multiple footnote references[^multi-1] and
another[^multi-2] to verify that each back-link navigates to the correct anchor.

[^gfm]:
    **remark-gfm** adds GitHub Flavored Markdown extensions: tables, task
    lists, strikethrough, autolinks, and footnotes.

[^fn-backlink]:
    The `remarkFootnoteBackLink` plugin walks the AST after
    `remark-gfm` and appends a `footnote-back-link` node (rendered as ↩) to the
    last paragraph of every footnote definition.

[^multi-1]: First of two closely placed footnotes.

[^multi-2]: Second of two closely placed footnotes.
