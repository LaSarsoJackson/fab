let sharedWorker = null;
let consumers = 0;
let nextRequestId = 0;
const pending = new Map();

function getWorker() {
  if (sharedWorker) return sharedWorker;
  const worker = new Worker(new URL("./search.worker.js", import.meta.url), { type: "module" });
  sharedWorker = worker;
  worker.onmessage = ({ data }) => {
    const complete = pending.get(data.requestId);
    pending.delete(data.requestId);
    complete?.(data);
  };
  worker.onerror = event => {
    if (sharedWorker !== worker) return;
    sharedWorker = null;
    worker.terminate();
    const callbacks = [...pending.values()];
    pending.clear();
    for (const complete of callbacks) complete({ error: event.message || "Burial search could not start" });
  };
  return worker;
}

export function retainBurialSearchWorker() {
  consumers += 1;
  return () => {
    consumers -= 1;
    if (consumers) return;
    sharedWorker?.terminate();
    sharedWorker = null;
  };
}

export function requestBurialSearch(criteria, complete) {
  const worker = getWorker();
  const requestId = ++nextRequestId;
  pending.set(requestId, complete);
  worker.postMessage({ ...criteria, requestId, dataUrl: `${import.meta.env.BASE_URL}data/Search_Burials.json` });
  return () => {
    const callback = pending.get(requestId);
    pending.delete(requestId);
    callback?.({ cancelled: true });
  };
}
