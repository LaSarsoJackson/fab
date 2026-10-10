import { useEffect, useRef, useState } from "react";
import { LayersIcon } from "../../app/icons";

export default function MapLayers({ basemap, showSections, locationPrivate, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="map-toolbar" ref={rootRef} onKeyDown={(event) => {
    if (event.key === "Escape" && open) { setOpen(false); triggerRef.current?.focus(); event.stopPropagation(); }
  }}>
    <button ref={triggerRef} className="icon-button" type="button" aria-label="Map layers" title="Map layers" aria-expanded={open} aria-controls={open ? "map-layers" : undefined} onClick={() => setOpen(!open)}><LayersIcon /></button>
    {open ? <section id="map-layers" className="map-layers" aria-label="Map layers">
      <fieldset disabled={locationPrivate}>
        <legend className="visually-hidden">Background map</legend>
        {["Terrain", "Streets", "Aerial"].map(label => <label className="map-layer-choice" key={label}><input type="radio" name="basemap" checked={basemap === label.toLowerCase()} onChange={() => onChange("basemap", label.toLowerCase())} />{label}</label>)}
      </fieldset>
      {locationPrivate ? <p>Background maps are off after using location.</p> : null}
      <label className="map-layer-choice map-layer-choice--sections"><input type="checkbox" checked={showSections} onChange={(event) => onChange("showSections", event.target.checked)} />Sections</label>
    </section> : null}
  </div>;
}
