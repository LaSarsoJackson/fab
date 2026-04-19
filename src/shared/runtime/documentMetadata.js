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
