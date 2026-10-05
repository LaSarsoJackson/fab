import { prepareSearchRows, searchPreparedRows } from "./searchEngine";

let preparedRowsPromise = null;

const loadRows = async (dataUrl) => {
  if (!preparedRowsPromise) {
    preparedRowsPromise = fetch(dataUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Burial index request failed (${response.status})`);
        return response.json();
      })
      .then(prepareSearchRows)
      .catch((error) => {
        preparedRowsPromise = null;
        throw error;
      });
  }
  return preparedRowsPromise;
};

let latestRequest = 0;

self.onmessage = async ({ data }) => {
  const { dataUrl, requestId, ...criteria } = data || {};
  const debounce = !criteria.recordId && criteria.limit !== Infinity;
  if (debounce) latestRequest = requestId;
  const superseded = () => {
    if (!debounce || requestId === latestRequest) return false;
    self.postMessage({ requestId, cancelled: true, rows: [], total: 0 });
    return true;
  };
  try {
    // Yield briefly so a burst of queued keystrokes collapses to the latest request.
    if (debounce) await new Promise(resolve => setTimeout(resolve, 75));
    if (superseded()) return;
    const preparedRows = await loadRows(dataUrl);
    if (superseded()) return;
    self.postMessage({ requestId, ...searchPreparedRows(preparedRows, criteria) });
  } catch (error) {
    self.postMessage({ requestId, error: error instanceof Error ? error.message : "Search failed" });
  }
};
