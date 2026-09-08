import sections from "../../data/ARC_Sections.json";
import { getGeoJsonBounds } from "../../shared/geoJsonBounds";

export const getSectionBounds = (section) => getGeoJsonBounds({
  type: "FeatureCollection",
  // Some sections have several features. Fit every piece of the section.
  features: sections.features.filter((feature) => (
    String(feature.properties.Section) === String(section).trim()
  )),
});
