import React, { Suspense, lazy, useEffect, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { isAdminHash } from "./admin/adminHash";
import { APP_PROFILE } from "./features/fab/profile";
import { isAdminStudioEnabled, syncDocumentMetadata } from "./shared/runtime";
import "./App.css";

const BurialMap = lazy(() => import("./Map"));
const AdminRoute = lazy(() => import("./AdminRoute"));
const PRIMARY_ACCENT = "#2f6b57";
const PRIMARY_ACCENT_DARK = "#255544";
const PRIMARY_ACCENT_TINT = "#d9e8e0";
const PANEL_BORDER = "rgba(20, 33, 43, 0.12)";

const appTheme = createTheme({
  palette: {
    primary: {
      main: PRIMARY_ACCENT,
      dark: PRIMARY_ACCENT_DARK,
      light: PRIMARY_ACCENT_TINT,
      contrastText: "#ffffff",
    },
    background: {
      default: "#f5f5f7",
      paper: "rgba(255, 255, 255, 0.92)",
    },
    text: {
      primary: "#18212b",
      secondary: "#677381",
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Avenir Next', 'Segoe UI', sans-serif",
    h6: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    subtitle1: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    subtitle2: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    button: {
      fontWeight: 600,
      letterSpacing: 0,
      textTransform: "none",
    },
    overline: {
      fontWeight: 700,
      letterSpacing: "0.12em",
    },
  },
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
        disableTouchRipple: true,
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 14,
        },
        containedPrimary: {
          background: PRIMARY_ACCENT,
          boxShadow: "0 10px 22px rgba(47, 107, 87, 0.18)",
          "&:hover": {
            background: PRIMARY_ACCENT_DARK,
            boxShadow: "0 12px 24px rgba(47, 107, 87, 0.22)",
          },
        },
        outlined: {
          borderColor: PANEL_BORDER,
          backgroundColor: "rgba(255, 255, 255, 0.68)",
          "&:hover": {
            borderColor: PANEL_BORDER,
            backgroundColor: "rgba(255, 255, 255, 0.86)",
          },
        },
        text: {
          color: "#5f6c79",
          "&:hover": {
            backgroundColor: "rgba(20, 33, 43, 0.05)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
        },
        colorPrimary: {
          backgroundColor: PRIMARY_ACCENT_TINT,
          color: PRIMARY_ACCENT_DARK,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255, 255, 255, 0.84)",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: PANEL_BORDER,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(47, 107, 87, 0.28)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: PRIMARY_ACCENT,
            borderWidth: 1,
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: PANEL_BORDER,
        },
      },
    },
  },
});
const {
  adminLoadingMessage,
  adminLoadingTitle,
  appName,
  mapLoadingMessage,
  mapLoadingTitle,
} = APP_PROFILE.brand;
const APP_SHELL = APP_PROFILE.shell || {};
const APP_DOCUMENT_TITLE = APP_SHELL.documentTitle || appName;
const APP_DESCRIPTION = APP_SHELL.description || "";

const syncViewportMetrics = () => {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const root = document.documentElement;
  const viewport = window.visualViewport;

  root.style.setProperty("--app-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
  root.style.setProperty("--app-width", `${Math.round(viewport?.width || window.innerWidth)}px`);
  root.style.setProperty("--app-offset-top", `${Math.round(viewport?.offsetTop || 0)}px`);
};

const getIsAdminMode = () => (
  isAdminStudioEnabled() && typeof window !== "undefined" && isAdminHash(window.location.hash)
);

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(getIsAdminMode);

  useEffect(() => {
    syncDocumentMetadata({
      title: APP_DOCUMENT_TITLE,
      description: APP_DESCRIPTION,
      url: typeof window === "undefined" ? "" : window.location.href,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const viewport = window.visualViewport;
    syncViewportMetrics();

    window.addEventListener("resize", syncViewportMetrics);
    viewport?.addEventListener("resize", syncViewportMetrics);
    viewport?.addEventListener("scroll", syncViewportMetrics);

    return () => {
      window.removeEventListener("resize", syncViewportMetrics);
      viewport?.removeEventListener("resize", syncViewportMetrics);
      viewport?.removeEventListener("scroll", syncViewportMetrics);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncHashMode = () => {
      setIsAdminMode(getIsAdminMode());
    };

    syncHashMode();
    window.addEventListener("hashchange", syncHashMode);

    return () => {
      window.removeEventListener("hashchange", syncHashMode);
    };
  }, []);

  return (
    <ThemeProvider theme={appTheme}>
      <a className="app-skip-link" href="#app-main">
        Skip to main content
      </a>
      <main id="app-main" className="app-shell-main" tabIndex={-1}>
        <Suspense
          fallback={
            <div className="app-shell-loading" role="status" aria-live="polite">
              <h1>{isAdminMode ? adminLoadingTitle : mapLoadingTitle || appName}</h1>
              <p>{isAdminMode ? adminLoadingMessage : mapLoadingMessage}</p>
            </div>
          }
        >
          {isAdminMode ? <AdminRoute /> : <BurialMap />}
        </Suspense>
      </main>
    </ThemeProvider>
  );
}
