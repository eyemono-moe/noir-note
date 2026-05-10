import { describe, expect, test } from "vite-plus/test";

import { buildDateTimeInsertionItems } from "./insertion";

describe("buildDateTimeInsertionItems", () => {
  const fixed = new Date(Date.UTC(2026, 4, 7, 13, 9, 5));
  // Force the test to be timezone-independent by using getters that mirror
  // the implementation (which relies on local-time getters). We pin to UTC
  // by constructing a new Date from the same components.
  const local = new Date(
    fixed.getUTCFullYear(),
    fixed.getUTCMonth(),
    fixed.getUTCDate(),
    fixed.getUTCHours(),
    fixed.getUTCMinutes(),
    fixed.getUTCSeconds(),
  );

  test("returns 4 format items", () => {
    expect(buildDateTimeInsertionItems(local)).toHaveLength(4);
  });

  test("formats date / datetime / iso / time correctly", () => {
    const items = buildDateTimeInsertionItems(local);
    const map = Object.fromEntries(items.map((i) => [i.value, i.description]));
    expect(map["iso-date"]).toBe("2026-05-07");
    expect(map["iso-datetime"]).toBe("2026-05-07 13:09");
    expect(map["iso-full"]).toBe("2026-05-07T13:09:05");
    expect(map["time"]).toBe("13:09");
  });

  test("each item carries an icon and label", () => {
    for (const item of buildDateTimeInsertionItems(local)) {
      expect(item.icon).toBeTruthy();
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});
