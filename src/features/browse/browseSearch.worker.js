/* eslint-env worker */
/* global globalThis */
import { buildSearchIndex, smartSearch } from "./burialSearch";

const workerScope = globalThis;

let records = [];
let searchIndex = null;
let activeRecordVersion = 0;

const getWorkerTourName = (record = {}) => (
  record.tourName || record.title || record.tourKey || ""
);

const postWorkerMessage = (message) => {
  if (typeof workerScope.postMessage === "function") {
    workerScope.postMessage(message);
  }
};

const hydrateSearchRecords = ({ recordVersion = 0, records: nextRecords = [] } = {}) => {
  activeRecordVersion = recordVersion;
  records = Array.isArray(nextRecords) ? nextRecords : [];
  searchIndex = buildSearchIndex(records, { getTourName: getWorkerTourName });
  postWorkerMessage({
    type: "ready",
    recordVersion: activeRecordVersion,
  });
};

const runSearchQuery = ({ requestId, recordVersion = 0, query = "" } = {}) => {
  if (recordVersion !== activeRecordVersion || !searchIndex) {
    postWorkerMessage({
      type: "stale",
      requestId,
      recordVersion,
    });
    return;
  }

  const resultIds = smartSearch(records, query, {
    index: searchIndex,
    getTourName: getWorkerTourName,
  }).map((record) => record.id);

  postWorkerMessage({
    type: "results",
    requestId,
    recordVersion,
    resultIds,
  });
};

workerScope.onmessage = (event) => {
  const message = event?.data || {};

  try {
    if (message.type === "hydrate") {
      hydrateSearchRecords(message);
      return;
    }

    if (message.type === "query") {
      runSearchQuery(message);
    }
  } catch (error) {
    postWorkerMessage({
      type: "error",
      requestId: message.requestId,
      recordVersion: message.recordVersion,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
