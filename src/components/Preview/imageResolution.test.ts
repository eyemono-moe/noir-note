import { describe, expect, test } from "vite-plus/test";

import { getResolvedImageState } from "./imageResolution";

describe("getResolvedImageState", () => {
  test("treats external image URLs as ready immediately", () => {
    expect(
      getResolvedImageState({
        url: "https://example.com/image.png",
        objectUrl: null,
        loading: false,
      }),
    ).toEqual({ status: "ready", src: "https://example.com/image.png" });
  });

  test("keeps attachment images loading until the lookup settles", () => {
    expect(
      getResolvedImageState({
        url: "attachment://missing-id",
        objectUrl: null,
        loading: true,
      }),
    ).toEqual({ status: "loading", src: null });
  });

  test("marks missing attachments after lookup settles without an object URL", () => {
    expect(
      getResolvedImageState({
        url: "attachment://missing-id",
        objectUrl: null,
        loading: false,
      }),
    ).toEqual({ status: "missing", src: null });
  });

  test("returns ready attachment object URLs", () => {
    expect(
      getResolvedImageState({
        url: "attachment://existing-id",
        objectUrl: "blob:http://localhost/existing-id",
        loading: false,
      }),
    ).toEqual({ status: "ready", src: "blob:http://localhost/existing-id" });
  });
});
