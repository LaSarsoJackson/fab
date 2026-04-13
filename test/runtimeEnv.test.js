import { describe, expect, test } from "bun:test";
import { getRuntimeEnv } from "../src/lib/runtimeEnv";

describe("getRuntimeEnv", () => {
  test("defaults to development when the environment flag is absent", () => {
    expect(getRuntimeEnv({})).toEqual({
      appEnvironment: "development",
      isDev: true,
    });
  });

  test("stays in development when explicitly requested", () => {
    expect(getRuntimeEnv({
      REACT_APP_ENVIRONMENT: "development",
    })).toEqual({
      appEnvironment: "development",
      isDev: true,
    });
  });

  test("switches to production when explicitly requested", () => {
    expect(getRuntimeEnv({
      REACT_APP_ENVIRONMENT: "production",
    })).toEqual({
      appEnvironment: "production",
      isDev: false,
    });
  });
});
