const hasIdleCallback = () => (
  typeof window !== "undefined" &&
  typeof window.requestIdleCallback === "function"
);

export const scheduleIdleTask = (
  callback,
  {
    timeout = 1000,
    fallbackDelay = 16,
  } = {}
) => {
  if (typeof callback !== "function") {
    return null;
  }

  if (hasIdleCallback()) {
    // Prefer browser idle time for heavyweight derived work, but keep a timeout
    // so search indexes and tour metadata still progress on a busy main thread.
    return {
      type: "idle",
      id: window.requestIdleCallback(() => {
        callback();
      }, { timeout }),
    };
  }

  // JSDOM and older browsers do not expose requestIdleCallback. A short timeout
  // preserves the same async contract for tests and fallback runtimes.
  return {
    type: "timeout",
    id: setTimeout(() => {
      callback();
    }, fallbackDelay),
  };
};

export const cancelIdleTask = (handle) => {
  if (!handle) {
    return;
  }

  if (handle.type === "idle" && hasIdleCallback()) {
    window.cancelIdleCallback(handle.id);
    return;
  }

  clearTimeout(handle.id);
};

export const buildPublicAssetUrl = (
  path,
  publicUrl = process.env.PUBLIC_URL || ""
) => {
  // GitHub Pages deploys this app under /fab, while local dev runs at origin
  // root. All public fetches and service-worker URLs should pass through here.
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;

  return `${publicUrl}${normalizedPath}`;
};

const resolveDocument = (documentOverride) => {
  if (documentOverride) {
    return documentOverride;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return document;
};

export const setDocumentMetaContent = (selector, content, documentOverride) => {
  const targetDocument = resolveDocument(documentOverride);
  if (!targetDocument) {
    return;
  }

  const element = targetDocument.querySelector(selector);
  if (!element) {
    return;
  }

  element.setAttribute("content", content);
};

export const syncDocumentMetadata = ({
  title,
  description,
  url = "",
} = {}, documentOverride) => {
  const targetDocument = resolveDocument(documentOverride);
  if (!targetDocument) {
    return;
  }

  // Metadata is synced at runtime from the FAB profile because the static shell
  // can be regenerated separately from the React bundle.
  if (typeof title === "string") {
    targetDocument.title = title;
    setDocumentMetaContent('meta[property="og:title"]', title, targetDocument);
    setDocumentMetaContent('meta[name="twitter:title"]', title, targetDocument);
  }

  if (typeof description === "string") {
    setDocumentMetaContent('meta[name="description"]', description, targetDocument);
    setDocumentMetaContent('meta[property="og:description"]', description, targetDocument);
    setDocumentMetaContent('meta[name="twitter:description"]', description, targetDocument);
  }

  if (typeof url === "string") {
    setDocumentMetaContent('meta[property="og:url"]', url, targetDocument);
  }
};
