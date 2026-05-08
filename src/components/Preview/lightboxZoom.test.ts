import { describe, expect, test } from "vite-plus/test";

import {
  getNextLightboxPan,
  getNextLightboxZoom,
  getWheelLightboxZoom,
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

describe("getWheelLightboxZoom", () => {
  test("zooms in on upward wheel movement and out on downward wheel movement", () => {
    expect(getWheelLightboxZoom(1, -100)).toBe(1 + LIGHTBOX_IMAGE_ZOOM_STEP);
    expect(getWheelLightboxZoom(1, 100)).toBe(1 - LIGHTBOX_IMAGE_ZOOM_STEP);
  });

  test("ignores wheel events without vertical movement", () => {
    expect(getWheelLightboxZoom(1.5, 0)).toBe(1.5);
  });
});

describe("lightbox pan", () => {
  test("adds drag movement regardless of zoom level", () => {
    expect(getNextLightboxPan({ x: 12, y: -8 }, { x: 5, y: 5 })).toEqual({ x: 17, y: -3 });
    expect(getNextLightboxPan({ x: 12, y: -8 }, { x: 5, y: 7 })).toEqual({ x: 17, y: -1 });
  });
});
