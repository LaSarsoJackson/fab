import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import App from "./App";
import AppErrorBoundary from "./AppErrorBoundary";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <AppErrorBoundary
    title="Albany Grave Finder is unavailable"
    message="Reload the page to try again."
    reloadLabel="Reload"
  >
    <App />
  </AppErrorBoundary>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
