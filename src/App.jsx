import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { APP_VIEWS, buildAppUrl, readAppRoute } from "./app/routes";
import AppNavigation from "./components/AppNavigation";
import RecordCard from "./components/RecordCard";
import LocatorView from "./features/locator/LocatorView";
import useBurialSearch from "./features/locator/useBurialSearch";
import { findTourDefinition, loadTour } from "./features/tours/loadTour";
import { readTourProgress, writeTourProgress } from "./features/tours/tourProgress";
import TourStopsPanel from "./features/tours/TourStopsPanel";
import ToursView from "./features/tours/ToursView";

const MapView = lazy(() => import("./features/map/MapView"));

const getCurrentRoute = () => readAppRoute(window.location.search);

const getContinueRecord = (selectedRecord, continueTour) => {
  if (selectedRecord?.source !== "tour") return null;
  return selectedRecord.tourKey === continueTour?.key ? selectedRecord : null;
};

const getContinueTourDetails = (continueTour, continueRecord, tourProgress) => {
  if (!continueTour) return null;
  let recordName = continueRecord?.displayName || "";
  if (!recordName && tourProgress.tourKey === continueTour.key) {
    recordName = tourProgress.recordName;
  }
  return { ...continueTour, recordName };
};

const getSelectedTourIndex = (selectedRecord, records) => {
  if (selectedRecord?.source !== "tour") return -1;
  return records.findIndex(({ id }) => String(id) === String(selectedRecord.id));
};

const getTourContext = ({ activeTour, records, selectedTourIndex, selectRecord, showTourOverview }) => {
  if (selectedTourIndex < 0 || activeTour?.kind !== "tour") return null;
  return {
    position: selectedTourIndex + 1,
    total: records.length,
    onOverview: showTourOverview,
    onPrevious: selectedTourIndex > 0
      ? () => selectRecord(records[selectedTourIndex - 1])
      : null,
    onNext: selectedTourIndex < records.length - 1
      ? () => selectRecord(records[selectedTourIndex + 1])
      : null,
  };
};

const ToursDestination = ({
  active,
  continueTour,
  loadingTour,
  onContinueTour,
  onSelectTour,
}) => {
  if (!active) return null;
  return (
    <ToursView
      continueTour={continueTour}
      loadingTour={loadingTour}
      onContinueTour={onContinueTour}
      onSelectTour={onSelectTour}
    />
  );
};

const LocatorDestination = ({ active, burialSearch, route, onRouteChange, onSelect }) => {
  if (!active) return null;
  return (
    <LocatorView
      initialQuery={route.query}
      initialSection={route.section}
      search={burialSearch}
      onRouteChange={onRouteChange}
      onSelect={onSelect}
    />
  );
};

const MapDestination = ({
  activeTour,
  browseSection,
  detailsOpen,
  hasVisitedMap,
  loadError,
  loadingTour,
  MapComponent,
  records,
  returnToTours,
  route,
  selectedRecord,
  selectRecord,
  selectSection,
  setDetailsOpen,
  shareUrl,
  tourContext,
  unpin,
}) => {
  if (!hasVisitedMap && route.view !== APP_VIEWS.MAP) return null;
  const active = route.view === APP_VIEWS.MAP;
  const hasBottomOverlay = Boolean(
    (activeTour && !loadingTour) || (selectedRecord && detailsOpen)
  );
  const mapClassName = [
    "map-page",
    activeTour && detailsOpen ? "map-page--record-open" : "",
    hasBottomOverlay ? "map-page--bottom-overlay" : "",
  ].filter(Boolean).join(" ");
  const handleRecordSelect = (record) => {
    if (!record) return;
    if (String(record.id) === String(selectedRecord?.id)) {
      setDetailsOpen(true);
      return;
    }
    selectRecord(record);
  };

  return (
    <section className={mapClassName} aria-label="Cemetery Map" hidden={!active}>
      <Suspense fallback={<p className="map-loading" role="status">Loading cemetery map…</p>}>
        <MapComponent
          active={active}
          records={records}
          selectedRecord={selectedRecord}
          selectedSection={route.section}
          focusKey={selectedRecord?.id || route.section || route.tour || "cemetery"}
          tourStopsPresent={Boolean(activeTour)}
          onRecordSelect={handleRecordSelect}
          onSectionSelect={selectSection}
          onBrowseSection={browseSection}
        />
      </Suspense>
      {loadingTour ? <p className="map-status" role="status">Loading tour…</p> : null}
      {loadError ? <p className="map-status map-status--error">{loadError}</p> : null}
      {activeTour && !loadingTour ? (
        <TourStopsPanel
          tour={activeTour}
          records={records}
          selectedRecord={selectedRecord}
          detailsOpen={detailsOpen}
          onExit={returnToTours}
          onSelect={selectRecord}
        />
      ) : null}
      <RecordCard
        key={selectedRecord?.id || "none"}
        record={selectedRecord}
        open={detailsOpen}
        shareUrl={shareUrl}
        onClose={() => setDetailsOpen(false)}
        onUnpin={unpin}
        tourContext={tourContext}
      />
    </section>
  );
};

