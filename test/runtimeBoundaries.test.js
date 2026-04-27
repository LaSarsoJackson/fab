import { describe, expect, test } from "bun:test";

import {
  isFieldPacketsEnabled,
  RUNTIME_FEATURE_FLAGS,
} from "../src/shared/runtime/runtimeEnv";

describe("runtime boundaries", () => {
  test("keeps master runtime flags limited to shipped product features", () => {
    expect(Object.keys(RUNTIME_FEATURE_FLAGS)).toEqual(["fieldPackets"]);
    expect(RUNTIME_FEATURE_FLAGS.fieldPackets).toMatchObject({
      id: "fieldPackets",
      envKey: "REACT_APP_ENABLE_FIELD_PACKETS",
    });
  });

  test("exposes feature selectors with stable fallbacks", () => {
    expect(isFieldPacketsEnabled()).toBe(true);
    expect(isFieldPacketsEnabled({ fieldPackets: false })).toBe(false);
  });
});
