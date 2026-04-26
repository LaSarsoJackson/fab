/** @jest-environment jsdom */

import registerServiceWorker from "./registerServiceWorker";

describe("registerServiceWorker", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPublicUrl = process.env.PUBLIC_URL;
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.PUBLIC_URL = "/fab";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.PUBLIC_URL = originalPublicUrl;

    if (originalServiceWorker === undefined) {
      delete navigator.serviceWorker;
    } else {
      navigator.serviceWorker = originalServiceWorker;
    }
  });

  test("does not register outside production", () => {
    const register = jest.fn().mockResolvedValue(undefined);
    navigator.serviceWorker = { register };

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));

    expect(register).not.toHaveBeenCalled();
  });

  test("registers the public service worker path in production", async () => {
    process.env.NODE_ENV = "production";
    const register = jest.fn().mockResolvedValue(undefined);
    navigator.serviceWorker = { register };

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));

    expect(register).toHaveBeenCalledWith("/fab/service-worker.js");
  });
});
