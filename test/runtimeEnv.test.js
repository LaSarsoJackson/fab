import { describe, expect, test } from "bun:test";

import {
  getRuntimeEnv,
  isFieldPacketsEnabled,
  RUNTIME_FEATURE_FLAGS,
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
