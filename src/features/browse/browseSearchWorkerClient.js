export const createBrowseSearchWorker = () => (
  new Worker(new URL("./browseSearch.worker.js", import.meta.url))
);
