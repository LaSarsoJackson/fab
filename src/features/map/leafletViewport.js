import { getPopupViewportPadding } from "./popupViewport";

const buildPaddingPoint = (x, y) => [x, y];

const getOverlayRect = (getOverlayElement) => {
  if (typeof getOverlayElement !== "function") return undefined;
  return getOverlayElement()?.getBoundingClientRect?.();
};

export const getLeafletViewportPadding = (
  map,
  {
    basePadding = 16,
    getOverlayElement,
  } = {}
) => {
  const mapContainer = map?.getContainer?.();
  if (!mapContainer || typeof document === "undefined") {
    return {
      paddingTopLeft: buildPaddingPoint(basePadding, basePadding),
      paddingBottomRight: buildPaddingPoint(basePadding, basePadding),
    };
  }

  const containerRect = mapContainer.getBoundingClientRect();
  const overlayRect = getOverlayRect(getOverlayElement);
  const { topLeft, bottomRight } = getPopupViewportPadding({
    containerRect,
    overlayRect,
    basePadding,
  });

  return {
    paddingTopLeft: buildPaddingPoint(topLeft[0], topLeft[1]),
    paddingBottomRight: buildPaddingPoint(bottomRight[0], bottomRight[1]),
  };
};

export const fitBoundsInVisibleViewport = (
  map,
  bounds,
  {
    getOverlayElement,
    ...options
  } = {}
) => {
  if (!map || !bounds) return;

  const { paddingTopLeft, paddingBottomRight } = getLeafletViewportPadding(map, {
    basePadding: 24,
    getOverlayElement,
  });

  map.fitBounds(bounds, {
    ...options,
    paddingTopLeft,
    paddingBottomRight,
  });
};

export const panIntoVisibleViewport = (
  map,
  latLng,
  {
    getOverlayElement,
    ...options
  } = {}
) => {
  if (!map || !latLng) return;

  const { paddingTopLeft, paddingBottomRight } = getLeafletViewportPadding(map, {
    basePadding: 24,
    getOverlayElement,
  });

  map.panInside(latLng, {
    ...options,
    paddingTopLeft,
    paddingBottomRight,
  });
};

export const keepPopupInView = (
  popup,
  {
    getOverlayElement,
  } = {}
) => {
  const map = popup?._map;
  if (!map) return;

  const { paddingTopLeft, paddingBottomRight } = getLeafletViewportPadding(map, {
    basePadding: 16,
    getOverlayElement,
  });

  popup.options.autoPanPaddingTopLeft = paddingTopLeft;
  popup.options.autoPanPaddingBottomRight = paddingBottomRight;

  if (typeof popup._adjustPan === "function") {
    popup._adjustPan();
  }
};

export const syncPopupLayout = (popup, options = {}) => {
  if (!popup) return;

  if (typeof popup.update === "function") {
    popup.update();
  }

  keepPopupInView(popup, options);
};

export const schedulePopupInView = (popup, options = {}) => {
  if (!popup) return;

  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    syncPopupLayout(popup, options);
    return;
  }

  window.requestAnimationFrame(() => {
    syncPopupLayout(popup, options);
  });
};
