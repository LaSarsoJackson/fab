import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Box } from "@mui/material";

import { stopMapInteractionPropagation } from "./mapDomain";
import { buildPopupViewModel, cleanRecordValue } from "./mapRecordPresentation";

export const createMapRecordKey = (record, index = 0) => (
  record?.id || `${record?.OBJECTID}_${record?.Section}_${record?.Lot}_${record?.Grave}_${index}`
);

export function PopupCardContent({
  record,
  onOpenDirectionsMenu,
  onRemove,
  getPopup,
  schedulePopupLayout,
}) {
  const popupView = buildPopupViewModel(record);
  const popupKey = createMapRecordKey(record, 0);
  const [mediaUrl, setMediaUrl] = useState(() => popupView.imageUrl || "");

  const handlePopupInteraction = useCallback((event) => {
    // Popup controls sit inside the Leaflet map container. Stop propagation so
    // buttons and links do not also trigger marker/map gestures behind them.
    stopMapInteractionPropagation(event);
  }, []);

  const handlePopupLayoutChange = useCallback(() => {
    schedulePopupLayout(getPopup?.());
  }, [getPopup, schedulePopupLayout]);

  const handlePopupImageError = useCallback(() => {
    setMediaUrl((currentUrl) => {
      const fallbackUrl = cleanRecordValue(popupView.imageFallbackUrl);
      if (fallbackUrl && currentUrl !== fallbackUrl) {
        return fallbackUrl;
      }

      return "";
    });
  }, [popupView.imageFallbackUrl]);

  useEffect(() => {
    setMediaUrl(popupView.imageUrl || "");
  }, [popupKey, popupView.imageUrl]);

  useLayoutEffect(() => {
    handlePopupLayoutChange();
  }, [handlePopupLayoutChange, mediaUrl]);

  useLayoutEffect(() => {
    handlePopupLayoutChange();

    if (typeof document === "undefined" || !document.fonts?.ready) {
      return undefined;
    }

    // Webfont swaps can change popup dimensions after the first paint. Re-run
    // Leaflet autopan once fonts settle so the popup stays in the visible area.
    let isCancelled = false;
    document.fonts.ready.then(() => {
      if (!isCancelled) {
        handlePopupLayoutChange();
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [popupKey, handlePopupLayoutChange]);

  return (
    <Box
      className="popup-card"
      onClick={handlePopupInteraction}
      onMouseDown={handlePopupInteraction}
      onPointerDown={handlePopupInteraction}
      onTouchStart={handlePopupInteraction}
    >
      {popupView.sourceLabel && (
        <Box component="p" className="popup-card__eyebrow">
          {popupView.sourceLabel}
        </Box>
      )}
      <Box component="h3" className="popup-card__title">
        {popupView.heading}
      </Box>
      {popupView.subtitle && (
        <Box component="p" className="popup-card__subtitle">
          {popupView.subtitle}
        </Box>
      )}
      {popupView.paragraphs?.length > 0 && (
        <Box className="popup-card__body">
          {popupView.paragraphs.map((paragraph, index) => (
            <Box
              key={`${popupKey}-paragraph-${index}`}
              component="p"
              className="popup-card__paragraph"
            >
              {paragraph}
            </Box>
          ))}
        </Box>
      )}
      {popupView.rows.length > 0 && (
        <Box component="dl" className="popup-card__details">
          {popupView.rows.map(({ label, value }) => (
            <Box key={`${popupKey}-${label}`} className="popup-card__row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </Box>
          ))}
        </Box>
      )}
      {mediaUrl && (
        <Box className="popup-card__media">
          {popupView.imageHint && (
            <Box component="p" className="popup-card__hint">
              {popupView.imageHint}
            </Box>
          )}
          {popupView.imageLinkUrl ? (
            <a
              className="popup-card__image-link"
              href={popupView.imageLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handlePopupInteraction}
            >
              <img
                className="popup-card__image"
                src={mediaUrl}
                alt={popupView.imageAlt}
                loading="lazy"
                onLoad={handlePopupLayoutChange}
                onError={handlePopupImageError}
              />
            </a>
          ) : (
            <img
              className="popup-card__image"
              src={mediaUrl}
              alt={popupView.imageAlt}
              loading="lazy"
              onLoad={handlePopupLayoutChange}
              onError={handlePopupImageError}
            />
          )}
        </Box>
      )}
      <Box className="popup-card__actions">
        <button
          type="button"
          className="popup-card__action popup-card__action--primary"
          onClick={(event) => {
            stopMapInteractionPropagation(event);
            onOpenDirectionsMenu?.(event);
          }}
        >
          Directions
        </button>
        <button
          type="button"
          className="popup-card__action popup-card__action--secondary"
          onClick={(event) => {
            stopMapInteractionPropagation(event);
            onRemove?.();
          }}
        >
          Remove
        </button>
      </Box>
    </Box>
  );
}
