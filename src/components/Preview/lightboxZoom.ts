export const LIGHTBOX_IMAGE_ZOOM_MIN = 0.5;
export const LIGHTBOX_IMAGE_ZOOM_MAX = 3;
export const LIGHTBOX_IMAGE_ZOOM_STEP = 0.25;

type LightboxZoomAction = "in" | "out" | "reset";
export interface LightboxPan {
  x: number;
  y: number;
}

export const LIGHTBOX_IMAGE_PAN_CENTER: LightboxPan = { x: 0, y: 0 };

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

export const getWheelLightboxZoom = (currentZoom: number, deltaY: number) => {
  if (deltaY < 0) return getNextLightboxZoom(currentZoom, "in");
  if (deltaY > 0) return getNextLightboxZoom(currentZoom, "out");
  return currentZoom;
};

export const getNextLightboxPan = (
  currentPan: LightboxPan,
  movement: LightboxPan,
  zoom: number,
): LightboxPan => {
  if (zoom <= 1) return LIGHTBOX_IMAGE_PAN_CENTER;

  return {
    x: currentPan.x + movement.x,
    y: currentPan.y + movement.y,
  };
};

export const resetLightboxPanIfFit = (currentPan: LightboxPan, zoom: number): LightboxPan => {
  if (zoom <= 1) return LIGHTBOX_IMAGE_PAN_CENTER;
  return currentPan;
};
