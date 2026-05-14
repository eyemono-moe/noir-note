import { describe, expect, test } from "vite-plus/test";

import { collectFrontmatterTags, updateEditableFrontmatter } from "./frontmatterEdit";

describe("updateEditableFrontmatter", () => {
  test("updates editable frontmatter while preserving extra keys", () => {
    const content = "---\ntitle: Old\ntags:\n  - draft\nstatus: review\n---\n# Body";

    const result = updateEditableFrontmatter(content, {
      title: "New title",
      tags: ["daily", "work"],
    });

    expect(result).toBe(
      "---\ntitle: New title\ntags:\n  - daily\n  - work\nstatus: review\n---\n# Body",
    );
  });

  test("creates frontmatter when none exists", () => {
    const result = updateEditableFrontmatter("# Body", {
      title: "Today",
      tags: ["daily"],
    });

    expect(result).toBe("---\ntitle: Today\ntags:\n  - daily\n---\n# Body");
  });

  test("omits empty title and empty tags", () => {
    const result = updateEditableFrontmatter("---\ntitle: Old\ntags:\n  - draft\n---\n# Body", {
      title: "  ",
      tags: [],
    });

    expect(result).toBe("# Body");
  });
});

describe("collectFrontmatterTags", () => {
  test("returns sorted unique tags from existing memo metadata", () => {
    expect(
      collectFrontmatterTags([
        { path: "a.md", createdAt: 0, updatedAt: 0, metadata: { tags: ["work", "daily"] } },
        { path: "b.md", createdAt: 0, updatedAt: 0, metadata: { tags: ["daily", "zettel"] } },
        { path: "c.md", createdAt: 0, updatedAt: 0 },
      ]),
    ).toEqual(["daily", "work", "zettel"]);
  });
});
