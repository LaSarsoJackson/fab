import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { APP_VIEWS, buildAppUrl, readAppRoute } from "./app/routes";
import AppNavigation from "./components/AppNavigation";
import RecordCard from "./components/RecordCard";
import LocatorView from "./features/locator/LocatorView";
import useBurialSearch from "./features/locator/useBurialSearch";
import { findTourDefinition, loadTour } from "./features/tours/loadTour";
import TourStopsPanel from "./features/tours/TourStopsPanel";
import ToursView from "./features/tours/ToursView";

const MapView = lazy(() => import("./features/map/MapView"));

const getCurrentRoute = () => readAppRoute(window.location.search);

export default function App() {
  const [route, setRoute] = useState(getCurrentRoute);
  const [records, setRecords] = useState(() => route.legacySelection ? [route.legacySelection] : []);
  const [selectedRecord, setSelectedRecord] = useState(route.legacySelection);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(route.legacySelection));
  const [tourLoadState, setTourLoadState] = useState({ key: "", error: "" });
  const burialSearch = useBurialSearch();
  const runBurialSearch = burialSearch.runSearch;
  const loadingTour = route.tour && tourLoadState.key !== route.tour ? route.tour : "";
  const loadError = tourLoadState.key === route.tour ? tourLoadState.error : "";
  const activeTour = route.tour ? findTourDefinition(route.tour) : null;

  const commitRoute = useCallback((nextRoute) => {
    setRoute(nextRoute);
    if (nextRoute.tour || nextRoute.record || nextRoute.legacySelection) return;
    setRecords([]);
    setSelectedRecord(null);
    setDetailsOpen(false);
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
      setRecords([restoredRecord]);
      setSelectedRecord(restoredRecord);
      setDetailsOpen(true);
    });
    return () => { cancelled = true; };
  }, [route.record, route.tour, runBurialSearch, selectedRecord?.id]);

  const navigate = (view) => {
    if (view === APP_VIEWS.TOURS) {
      updateRoute({ view, query: "", section: "", tour: "", record: "" });
      return;
    }
    if (view === APP_VIEWS.LOCATOR) {
      updateRoute({ view, tour: "", record: "" });
      return;
    }
    updateRoute({ view, query: "", section: "", tour: "", record: "" });
  };

  const selectTour = (tour) => {
    setSelectedRecord(null);
    setDetailsOpen(false);
    setTourLoadState({ key: "", error: "" });
    updateRoute({ view: APP_VIEWS.MAP, tour: tour.key, record: "", query: "", section: "" });
  };

  const selectRecord = (record) => {
    setSelectedRecord(record);
    setDetailsOpen(true);
    if (!records.some(({ id }) => String(id) === String(record.id))) setRecords([record]);
    updateRoute({ view: APP_VIEWS.MAP, record: record.id });
  };

  const unpin = () => {
    setSelectedRecord(null);
    setDetailsOpen(false);
    updateRoute({ record: "" }, { replace: true });
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
          <ToursView loadingTour={loadingTour} onSelectTour={selectTour} />
        ) : null}
        {route.view === APP_VIEWS.LOCATOR ? (
          <LocatorView
            initialQuery={route.query}
            initialSection={route.section}
            search={burialSearch}
            onRouteChange={(changes) => updateRoute(changes, { replace: true })}
            onSelect={selectRecord}
          />
        ) : null}
        {route.view === APP_VIEWS.MAP ? (
          <section className="map-page" aria-label="Cemetery Map">
            <Suspense fallback={<p className="map-loading" role="status">Loading cemetery map…</p>}>
              <MapView
                records={records}
                selectedRecord={selectedRecord}
                selectedSection={route.section}
                focusKey={selectedRecord?.id || route.tour || "cemetery"}
                tourStopsPresent={Boolean(activeTour)}
                onRecordSelect={(record) => {
                  if (!record) return;
                  if (String(record.id) === String(selectedRecord?.id)) {
                    setDetailsOpen(true);
                    return;
                  }
                  selectRecord(record);
                }}
                onSectionSelect={(section) => updateRoute({ view: APP_VIEWS.LOCATOR, section, query: "", tour: "", record: "" })}
              />
            </Suspense>
            {loadingTour ? <p className="map-status" role="status">Loading tour…</p> : null}
            {loadError ? <p className="map-status map-status--error">{loadError}</p> : null}
            {activeTour && !loadingTour && !detailsOpen ? (
              <TourStopsPanel
                tour={activeTour}
                records={records}
                selectedRecord={selectedRecord}
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
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
