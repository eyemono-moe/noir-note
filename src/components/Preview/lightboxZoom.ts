export const LIGHTBOX_IMAGE_ZOOM_MIN = 0.5;
export const LIGHTBOX_IMAGE_ZOOM_MAX = 3;
export const LIGHTBOX_IMAGE_ZOOM_STEP = 0.25;

type LightboxZoomAction = "in" | "out" | "reset";

const clampZoom = (zoom: number) =>
  Math.min(LIGHTBOX_IMAGE_ZOOM_MAX, Math.max(LIGHTBOX_IMAGE_ZOOM_MIN, Number(zoom.toFixed(2))));

export const getNextLightboxZoom = (currentZoom: number, action: LightboxZoomAction) => {
  switch (action) {
    case "in": {
      return clampZoom(currentZoom + LIGHTBOX_IMAGE_ZOOM_STEP);
    }
    case "out": {
      return clampZoom(currentZoom - LIGHTBOX_IMAGE_ZOOM_STEP);
    }
    case "reset": {
      return 1;
    }
  }
};
