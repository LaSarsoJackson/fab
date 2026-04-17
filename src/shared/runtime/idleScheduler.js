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
    return {
      type: "idle",
      id: window.requestIdleCallback(() => {
        callback();
      }, { timeout }),
    };
  }

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
