const triggerDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

export const downloadJsonFile = (fileName, value) => {
  triggerDownload(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    fileName
  );
};

export const downloadArrayBuffer = (fileName, buffer, mimeType) => {
  triggerDownload(
    new Blob([buffer], { type: mimeType }),
    fileName
  );
};

export const downloadTextFile = (fileName, value, mimeType = "text/plain;charset=utf-8") => {
  triggerDownload(
    new Blob([value], { type: mimeType }),
    fileName
  );
};
