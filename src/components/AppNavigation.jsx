import { APP_VIEWS } from "../app/routes";
import { ExternalIcon, MapIcon, SearchIcon, ToursIcon } from "../app/icons";

const ITEMS = [
  { view: APP_VIEWS.MAP, label: "Cemetery Map", Icon: MapIcon },
  { view: APP_VIEWS.TOURS, label: "Search Tours", Icon: ToursIcon },
  { view: APP_VIEWS.LOCATOR, label: "Burial Locator", Icon: SearchIcon },
];

export default function AppNavigation({ activeView, embedded = false, onNavigate }) {
  if (embedded) return null;

  return (
    <nav className="app-navigation" aria-label="Primary">
      <a className="app-navigation__brand" href={`${import.meta.env.BASE_URL}product.html`} aria-label="About Albany Grave Finder">
        <span className="app-navigation__eyebrow">Albany Rural Cemetery</span>
        <span className="app-navigation__name">Albany Grave Finder</span>
      </a>
      <div className="app-navigation__destinations">
        {ITEMS.map(({ view, label, Icon }) => (
          <button
            key={view}
            type="button"
            className="app-navigation__item"
            aria-current={activeView === view ? "page" : undefined}
            onClick={() => onNavigate(view)}
          >
            <Icon className="app-navigation__icon" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <a
        className="app-navigation__website"
        href="https://www.albany.edu/arce/"
        target="_blank"
        rel="noreferrer"
      >
        <ExternalIcon className="app-navigation__website-icon" />
        <span>ARCE website</span>
      </a>
    </nav>
  );
}
