import { buildPublicAssetUrl } from "./shared/runtime/runtimeEnv";

const registerServiceWorker = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(buildPublicAssetUrl("/service-worker.js"))
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
};

export default registerServiceWorker;
