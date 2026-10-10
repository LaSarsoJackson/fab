import { APP_VIEWS } from "../app/routes";
import { ExternalIcon, MapIcon, SearchIcon, ToursIcon } from "../app/icons";

const ITEMS = [
  { view: APP_VIEWS.MAP, label: "Cemetery Map", Icon: MapIcon },
  { view: APP_VIEWS.TOURS, label: "Search Tours", Icon: ToursIcon },
  { view: APP_VIEWS.LOCATOR, label: "Burial Locator", Icon: SearchIcon },
];
const websiteUrl = import.meta.env.VITE_ARCE_WEBSITE_URL;

export default function AppNavigation({ activeView, embedded = false, onNavigate }) {
  if (embedded) return null;

  return (
    <nav className="app-navigation" aria-label="Primary">
      <div className="app-navigation__brand">
        <span className="app-navigation__eyebrow">Albany Rural Cemetery</span>
        <span className="app-navigation__name">Albany Grave Finder</span>
      </div>
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
        className={`app-navigation__website${websiteUrl ? ' app-navigation__website--return' : ''}`}
        href={websiteUrl || 'https://www.albany.edu/arce/'}
        target={websiteUrl ? undefined : '_blank'}
        rel={websiteUrl ? undefined : 'noreferrer'}
      >
        {websiteUrl ? <span className="app-navigation__website-icon" aria-hidden="true">←</span> : <ExternalIcon className="app-navigation__website-icon" />}
        <span>{websiteUrl ? 'Back to ARCE' : 'ARCE website'}</span>
      </a>
    </nav>
  );
}
