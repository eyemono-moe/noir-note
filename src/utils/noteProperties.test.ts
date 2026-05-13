import { describe, expect, test } from "vite-plus/test";

import type { MemoWithoutContent } from "../types/memo";
import { buildNoteProperties } from "./noteProperties";

describe("buildNoteProperties", () => {
  const memo: MemoWithoutContent = {
    path: "notes/today.md",
    createdAt: Date.UTC(2026, 4, 13, 10, 30),
    updatedAt: Date.UTC(2026, 4, 13, 11, 45),
  };

  test("separates system metadata from current-content frontmatter", () => {
    const props = buildNoteProperties({
      memo,
      content: "---\ntitle: Today\ntags:\n  - daily\n  - work\nstatus: draft\n---\n# Body",
      backlinks: ["index.md", "notes/yesterday.md"],
    });

    expect(props.system.path).toBe("notes/today.md");
    expect(props.system.createdAtIso).toBe("2026-05-13T10:30:00.000Z");
    expect(props.system.updatedAtIso).toBe("2026-05-13T11:45:00.000Z");
    expect(props.frontmatter.status).toBe("valid");
    expect(props.frontmatter.title).toBe("Today");
    expect(props.frontmatter.tags).toEqual(["daily", "work"]);
    expect(props.frontmatter.extraFields).toEqual([{ key: "status", value: "draft" }]);
    expect(props.backlinks.count).toBe(2);
  });

  test("reports invalid frontmatter instead of treating it as unset", () => {
    const props = buildNoteProperties({
      memo,
      content: "---\ntitle: 42\n---\n# Body",
      backlinks: [],
    });

    expect(props.frontmatter.status).toBe("invalid");
    expect(props.frontmatter.message).toContain("title");
    expect(props.frontmatter.title).toBeUndefined();
  });

  test("reports absent frontmatter as unset", () => {
    const props = buildNoteProperties({ memo, content: "# Body", backlinks: [] });

    expect(props.frontmatter.status).toBe("absent");
    expect(props.frontmatter.title).toBeUndefined();
    expect(props.frontmatter.tags).toEqual([]);
  });
});
