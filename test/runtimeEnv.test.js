import { describe, expect, test } from "bun:test";

import {
  getRuntimeEnv,
  isFieldPacketsEnabled,
} from "../src/shared/runtime/runtimeEnv";

describe("getRuntimeEnv", () => {
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
