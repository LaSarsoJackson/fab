/**
 * React content rendered inside Leaflet popups. The component handles DOM
 * event isolation and layout recalculation that Leaflet cannot infer from
 * React image/font updates.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";

import { stopMapInteractionPropagation } from "./mapDomain";
import { buildPopupViewModel, cleanRecordValue } from "./mapRecordPresentation";

export const createMapRecordKey = (record, index = 0) => (
  record?.id || `${record?.OBJECTID}_${record?.Section}_${record?.Lot}_${record?.Grave}_${index}`
);

export function PopupCardContent({
  record,
  onNavigate,
  onRemove,
  getPopup,
  schedulePopupLayout,
  showActions = false,
  showDetails = false,
}) {
  const popupView = buildPopupViewModel(record);
  const popupKey = createMapRecordKey(record, 0);
  const [mediaUrl, setMediaUrl] = useState(() => popupView.imageUrl || "");
  const locationRow = popupView.rows.find(({ label }) => label === "Location");
  const shouldShowActions = showActions && (onNavigate || onRemove);

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
      {!popupView.subtitle && locationRow?.value && (
        <Box component="p" className="popup-card__subtitle">
          {locationRow.value}
        </Box>
      )}
      {showDetails && popupView.paragraphs?.length > 0 && (
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
      {showDetails && popupView.rows.length > 0 && (
        <Box component="dl" className="popup-card__details">
          {popupView.rows.map(({ label, value }) => (
            <Box key={`${popupKey}-${label}`} className="popup-card__row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </Box>
          ))}
        </Box>
      )}
      {showDetails && mediaUrl && (
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
      {shouldShowActions && (
        <Box className="popup-card__actions">
          {onNavigate && (
            <button
              type="button"
              className="popup-card__action popup-card__action--primary"
              onClick={(event) => {
                stopMapInteractionPropagation(event);
                onNavigate(event);
              }}
            >
              Navigate
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="popup-card__action popup-card__action--secondary"
              onClick={(event) => {
                stopMapInteractionPropagation(event);
                onRemove();
              }}
            >
              Close
            </button>
          )}
        </Box>
      )}
    </Box>
  );
}

export function PopupCardStackList({
  records = [],
  activeRecordId = "",
  onSelectRecord,
  stackDescription = "",
}) {
  const validRecords = records.filter(Boolean);

  const viewModels = useMemo(
    () => validRecords.map((record) => buildPopupViewModel(record)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [validRecords.length, validRecords.map((r) => r?.id).join("|")]
  );

  if (validRecords.length < 2) {
    return null;
  }

  const count = validRecords.length;

  const handleListInteraction = (event) => {
    stopMapInteractionPropagation(event);
  };

  return (
    <div>
      <p className="popup-card__stack-heading">{count} graves at this marker</p>
      <ul
        className="popup-card__stack-list"
        aria-label={stackDescription || "Burial records at this marker"}
        onMouseDown={handleListInteraction}
        onPointerDown={handleListInteraction}
        onTouchStart={handleListInteraction}
      >
        {validRecords.map((record, index) => {
          const vm = viewModels[index];
          const isActive = cleanRecordValue(record?.id) === cleanRecordValue(activeRecordId);
          const bornRow = vm.rows.find(({ label }) => label === "Born");
          const diedRow = vm.rows.find(({ label }) => label === "Died");
          let metaText = "";
          if (bornRow?.value && diedRow?.value) {
            // Extract year portion from formatted date values (m/d/yyyy or raw year)
            const bornYear = bornRow.value.match(/\d{4}/)?.[0] || bornRow.value;
            const diedYear = diedRow.value.match(/\d{4}/)?.[0] || diedRow.value;
            metaText = `${bornYear} – ${diedYear}`;
          } else if (bornRow?.value) {
            metaText = bornRow.value.match(/\d{4}/)?.[0] || bornRow.value;
          } else if (diedRow?.value) {
            metaText = diedRow.value.match(/\d{4}/)?.[0] || diedRow.value;
          }

          return (
            <li key={createMapRecordKey(record, index)}>
              <button
                type="button"
                className={[
                  "popup-card__stack-option",
                  isActive ? "popup-card__stack-option--active" : "",
                ].filter(Boolean).join(" ")}
                aria-current={isActive ? "true" : undefined}
                onClick={(event) => {
                  stopMapInteractionPropagation(event);
                  onSelectRecord?.(record);
                }}
              >
                <span className="popup-card__stack-option-name">{vm.heading}</span>
                {metaText && (
                  <span className="popup-card__stack-option-meta">{metaText}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PopupCardStackContent({
  activeRecordId = "",
  getPopup,
  onNavigate,
  onRemove,
  onSelectRecord,
  records = [],
  schedulePopupLayout,
}) {
  const stackRecords = useMemo(() => records.filter(Boolean), [records]);
  const recordIds = useMemo(
    () => stackRecords.map((record) => cleanRecordValue(record?.id)),
    [stackRecords]
  );
  const recordSignature = useMemo(() => recordIds.join("|"), [recordIds]);
  const normalizedActiveRecordId = cleanRecordValue(activeRecordId);
  const getFallbackRecordId = useCallback(() => recordIds.find(Boolean) || "", [recordIds]);
  const [currentRecordId, setCurrentRecordId] = useState(() => (
    recordIds.includes(normalizedActiveRecordId)
      ? normalizedActiveRecordId
      : getFallbackRecordId()
  ));

  useEffect(() => {
    if (recordIds.includes(normalizedActiveRecordId)) {
      setCurrentRecordId(normalizedActiveRecordId);
    }
  }, [normalizedActiveRecordId, recordIds, recordSignature]);

  useEffect(() => {
    setCurrentRecordId((currentId) => (
      recordIds.includes(currentId)
        ? currentId
        : getFallbackRecordId()
    ));
  }, [getFallbackRecordId, recordIds, recordSignature]);

  const activeIndex = Math.max(
    0,
    stackRecords.findIndex((record) => cleanRecordValue(record?.id) === currentRecordId)
  );
  const activeRecord = stackRecords[activeIndex];

  useLayoutEffect(() => {
    schedulePopupLayout?.(getPopup?.());
  }, [activeIndex, getPopup, schedulePopupLayout]);

  if (!activeRecord) {
    return null;
  }

  const handleSelectRecord = (record) => {
    const nextRecordId = cleanRecordValue(record?.id);
    setCurrentRecordId(nextRecordId);
    onSelectRecord?.(record);
    schedulePopupLayout?.(getPopup?.());
  };

  return (
    <>
      <PopupCardStackList
        records={stackRecords}
        activeRecordId={currentRecordId}
        onSelectRecord={handleSelectRecord}
        stackDescription={`${stackRecords.length} burial records at this marker`}
      />
      <PopupCardContent
        record={activeRecord}
        onNavigate={(event) => onNavigate?.(event, activeRecord)}
        onRemove={() => onRemove?.(activeRecord)}
        showActions={Boolean(onNavigate || onRemove)}
        getPopup={getPopup}
        schedulePopupLayout={schedulePopupLayout}
      />
    </>
  );
}
