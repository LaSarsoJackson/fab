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
const SECTION_MAP_LIMIT = 5000;

const getCurrentRoute = () => readAppRoute(window.location.search);

export default function App() {
  const [route, setRoute] = useState(getCurrentRoute);
  const [hasVisitedMap, setHasVisitedMap] = useState(() => route.view === APP_VIEWS.MAP);
  const [records, setRecords] = useState(() => route.legacySelection ? [route.legacySelection] : []);
  const [selectedRecord, setSelectedRecord] = useState(route.legacySelection);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(route.legacySelection));
  const [tourLoadState, setTourLoadState] = useState({ key: "", error: "" });
  const [tourProgress, setTourProgress] = useState(readTourProgress);
  const burialSearch = useBurialSearch();
  const runBurialSearch = burialSearch.runSearch;
  const loadingTour = route.tour && tourLoadState.key !== route.tour ? route.tour : "";
  const loadError = tourLoadState.key === route.tour ? tourLoadState.error : "";
  const activeTour = route.tour ? findTourDefinition(route.tour) : null;
  const savedTour = findTourDefinition(tourProgress.tourKey);
  const continueTour = activeTour || savedTour;
  const continueRecord = selectedRecord?.source === "tour" &&
    selectedRecord.tourKey === continueTour?.key
    ? selectedRecord
    : null;
  const selectedTourIndex = selectedRecord?.source === "tour"
    ? records.findIndex(({ id }) => String(id) === String(selectedRecord.id))
    : -1;

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
    if (route.view !== APP_VIEWS.MAP || !route.section || route.tour) return undefined;
    let cancelled = false;
    runBurialSearch({ section: route.section, limit: SECTION_MAP_LIMIT })
      .then((sectionRecords) => {
        if (cancelled) return;
        const currentRoute = getCurrentRoute();
        if (
          currentRoute.view === APP_VIEWS.MAP &&
          currentRoute.section === route.section &&
          !currentRoute.tour
        ) {
          setRecords(sectionRecords);
        }
      });
    return () => { cancelled = true; };
  }, [route.section, route.tour, route.view, runBurialSearch]);

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

  return (
    <div className={["app-shell", route.embedded ? "app-shell--embedded" : ""].filter(Boolean).join(" ")}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <AppNavigation activeView={route.view} embedded={route.embedded} onNavigate={navigate} />
      <main id="main-content" className="app-content" tabIndex={-1}>
        {route.view === APP_VIEWS.TOURS ? (
          <ToursView
            continueTour={continueTour ? {
              ...continueTour,
              recordName: continueRecord?.displayName || (
                tourProgress.tourKey === continueTour.key ? tourProgress.recordName : ""
              ),
            } : null}
            loadingTour={loadingTour}
            onContinueTour={continueSavedTour}
            onSelectTour={selectTour}
          />
        ) : null}
        {route.view === APP_VIEWS.LOCATOR ? (
          <LocatorView
            initialQuery={route.query}
            initialSection={route.section}
            search={burialSearch}
            onRouteChange={(changes) => {
              if (changes.section !== undefined && changes.section !== route.section) {
                setRecords([]);
              }
              updateRoute(changes, { replace: true });
            }}
            onSelect={selectRecord}
          />
        ) : null}
        {hasVisitedMap || route.view === APP_VIEWS.MAP ? (
          <section
            className={[
              "map-page",
              activeTour && detailsOpen ? "map-page--record-open" : "",
            ].filter(Boolean).join(" ")}
            aria-label="Cemetery Map"
            hidden={route.view !== APP_VIEWS.MAP}
          >
            <Suspense fallback={<p className="map-loading" role="status">Loading cemetery map…</p>}>
              <MapView
                active={route.view === APP_VIEWS.MAP}
                records={records}
                selectedRecord={selectedRecord}
                selectedSection={route.section}
                focusKey={selectedRecord?.id || route.section || route.tour || "cemetery"}
                tourStopsPresent={Boolean(activeTour)}
                sectionRecordCount={!activeTour ? records.filter(({ source }) => source === "burial").length : 0}
                sectionRecordsStatus={!activeTour ? burialSearch.status : "idle"}
                onRecordSelect={(record) => {
                  if (!record) return;
                  if (String(record.id) === String(selectedRecord?.id)) {
                    setDetailsOpen(true);
                    return;
                  }
                  selectRecord(record);
                }}
                onSectionSelect={(section) => {
                  setRecords([]);
                  setSelectedRecord(null);
                  setDetailsOpen(false);
                  updateRoute({ section, tour: "", record: "", query: "" });
                }}
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
              tourContext={selectedTourIndex >= 0 && activeTour?.kind === "tour" ? {
                position: selectedTourIndex + 1,
                total: records.length,
                onOverview: showTourOverview,
                onPrevious: selectedTourIndex > 0
                  ? () => selectRecord(records[selectedTourIndex - 1])
                  : null,
                onNext: selectedTourIndex < records.length - 1
                  ? () => selectRecord(records[selectedTourIndex + 1])
                  : null,
              } : null}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
