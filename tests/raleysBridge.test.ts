import { describe, expect, it } from "vitest";

import { isRaleysBridgeReady, nextClipResponse } from "../src/content/raleysBridge";

const post = (data: Record<string, unknown>) =>
  window.dispatchEvent(new MessageEvent("message", { data, source: window }));

describe("raleys bridge", () => {
  it("is ready only when the page script has marked the document", () => {
    delete document.documentElement.dataset.ccRaleysBridge;
    expect(isRaleysBridgeReady()).toBe(false);
    document.documentElement.dataset.ccRaleysBridge = "1";
    expect(isRaleysBridgeReady()).toBe(true);
  });

  it("resolves with the status of the request that starts after the call", async () => {
    const pending = nextClipResponse({ requestTimeoutMs: 500, responseTimeoutMs: 500 });
    post({ source: "coupon-clipper", type: "raleys-clip-request", seq: 7 });
    post({ source: "coupon-clipper", type: "raleys-clip-response", seq: 7, status: 200 });
    expect(await pending).toEqual({ status: 200, body: "" });
  });

  it("ignores responses for other requests and stray messages", async () => {
    const pending = nextClipResponse({ requestTimeoutMs: 500, responseTimeoutMs: 500 });
    post({ source: "coupon-clipper", type: "raleys-clip-response", seq: 3, status: 200 });
    post({ source: "coupon-clipper", type: "raleys-clip-request", seq: 4 });
    post({ source: "other", type: "raleys-clip-response", seq: 4, status: 200 });
    post({ source: "coupon-clipper", type: "raleys-clip-response", seq: 5, status: 200 });
    post({ source: "coupon-clipper", type: "raleys-clip-response", seq: 4, status: 400 });
    expect(await pending).toMatchObject({ status: 400 });
  });

  it("passes the response body along for a rejected clip", async () => {
    const pending = nextClipResponse({ requestTimeoutMs: 500, responseTimeoutMs: 500 });
    post({ source: "coupon-clipper", type: "raleys-clip-request", seq: 9 });
    post({
      source: "coupon-clipper",
      type: "raleys-clip-response",
      seq: 9,
      status: 400,
      body: '{"message":"limit reached"}',
    });
    expect(await pending).toEqual({ status: 400, body: '{"message":"limit reached"}' });
  });

  it("resolves null when no request starts in time", async () => {
    const pending = nextClipResponse({ requestTimeoutMs: 50, responseTimeoutMs: 500 });
    expect(await pending).toBeNull();
  });

  it("resolves null when the response never arrives", async () => {
    const pending = nextClipResponse({ requestTimeoutMs: 500, responseTimeoutMs: 50 });
    post({ source: "coupon-clipper", type: "raleys-clip-request", seq: 1 });
    expect(await pending).toBeNull();
  });
});
