const registerServiceWorker = () => {
  const isProduction =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) ||
    process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    const baseUrl =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ||
      '/';
    const serviceWorkerUrl = `${baseUrl.replace(/\/?$/, '/')}service-worker.js`;

    navigator.serviceWorker
      .register(serviceWorkerUrl)
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
};

export default registerServiceWorker;
