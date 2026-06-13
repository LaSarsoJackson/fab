import { describe, expect, test } from "bun:test";

import {
  buildPublicAssetUrl,
  cancelIdleTask,
  getRuntimeEnv,
  isFieldPacketsEnabled,
  RUNTIME_FEATURE_FLAGS,
  scheduleIdleTask,
  setDocumentMetaContent,
  syncDocumentMetadata,
} from "../src/shared/runtimeEnv";

const createMetaNode = () => {
  const attributes = new Map();

  return {
    getAttribute: (name) => attributes.get(name),
    setAttribute: (name, value) => {
      attributes.set(name, value);
    },
  };
};

const createMetadataDocument = (selectors = []) => {
  const nodesBySelector = new Map(
    selectors.map((selector) => [selector, createMetaNode()])
  );

  return {
    title: "",
    getContent: (selector) => nodesBySelector.get(selector)?.getAttribute("content"),
    querySelector: (selector) => nodesBySelector.get(selector) || null,
  };
};

describe("getRuntimeEnv", () => {
  test("keeps runtime flags limited to shipped product features", () => {
    expect(Object.keys(RUNTIME_FEATURE_FLAGS)).toEqual(["fieldPackets"]);
    expect(RUNTIME_FEATURE_FLAGS.fieldPackets).toMatchObject({
      id: "fieldPackets",
      envKey: "REACT_APP_ENABLE_FIELD_PACKETS",
    });
  });

  test("defaults to development with shipped feature flags", () => {
    expect(getRuntimeEnv({})).toEqual({
      appEnvironment: "development",
      featureFlags: {
        fieldPackets: true,
      },
    });
  });

  test("treats the React production build as production", () => {
    expect(getRuntimeEnv({
      NODE_ENV: "production",
    })).toEqual({
      appEnvironment: "production",
      featureFlags: {
        fieldPackets: true,
      },
    });
  });

  test("does not let the app flag downgrade a production build", () => {
    expect(getRuntimeEnv({
      NODE_ENV: "production",
      REACT_APP_ENVIRONMENT: "development",
    })).toEqual({
      appEnvironment: "production",
      featureFlags: {
        fieldPackets: true,
      },
    });
  });

  test("allows the field packet flag to be disabled", () => {
    expect(getRuntimeEnv({
      REACT_APP_ENABLE_FIELD_PACKETS: "false",
    })).toEqual({
      appEnvironment: "development",
      featureFlags: {
        fieldPackets: false,
      },
    });
  });

  test("normalizes missing field-packet flag values", () => {
    expect(isFieldPacketsEnabled({})).toBe(true);
    expect(isFieldPacketsEnabled({ fieldPackets: false })).toBe(false);
  });
});

describe("buildPublicAssetUrl", () => {
  test("prefixes the deploy base path and normalizes the leading slash", () => {
    expect(buildPublicAssetUrl("data/Search_Burials.json", "/fab")).toBe(
      "/fab/data/Search_Burials.json"
    );
    expect(buildPublicAssetUrl("/data/Search_Burials.json", "/fab")).toBe(
      "/fab/data/Search_Burials.json"
    );
  });

  test("serves from origin root when no public url is configured", () => {
    expect(buildPublicAssetUrl("basemaps/overview.jpg", "")).toBe("/basemaps/overview.jpg");
    expect(buildPublicAssetUrl(null, "")).toBe("/");
  });
});

describe("scheduleIdleTask / cancelIdleTask", () => {
  test("returns null when no callback is provided", () => {
    expect(scheduleIdleTask(null)).toBeNull();
    expect(scheduleIdleTask("not a function")).toBeNull();
  });

  test("falls back to a timeout when requestIdleCallback is unavailable", async () => {
    let invoked = false;
    const handle = scheduleIdleTask(() => {
      invoked = true;
    }, { fallbackDelay: 1 });

    expect(handle).toMatchObject({ type: "timeout" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(invoked).toBe(true);
  });

  test("cancelIdleTask clears a pending timeout before it fires", async () => {
    let invoked = false;
    const handle = scheduleIdleTask(() => {
      invoked = true;
    }, { fallbackDelay: 20 });

    cancelIdleTask(handle);
    cancelIdleTask(null);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(invoked).toBe(false);
  });

  test("prefers requestIdleCallback when the runtime exposes it", () => {
    const originalWindow = globalThis.window;
    let scheduledCallback = null;
    let cancelledId = null;

    globalThis.window = {
      requestIdleCallback: (callback) => {
        scheduledCallback = callback;
        return 42;
      },
      cancelIdleCallback: (id) => {
        cancelledId = id;
      },
    };

    try {
      let invoked = false;
      const handle = scheduleIdleTask(() => {
        invoked = true;
      });

      expect(handle).toEqual({ type: "idle", id: 42 });
      scheduledCallback();
      expect(invoked).toBe(true);

      cancelIdleTask(handle);
      expect(cancelledId).toBe(42);
    } finally {
      if (originalWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = originalWindow;
      }
    }
  });
});

describe("setDocumentMetaContent", () => {
  test("does nothing when no document is available", () => {
    expect(() => setDocumentMetaContent('meta[name="description"]', "x")).not.toThrow();
  });

  test("updates a matching meta element's content attribute", () => {
    const node = createMetaNode();
    const metadataDocument = {
      querySelector: (selector) => (selector === 'meta[name="description"]' ? node : null),
    };

    setDocumentMetaContent('meta[name="description"]', "Hello", metadataDocument);
    expect(node.getAttribute("content")).toBe("Hello");

    expect(() => (
      setDocumentMetaContent('meta[name="missing"]', "ignored", metadataDocument)
    )).not.toThrow();
  });
});

describe("syncDocumentMetadata", () => {
  test("updates document and social metadata tags together", () => {
    const metadataDocument = createMetadataDocument([
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:url"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
    ]);

    syncDocumentMetadata({
      title: "Packet Title",
      description: "Packet description",
      url: "https://example.com/#/packet",
    }, metadataDocument);

    expect(metadataDocument.title).toBe("Packet Title");
    expect(metadataDocument.getContent('meta[name="description"]')).toBe("Packet description");
    expect(metadataDocument.getContent('meta[property="og:title"]')).toBe("Packet Title");
    expect(metadataDocument.getContent('meta[property="og:description"]')).toBe("Packet description");
    expect(metadataDocument.getContent('meta[property="og:url"]')).toBe("https://example.com/#/packet");
    expect(metadataDocument.getContent('meta[name="twitter:title"]')).toBe("Packet Title");
    expect(metadataDocument.getContent('meta[name="twitter:description"]')).toBe("Packet description");
  });

  test("leaves missing metadata tags alone instead of throwing", () => {
    const metadataDocument = createMetadataDocument();

    expect(() => {
      syncDocumentMetadata({
        title: "Fallback Title",
        description: "Fallback description",
        url: "https://example.com",
      }, metadataDocument);
    }).not.toThrow();

    expect(metadataDocument.title).toBe("Fallback Title");
  });
});
