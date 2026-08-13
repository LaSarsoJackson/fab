/**
 * Root React shell for FAB. Keep this file limited to app-wide theme,
 * document metadata, viewport sizing, and the lazy map entrypoint.
 */
import React, { Suspense, lazy, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { APP_PROFILE } from "./features/fab/profile";
import { syncDocumentMetadata } from "./shared/runtimeEnv";
import AppErrorBoundary from "./AppErrorBoundary";
import "./App.css";

const BurialMap = lazy(() => import("./Map"));
const PRIMARY_ACCENT = "#2f6b57";
const PRIMARY_ACCENT_DARK = "#255544";
const PRIMARY_ACCENT_TINT = "#e6f0eb";
const PANEL_BORDER = "rgba(24, 33, 43, 0.14)";

// Keep the shared shell theme in one place so map and sidebar components can
// focus on workflow states instead of repeating brand color decisions.
const appTheme = createTheme({
  palette: {
    primary: {
      main: PRIMARY_ACCENT,
      dark: PRIMARY_ACCENT_DARK,
      light: PRIMARY_ACCENT_TINT,
      contrastText: "#ffffff",
    },
    background: {
      default: "#f6f7f8",
      paper: "#ffffff",
    },
    text: {
      primary: "#18212b",
      secondary: "#677381",
    },
  },
  shape: {
    borderRadius: 12,
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
          borderRadius: 10,
          paddingInline: 14,
        },
        containedPrimary: {
          background: PRIMARY_ACCENT,
          boxShadow: "0 1px 2px rgba(20, 33, 43, 0.12)",
          "&:hover": {
            background: PRIMARY_ACCENT_DARK,
            boxShadow: "0 2px 4px rgba(20, 33, 43, 0.14)",
          },
        },
        outlined: {
          borderColor: PANEL_BORDER,
          backgroundColor: "#ffffff",
          "&:hover": {
            borderColor: PANEL_BORDER,
            backgroundColor: "#f6f7f8",
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
          backgroundColor: "#ffffff",
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
  appName,
  mapLoadingMessage,
  mapLoadingTitle,
} = APP_PROFILE.brand;
const APP_SHELL = APP_PROFILE.shell || {};
const APP_DOCUMENT_TITLE = APP_SHELL.documentTitle || appName;
const APP_DESCRIPTION = APP_SHELL.description || "";
const APP_ERROR_TITLE = APP_SHELL.errorTitle || mapLoadingTitle || appName;
const APP_ERROR_MESSAGE = APP_SHELL.errorMessage
  || "The map failed to load. Reload the page to try again.";
const APP_ERROR_RELOAD_LABEL = APP_SHELL.errorReloadLabel || "Reload";

export default function App() {
  useEffect(() => {
    syncDocumentMetadata({
      title: APP_DOCUMENT_TITLE,
      description: APP_DESCRIPTION,
      url: typeof window === "undefined" ? "" : window.location.href,
    });
  }, []);

  return (
    <ThemeProvider theme={appTheme}>
      <a className="app-skip-link" href="#app-main">
        Skip to main content
      </a>
      <main id="app-main" className="app-shell-main" tabIndex={-1}>
        <AppErrorBoundary
          title={APP_ERROR_TITLE}
          message={APP_ERROR_MESSAGE}
          reloadLabel={APP_ERROR_RELOAD_LABEL}
        >
          <Suspense
            fallback={
              <div className="app-shell-loading" role="status" aria-live="polite">
                <h1>{mapLoadingTitle || appName}</h1>
                <p>{mapLoadingMessage}</p>
              </div>
            }
          >
            <BurialMap />
          </Suspense>
        </AppErrorBoundary>
      </main>
    </ThemeProvider>
  );
}
