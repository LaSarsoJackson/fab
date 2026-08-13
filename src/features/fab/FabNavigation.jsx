import React from "react";
import { ButtonBase } from "@mui/material";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import { ROUTING_QUERY_PARAMS } from "../../shared/routing";

export const FAB_APP_VIEWS = Object.freeze({
  TOURS: "tours",
  MAP: "map",
  SEARCH: "search",
});

const NAV_ITEMS = [
  {
    icon: AltRouteOutlinedIcon,
    label: "Tours",
    view: FAB_APP_VIEWS.TOURS,
  },
  {
    icon: MapOutlinedIcon,
    label: "Map",
    view: FAB_APP_VIEWS.MAP,
  },
  {
    icon: SearchRoundedIcon,
    label: "Search",
    view: FAB_APP_VIEWS.SEARCH,
  },
];

export const resolveFabAppView = (search = "") => {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const requestedView = String(params.get(ROUTING_QUERY_PARAMS.view) || "").toLowerCase();
  const hasMapContext = [
    ROUTING_QUERY_PARAMS.search,
    ROUTING_QUERY_PARAMS.section,
    ROUTING_QUERY_PARAMS.sharedSelection,
    ROUTING_QUERY_PARAMS.tour,
  ].some((key) => Boolean(params.get(key)));

  if (hasMapContext || requestedView === FAB_APP_VIEWS.MAP) {
    return FAB_APP_VIEWS.MAP;
  }

  if (requestedView === "burials" || requestedView === FAB_APP_VIEWS.SEARCH) {
    return FAB_APP_VIEWS.SEARCH;
  }

  return FAB_APP_VIEWS.TOURS;
};

export const syncFabAppViewUrl = (view, currentUrl = "") => {
  if (!currentUrl) return "";

  const url = new URL(currentUrl);
  const routeView = view === FAB_APP_VIEWS.SEARCH ? "burials" : view;

  if (view !== FAB_APP_VIEWS.MAP) {
    [
      ROUTING_QUERY_PARAMS.search,
      ROUTING_QUERY_PARAMS.section,
      ROUTING_QUERY_PARAMS.sharedSelection,
      ROUTING_QUERY_PARAMS.tour,
    ].forEach((key) => url.searchParams.delete(key));
  }

  url.searchParams.set(ROUTING_QUERY_PARAMS.view, routeView);

  return url.toString();
};

export default function FabNavigation({ activeView, onChange }) {
  return (
    <nav className="fab-navigation" aria-label="Primary">
      <a className="fab-navigation__brand" href="https://www.albany.edu/arce/">
        Albany Grave Finder
      </a>
      <div className="fab-navigation__items">
        {NAV_ITEMS.map(({ icon: Icon, label, view }) => {
          const isActive = activeView === view;

          return (
            <ButtonBase
              key={view}
              className={[
                "fab-navigation__item",
                isActive ? "fab-navigation__item--active" : "",
              ].filter(Boolean).join(" ")}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(view)}
            >
              <Icon className="fab-navigation__icon" aria-hidden="true" />
              <span>{label}</span>
            </ButtonBase>
          );
        })}
      </div>
    </nav>
  );
}
