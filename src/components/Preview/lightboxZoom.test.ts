import { describe, expect, test } from "vite-plus/test";

import {
  getNextLightboxZoom,
  LIGHTBOX_IMAGE_ZOOM_MAX,
  LIGHTBOX_IMAGE_ZOOM_MIN,
  LIGHTBOX_IMAGE_ZOOM_STEP,
} from "./lightboxZoom";

describe("getNextLightboxZoom", () => {
  test("zooms images in and out by the configured step", () => {
    expect(getNextLightboxZoom(1, "in")).toBe(1 + LIGHTBOX_IMAGE_ZOOM_STEP);
    expect(getNextLightboxZoom(1, "out")).toBe(1 - LIGHTBOX_IMAGE_ZOOM_STEP);
  });

  test("resets zoom to the fit-to-dialog default", () => {
    expect(getNextLightboxZoom(2.5, "reset")).toBe(1);
  });

  test("keeps zoom within usable lightbox bounds", () => {
    expect(getNextLightboxZoom(LIGHTBOX_IMAGE_ZOOM_MAX, "in")).toBe(LIGHTBOX_IMAGE_ZOOM_MAX);
    expect(getNextLightboxZoom(LIGHTBOX_IMAGE_ZOOM_MIN, "out")).toBe(LIGHTBOX_IMAGE_ZOOM_MIN);
  });
});
