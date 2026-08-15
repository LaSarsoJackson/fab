/**
 * React content rendered inside Leaflet popups. The component handles DOM
 * event isolation and layout recalculation that Leaflet cannot infer from
 * React image/font updates.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";

import { stopMapInteractionPropagation } from "./mapDomain";
import { buildPopupViewModel, cleanRecordValue } from "./mapRecordPresentation";

export const createMapRecordKey = (record, index = 0) => (
  record?.id || `${record?.OBJECTID}_${record?.Section}_${record?.Lot}_${record?.Grave}_${index}`
);

const DESKTOP_POPUP_INITIAL_PERSON_LIMIT = 8;

export function PopupCardContent({
  record,
  onClose,
  onNavigate,
  onRemove,
  getPopup,
  schedulePopupLayout,
  showActions = false,
  showDetails = true,
}) {
  const popupView = buildPopupViewModel(record);
  const popupKey = createMapRecordKey(record, 0);
  const [mediaUrl, setMediaUrl] = useState(() => popupView.imageUrl || "");
  const locationRow = popupView.rows.find(({ label }) => label === "Location");
  const detailRows = popupView.rows.filter(({ label, value }) => (
    label !== "Location" && !(
      label === "Role" && popupView.paragraphs.includes(cleanRecordValue(value))
    )
  ));
  const shouldShowActions = showActions && (onClose || onNavigate || onRemove);

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
      {showDetails && detailRows.length > 0 && (
        <Box component="dl" className="popup-card__details">
          {detailRows.map(({ label, value }) => (
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
          {showDetails && popupView.biographyLink && (
            <a
              className="popup-card__action popup-card__action--secondary"
              href={popupView.biographyLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handlePopupInteraction}
            >
              Details
            </a>
          )}
          {onRemove && (
            <button
              type="button"
              className="popup-card__action popup-card__action--ghost"
              onClick={(event) => {
                stopMapInteractionPropagation(event);
                onRemove();
              }}
            >
              Unpin
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="popup-card__action popup-card__action--ghost"
              onClick={(event) => {
                stopMapInteractionPropagation(event);
                onClose();
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
  const [visibleLimit, setVisibleLimit] = useState(DESKTOP_POPUP_INITIAL_PERSON_LIMIT);
  const listId = `popup-people-${encodeURIComponent(
    createMapRecordKey(validRecords[0], 0)
  ).replace(/%/g, "_")}`;

  if (validRecords.length < 2) {
    return null;
  }

  const count = validRecords.length;
  const activeRecord = validRecords.find((record) => (
    cleanRecordValue(record?.id) === cleanRecordValue(activeRecordId)
  ));
  const initialRecords = validRecords.slice(0, visibleLimit);
  const visibleRecords = activeRecord && !initialRecords.some((record) => record.id === activeRecord.id)
    ? [...initialRecords, activeRecord]
    : initialRecords;
  const viewModels = visibleRecords.map((record) => buildPopupViewModel(record));
  const hasHiddenRecords = visibleRecords.length < validRecords.length;
  const canCollapse = !hasHiddenRecords && visibleLimit > DESKTOP_POPUP_INITIAL_PERSON_LIMIT;

  const handleListInteraction = (event) => {
    stopMapInteractionPropagation(event);
  };

  const handleToggleVisibleRecords = (event) => {
    stopMapInteractionPropagation(event);
    setVisibleLimit((currentLimit) => (
      currentLimit >= validRecords.length
        ? DESKTOP_POPUP_INITIAL_PERSON_LIMIT
        : Math.min(validRecords.length, currentLimit + DESKTOP_POPUP_INITIAL_PERSON_LIMIT)
    ));
  };

  return (
    <div>
      <p className="popup-card__stack-heading">{count} people at this plot</p>
      <ul
        id={listId}
        className="popup-card__stack-list"
        aria-label={stackDescription || "People at this plot"}
        onMouseDown={handleListInteraction}
        onPointerDown={handleListInteraction}
        onTouchStart={handleListInteraction}
      >
        {visibleRecords.map((record, index) => {
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
      {(hasHiddenRecords || canCollapse) && (
        <div className="popup-card__stack-controls">
          <span className="popup-card__stack-progress">
            {visibleRecords.length} of {count} shown
          </span>
          <button
            type="button"
            className="popup-card__stack-toggle"
            aria-controls={listId}
            aria-expanded={visibleLimit > DESKTOP_POPUP_INITIAL_PERSON_LIMIT}
            onClick={handleToggleVisibleRecords}
          >
            {hasHiddenRecords ? "Show more" : "Show fewer"}
          </button>
        </div>
      )}
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
  const getPopupRef = useRef(getPopup);

  useLayoutEffect(() => {
    getPopupRef.current = getPopup;
  }, [getPopup]);

  const resolvePopup = useCallback(() => getPopupRef.current?.(), []);
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
  const stackDescription = stackRecords.length === 1
    ? "1 person at this plot"
    : `${stackRecords.length} people at this plot`;

  useLayoutEffect(() => {
    schedulePopupLayout?.(resolvePopup());
  }, [activeIndex, resolvePopup, schedulePopupLayout]);

  if (!activeRecord) {
    return null;
  }

  const handleSelectRecord = (record) => {
    const nextRecordId = cleanRecordValue(record?.id);
    setCurrentRecordId(nextRecordId);
    onSelectRecord?.(record);
    schedulePopupLayout?.(resolvePopup());
  };

  return (
    <div
      className="popup-card-stack"
      role="group"
      aria-label={stackDescription}
    >
      <PopupCardStackList
        key={recordSignature}
        records={stackRecords}
        activeRecordId={currentRecordId}
        onSelectRecord={handleSelectRecord}
        stackDescription={stackDescription}
      />
      <PopupCardContent
        record={activeRecord}
        onNavigate={(event) => onNavigate?.(event, activeRecord)}
        onRemove={() => onRemove?.(activeRecord)}
        showActions={Boolean(onNavigate || onRemove)}
        getPopup={resolvePopup}
        schedulePopupLayout={schedulePopupLayout}
      />
    </div>
  );
}
