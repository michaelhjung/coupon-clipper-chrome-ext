import { describe, expect, it } from "vitest";

import { isSuccess, parseJson, readJson, readText } from "../src/shared/http";

const response = (body: string) => new Response(body, { status: 200 });

describe("response readers", () => {
  it("read a JSON body and resolve null when it is not JSON", async () => {
    expect(await readJson(response('{"a":1}'))).toEqual({ a: 1 });
    expect(await readJson(response("<html>"))).toBeNull();
  });

  it("read a text body and resolve empty when the body cannot be read", async () => {
    expect(await readText(response("true"))).toBe("true");
    const unreadable = { text: async () => Promise.reject(new Error("gone")) } as unknown as Response;
    expect(await readText(unreadable)).toBe("");
  });

  it("parse JSON text without throwing", () => {
    expect(parseJson("[1]")).toEqual([1]);
    expect(parseJson("")).toBeNull();
    expect(parseJson("nope")).toBeNull();
  });

  it("treats every 2xx as success", () => {
    expect(isSuccess(200)).toBe(true);
    expect(isSuccess(204)).toBe(true);
    expect(isSuccess(301)).toBe(false);
    expect(isSuccess(429)).toBe(false);
  });
});
