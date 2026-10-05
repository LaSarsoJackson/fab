import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source = readFileSync(new URL("../public/service-worker.js", import.meta.url), "utf8");
function harness() {
  const handlers = {}; const deleted = []; const stored = [];
  const cache = { keys: async () => stored.map(([url]) => url), add: async () => {}, put: async (key, response) => stored.push([String(key), response]), match: async () => null, delete: async () => true };
  runInNewContext(source, { URL, Response, Request, self: { location: { origin: "https://example.test" }, registration: { scope: "https://example.test/fab/" }, clients: { claim: async () => {} }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {} }, caches: { keys: async () => ["fab-v6", "other-app-v1", "fab-v8"], delete: async (key) => deleted.push(key), open: async () => cache, match: async () => null }, fetch: async () => new Response("small asset") });
  return { handlers, deleted, stored };
}
test("activation preserves sibling application caches", async () => {
  const h = harness(); let finished;
  h.handlers.activate({ waitUntil: (p) => { finished = p; } }); await finished;
  expect(h.deleted).toEqual(["fab-v6"]);
});
test("query variants and sibling paths never create persistent cache keys", async () => {
  const h = harness(); let response;
  for (const url of ["https://example.test/fab/assets/app-abcdefgh.js?x=1", "https://example.test/other/app.js", "https://example.test/fab/support.html?x=1"]) {
    h.handlers.fetch({ request: new Request(url), respondWith: (p) => { response = p; }, waitUntil: () => {} });
    if (response) await response;
  }
  expect(h.stored).toEqual([]);
});
