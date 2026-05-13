import { describe, expect, test } from "vite-plus/test";

import { buildDateInsertions } from "./dateInsertions";

describe("buildDateInsertions", () => {
  test("returns @today / @yesterday / @tomorrow / @now / @time entries", () => {
    const now = new Date(2026, 4, 11, 9, 5); // 2026-05-11 09:05 local

    const entries = buildDateInsertions(now);

    const triggers = entries.map((e) => e.trigger);
    expect(triggers).toEqual(["@today", "@yesterday", "@tomorrow", "@now", "@time"]);
  });

  test("@today formats local date as YYYY-MM-DD", () => {
    const now = new Date(2026, 4, 11, 9, 5);

    const entries = buildDateInsertions(now);
    const today = entries.find((e) => e.trigger === "@today");

    expect(today?.value).toBe("2026-05-11");
  });

  test("@yesterday and @tomorrow shift the date by ±1 day", () => {
    const now = new Date(2026, 0, 1, 12, 0); // 2026-01-01

    const entries = buildDateInsertions(now);

    expect(entries.find((e) => e.trigger === "@yesterday")?.value).toBe("2025-12-31");
    expect(entries.find((e) => e.trigger === "@tomorrow")?.value).toBe("2026-01-02");
  });

  test("@now formats YYYY-MM-DD HH:MM with zero-padding", () => {
    const now = new Date(2026, 4, 11, 9, 5);

    const entries = buildDateInsertions(now);
    const nowEntry = entries.find((e) => e.trigger === "@now");

    expect(nowEntry?.value).toBe("2026-05-11 09:05");
  });

  test("@time formats HH:MM with zero-padding", () => {
    const now = new Date(2026, 4, 11, 0, 7);

    const entries = buildDateInsertions(now);
    const timeEntry = entries.find((e) => e.trigger === "@time");

    expect(timeEntry?.value).toBe("00:07");
  });

  test("every entry has a non-empty description", () => {
    const entries = buildDateInsertions(new Date(2026, 4, 11));

    for (const entry of entries) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});
