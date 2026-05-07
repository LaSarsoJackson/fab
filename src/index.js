/**
 * Browser bootstrap for the React app. Everything after mount is delegated to
 * feature/profile modules so this entrypoint stays auditable.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';

// Keep the entrypoint deliberately thin. Runtime profile wiring, document
// metadata, PWA registration, and map behavior each live behind their owning
// modules so boot remains easy to audit.
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
registerServiceWorker();
