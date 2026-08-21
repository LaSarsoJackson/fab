import { prepareSearchRows, searchPreparedRows } from "./searchEngine";

let preparedRowsPromise = null;

const loadRows = async (dataUrl) => {
  if (!preparedRowsPromise) {
    preparedRowsPromise = fetch(dataUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Burial index request failed (${response.status})`);
        return response.json();
      })
      .then(prepareSearchRows);
  }
  return preparedRowsPromise;
};

self.onmessage = async ({ data }) => {
  const { dataUrl, requestId, ...criteria } = data || {};
  try {
    const preparedRows = await loadRows(dataUrl);
    self.postMessage({ requestId, ...searchPreparedRows(preparedRows, criteria) });
  } catch (error) {
    self.postMessage({ requestId, error: error instanceof Error ? error.message : "Search failed" });
  }
};
