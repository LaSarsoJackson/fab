import React, { Suspense, lazy, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import "./App.css";

const BurialMap = lazy(() => import("./Map"));
const appTheme = createTheme({
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
        disableTouchRipple: true,
      },
    },
  },
});

const syncViewportMetrics = () => {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const root = document.documentElement;
  const viewport = window.visualViewport;

  root.style.setProperty("--app-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
  root.style.setProperty("--app-width", `${Math.round(viewport?.width || window.innerWidth)}px`);
  root.style.setProperty("--app-offset-top", `${Math.round(viewport?.offsetTop || 0)}px`);
};

export default function App() {
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

  return (
    <ThemeProvider theme={appTheme}>
      <Suspense
        fallback={
          <div className="app-shell-loading">
            <h1>Albany Rural Cemetery</h1>
            <p>Loading map experience…</p>
          </div>
        }
      >
        <BurialMap />
      </Suspense>
    </ThemeProvider>
  );
}
