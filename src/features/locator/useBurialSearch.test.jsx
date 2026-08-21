import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useBurialSearch from "./useBurialSearch";

class FakeWorker {
  static instances = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message) {
    this.message = message;
  }

  terminate() {}
}

describe("useBurialSearch", () => {
  afterEach(() => {
    FakeWorker.instances = [];
    vi.unstubAllGlobals();
  });

  it("does not restore stale results after a query is cleared", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const { result } = renderHook(() => useBurialSearch());

    let request;
    act(() => {
      request = result.current.runSearch({ query: "old query" });
    });
    const worker = FakeWorker.instances[0];
    act(() => result.current.clear());
    act(() => worker.onmessage({
      data: { requestId: worker.message.requestId, rows: [], total: 0 },
    }));

    await expect(request).resolves.toEqual([]);
    expect(result.current.status).toBe("idle");
    expect(result.current.results).toEqual([]);
  });
});
