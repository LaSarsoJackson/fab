const Icon = ({ children, className = "" }) => (
  <svg
    className={className}
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const ToursIcon = (props) => (
  <Icon {...props}>
    <path d="M5 19V7l6-3 2 2 6-2v12l-6 3-2-2-6 2Z" />
    <path d="M11 4v13M13 6v13" />
  </Icon>
);

export const MapIcon = (props) => (
  <Icon {...props}>
    <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
    <path d="M9 3v15M15 6v15" />
  </Icon>
);

export const SearchIcon = (props) => (
  <Icon {...props}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </Icon>
);

export const ExternalIcon = (props) => (
  <Icon {...props}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
  </Icon>
);

export const CloseIcon = (props) => (
  <Icon {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const ArrowRightIcon = (props) => (
  <Icon {...props}>
    <path d="M4 12h16m-6-6 6 6-6 6" />
  </Icon>
);

export const LayersIcon = (props) => <Icon {...props}>
  <path d="m3 8 9-5 9 5-9 5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />
</Icon>;

export const HelpIcon = (props) => <Icon {...props}>
  <circle cx="12" cy="12" r="9" />
  <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01" />
</Icon>;

export const EditIcon = (props) => <Icon {...props}>
  <path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5" />
</Icon>;
