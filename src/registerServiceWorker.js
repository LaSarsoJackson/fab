/**
 * Production-only service-worker registration. The registered URL must honor
 * PUBLIC_URL because GitHub Pages serves FAB from the /fab subpath.
 */
import { buildPublicAssetUrl } from "./shared/runtimeEnv";

const registerServiceWorker = () => {
  // Local development should always fetch fresh bundles and data. The service
  // worker is only useful for production PWA installs and GitHub Pages builds.
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      // GitHub Pages serves FAB under /fab, so the registered path must pass
      // through the shared PUBLIC_URL helper instead of assuming root hosting.
      .register(buildPublicAssetUrl("/service-worker.js"))
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
};

export default registerServiceWorker;
