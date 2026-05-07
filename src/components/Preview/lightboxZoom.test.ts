import { describe, expect, test } from "vite-plus/test";

import {
  getNextLightboxPan,
  getNextLightboxZoom,
  getWheelLightboxZoom,
  LIGHTBOX_IMAGE_ZOOM_MAX,
  LIGHTBOX_IMAGE_ZOOM_MIN,
  LIGHTBOX_IMAGE_ZOOM_STEP,
  resetLightboxPanIfFit,
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
  test("keeps fit-to-dialog images centered instead of panned", () => {
    expect(getNextLightboxPan({ x: 12, y: -8 }, { x: 5, y: 5 }, 1)).toEqual({ x: 0, y: 0 });
    expect(resetLightboxPanIfFit({ x: 12, y: -8 }, 1)).toEqual({ x: 0, y: 0 });
  });

  test("adds drag movement while zoomed in", () => {
    expect(getNextLightboxPan({ x: 12, y: -8 }, { x: 5, y: 7 }, 1.25)).toEqual({ x: 17, y: -1 });
    expect(resetLightboxPanIfFit({ x: 12, y: -8 }, 1.25)).toEqual({ x: 12, y: -8 });
  });
});