export default function App({ MapComponent = MapView, useBurialSearchHook = useBurialSearch } = {}) {
  const [route, setRoute] = useState(getCurrentRoute);
  const [hasVisitedMap, setHasVisitedMap] = useState(() => route.view === APP_VIEWS.MAP);
  const [records, setRecords] = useState(() => route.legacySelection ? [route.legacySelection] : []);
  const [selectedRecord, setSelectedRecord] = useState(route.legacySelection);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(route.legacySelection));
  const [tourLoadState, setTourLoadState] = useState({ key: "", error: "" });
  const [tourProgress, setTourProgress] = useState(readTourProgress);
  const burialSearch = useBurialSearchHook();
  const runBurialSearch = burialSearch.runSearch;
  const loadingTour = route.tour && tourLoadState.key !== route.tour ? route.tour : "";
  const loadError = tourLoadState.key === route.tour ? tourLoadState.error : "";
  const activeTour = findTourDefinition(route.tour);
  const savedTour = findTourDefinition(tourProgress.tourKey);
  const continueTour = activeTour || savedTour;
  const continueRecord = getContinueRecord(selectedRecord, continueTour);
  const selectedTourIndex = getSelectedTourIndex(selectedRecord, records);

  const commitRoute = useCallback((nextRoute) => {
    setRoute(nextRoute);
    if (nextRoute.view === APP_VIEWS.MAP) setHasVisitedMap(true);
    if (!nextRoute.record && !nextRoute.legacySelection) {
      setSelectedRecord(null);
      setDetailsOpen(false);
    }
    if (nextRoute.tour || nextRoute.record || nextRoute.section || nextRoute.legacySelection) return;
    setRecords([]);
  }, []);

  const updateRoute = useCallback((changes, { replace = false } = {}) => {
    const nextUrl = buildAppUrl(window.location.href, changes);
    window.history[replace ? "replaceState" : "pushState"]({}, "", nextUrl);
    commitRoute(readAppRoute(new URL(nextUrl).search));
  }, [commitRoute]);

  useEffect(() => {
    const handlePopState = () => commitRoute(getCurrentRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [commitRoute]);

  useEffect(() => {
    if (!route.tour) return undefined;
    let cancelled = false;
    loadTour(route.tour)
      .then(({ records: tourRecords }) => {
        if (cancelled) return;
        setRecords(tourRecords);
        const restoredRecord = route.record
          ? tourRecords.find(({ id }) => String(id) === route.record)
          : null;
        if (restoredRecord) {
          setTourProgress(writeTourProgress({
            tourKey: route.tour,
            recordId: restoredRecord.id,
            recordName: restoredRecord.displayName,
          }));
        }
        setSelectedRecord(restoredRecord || null);
        setDetailsOpen(Boolean(restoredRecord));
        setTourLoadState({ key: route.tour, error: "" });
      })
      .catch((error) => {
        if (!cancelled) {
          setRecords([]);
          setSelectedRecord(null);
          setDetailsOpen(false);
          setTourLoadState({ key: route.tour, error: error.message });
        }
      });
    return () => { cancelled = true; };
  }, [route.record, route.tour]);

  useEffect(() => {
    if (!route.record || route.tour || String(selectedRecord?.id) === route.record) return;
    let cancelled = false;
    runBurialSearch({ recordId: route.record, limit: 1 }).then(([restoredRecord]) => {
      if (cancelled) return;
      if (!restoredRecord) {
        setRecords([]);
        setSelectedRecord(null);
        setDetailsOpen(false);
        return;
      }
      if (!route.section) setRecords([restoredRecord]);
      setSelectedRecord(restoredRecord);
      setDetailsOpen(true);
    });
    return () => { cancelled = true; };
  }, [route.record, route.section, route.tour, runBurialSearch, selectedRecord?.id]);

  const navigate = (view) => {
    if (view !== route.view) updateRoute({ view });
  };

  const rememberTour = (tourKey, record = null) => {
    const next = writeTourProgress({
      tourKey,
      recordId: record?.id,
      recordName: record?.displayName,
    });
    setTourProgress(next);
  };

  const selectTour = (tour) => {
    setSelectedRecord(null);
    setDetailsOpen(false);
    setTourLoadState({ key: "", error: "" });
    rememberTour(tour.key);
    updateRoute({ view: APP_VIEWS.MAP, tour: tour.key, record: "", query: "", section: "" });
  };

  const selectRecord = (record) => {
    setSelectedRecord(record);
    setDetailsOpen(true);
    if (!records.some(({ id }) => String(id) === String(record.id))) setRecords([record]);
    if (record.source === "tour") rememberTour(record.tourKey || route.tour, record);
    updateRoute({
      view: APP_VIEWS.MAP,
      record: record.id,
      tour: record.source === "tour" ? record.tourKey || route.tour : "",
    });
  };

  const unpin = () => {
    setSelectedRecord(null);
    setDetailsOpen(false);
    updateRoute({ record: "" }, { replace: true });
  };

  const showTourOverview = () => {
    setSelectedRecord(null);
    setDetailsOpen(false);
    updateRoute({ record: "" }, { replace: true });
  };

  const returnToTours = () => {
    updateRoute({
      view: APP_VIEWS.TOURS,
      query: "",
      section: "",
      tour: "",
      record: "",
    });
  };

  const continueSavedTour = () => {
    if (!continueTour) return;
    const savedRecord = tourProgress.tourKey === continueTour.key ? tourProgress.recordId : "";
    updateRoute({
      view: APP_VIEWS.MAP,
      tour: continueTour.key,
      record: continueRecord?.id || savedRecord,
      query: "",
      section: "",
    });
  };

  const browseSection = (section) => {
    const normalizedSection = String(section || "").trim();
    setRecords([]);
    setSelectedRecord(null);
    setDetailsOpen(false);
    updateRoute({
      view: APP_VIEWS.LOCATOR,
      section: normalizedSection,
      query: "",
      tour: "",
      record: "",
    });
  };

  const selectSection = (section) => {
    const normalizedSection = String(section || "").trim();
    if (!normalizedSection) return;

    setSelectedRecord(null);
    setDetailsOpen(false);
    if (normalizedSection === route.section && !route.tour) {
      if (route.record || route.query) {
        updateRoute({ record: "", query: "" }, { replace: true });
      }
      return;
    }

    setRecords([]);
    updateRoute({ section: normalizedSection, tour: "", record: "", query: "" });
  };

  const shareUrl = useMemo(() => selectedRecord
    ? buildAppUrl(window.location.href, {
      view: APP_VIEWS.MAP,
      query: "",
      section: "",
      record: selectedRecord.id,
      tour: selectedRecord.source === "tour" ? selectedRecord.tourKey : "",
      embedded: false,
    })
    : "", [selectedRecord]);

  const continueTourDetails = getContinueTourDetails(continueTour, continueRecord, tourProgress);
  const tourContext = getTourContext({
    activeTour,
    records,
    selectedTourIndex,
    selectRecord,
    showTourOverview,
  });

  const updateLocatorRoute = (changes) => {
    if (changes.section !== undefined && changes.section !== route.section) setRecords([]);
    updateRoute(changes, { replace: true });
  };

  return (
    <div className={["app-shell", route.embedded ? "app-shell--embedded" : ""].filter(Boolean).join(" ")}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <AppNavigation activeView={route.view} embedded={route.embedded} onNavigate={navigate} />
      <main id="main-content" className="app-content" tabIndex={-1}>
        <ToursDestination
          active={route.view === APP_VIEWS.TOURS}
          continueTour={continueTourDetails}
          loadingTour={loadingTour}
          onContinueTour={continueSavedTour}
          onSelectTour={selectTour}
        />
        <LocatorDestination
          active={route.view === APP_VIEWS.LOCATOR}
          burialSearch={burialSearch}
          route={route}
          onRouteChange={updateLocatorRoute}
          onSelect={selectRecord}
        />
        <MapDestination
          activeTour={activeTour}
          browseSection={browseSection}
          detailsOpen={detailsOpen}
          hasVisitedMap={hasVisitedMap}
          loadError={loadError}
          loadingTour={loadingTour}
          MapComponent={MapComponent}
          records={records}
          returnToTours={returnToTours}
          route={route}
          selectedRecord={selectedRecord}
          selectRecord={selectRecord}
          selectSection={selectSection}
          setDetailsOpen={setDetailsOpen}
          shareUrl={shareUrl}
          tourContext={tourContext}
          unpin={unpin}
        />
      </main>
    </div>
  );
}
