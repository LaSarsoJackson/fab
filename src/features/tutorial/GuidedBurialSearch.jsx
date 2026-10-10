import { Component, useEffect, useRef, useState } from 'react';
import { CloseIcon, HelpIcon } from '../../app/icons';
import { APP_VIEWS } from '../../app/routes';
import './guided-search.css';

const website = import.meta.env.VITE_ARCE_WEBSITE_URL || 'https://www.albany.edu/arce/dev/';

export class TutorialMapBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    if (this.state.failed) return <div className="map-loading"><button type="button" onClick={() => window.location.reload()}>Reload map</button></div>;
    return this.props.children;
  }
}

function helpFor({ route, selectedRecord, detailsOpen, mapStatus, routing }) {
  if (route.view === APP_VIEWS.TOURS) return {
    guide: 'tutorial.html',
    text: 'Open any tour stop from the list or map.',
  };
  if (route.view === APP_VIEWS.LOCATOR) return {
    guide: 'Burial_Locator_tutorial.html',
    text: 'Part of a name is enough. Add a section, lot or tier to narrow the results.',
  };
  if (mapStatus === 'error') return {
    guide: 'Burial_Locator_tutorial.html', text: 'The map did not load. Reload it or open the illustrated guide.',
  };
  if (routing.draft) return {
    guide: 'Burial_Locator_tutorial.html',
    text: 'Use my location follows you as you walk. From lets you search for another start or choose it on the map.',
  };
  return {
    guide: 'Burial_Locator_tutorial.html',
    text: selectedRecord && detailsOpen
      ? 'The marker shows the burial’s recorded location.'
      : 'Select a section to see its burials. Layers shows section boundaries.',
  };
}

export default function GuidedBurialSearch({ route, selectedRecord, detailsOpen, mapStatus, routing, onExampleSearch }) {
  const help = helpFor({ route, selectedRecord, detailsOpen, mapStatus, routing: routing || {} });
  const [openView, setOpenView] = useState(null);
  const open = openView === route.view;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const close = () => { setOpenView(null); triggerRef.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus({ preventScroll: true });
    const outside = event => { if (!rootRef.current?.contains(event.target)) setOpenView(null); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const emptySearch = route.view === APP_VIEWS.LOCATOR && ![route.query, route.section, route.lot, route.tier].some(Boolean);
  return <div className={`guided-search${route.view === APP_VIEWS.MAP ? ' guided-search--map' : ''}`} ref={rootRef} onKeyDown={event => {
    if (event.key === 'Escape' && open) { close(); event.stopPropagation(); }
  }}>
    <button ref={triggerRef} className="icon-button" type="button" aria-label="Help" title="Help" aria-expanded={open} aria-controls={open ? 'app-help-panel' : undefined} onClick={() => open ? close() : setOpenView(route.view)}><HelpIcon /></button>
    {open ? <section id="app-help-panel" ref={panelRef} className="guided-search__content" role="dialog" aria-label="Help" tabIndex={-1}>
      <header><h2>Help</h2><button type="button" className="icon-button" aria-label="Close help" onClick={close}><CloseIcon /></button></header>
      <p>{help.text}</p>
      <div className="guided-search__links">
        {emptySearch ? <button type="button" onClick={() => { setOpenView(null); onExampleSearch(); }}>Try an example</button> : null}
        <a href={`${website}${help.guide}`}>Illustrated guide</a>
      </div>
    </section> : null}
  </div>;
}
