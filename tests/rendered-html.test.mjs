import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Pocket Pilots rehearsal hub", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>The Pocket Pilots — Rehearsal HQ<\/title>/i);
  assert.match(html, /Players on deck/);
  assert.match(html, /Songs to bring alive/);
  assert.match(html, /September 1, 2026/);
  assert.match(html, /422 S Western Ave, Los Angeles, CA 90020/);
  assert.match(html, /Fox Chick and a Cool Cat/);
  assert.match(html, /Song for My Father/);
  assert.match(html, /Lift Off/);
  assert.match(html, /Chank/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});
