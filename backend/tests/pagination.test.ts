import { describe, expect, it } from "vitest";
import {
  pageQuery,
  encodeTimeCursor,
  decodeTimeCursor,
} from "../src/domain/pagination";
describe("public pagination boundaries", () => {
  it("validates typed pages and bounded searches without silently accepting invalid pagination", () => {
    expect(pageQuery({ page: "2", limit: "12", query: " Story " })).toEqual({
      page: 2,
      limit: 12,
      query: "Story",
    });
    for (const body of [
      { page: "1e2" },
      { page: "1.1" },
      { limit: 51 },
      { query: { value: "bad" } },
    ])
      expect(() => pageQuery(body)).toThrow();
  });
  it("round-trips microsecond cursors and rejects malformed IDs and impossible calendar values", () => {
    const at = "2026-11-05 01:23:45.123456";
    expect(decodeTimeCursor(encodeTimeCursor(at, 7))).toEqual({ at, id: 7 });
    expect(decodeTimeCursor(undefined)).toBeNull();
    for (const cursor of [
      "!",
      encodeTimeCursor("2026-02-30 01:00:00.000000", 1),
      encodeTimeCursor("2026-13-01 00:00:00.000000", 1),
      encodeTimeCursor(at, 0),
      encodeTimeCursor(at, 1.5),
    ])
      expect(() => decodeTimeCursor(cursor)).toThrow();
  });
});
