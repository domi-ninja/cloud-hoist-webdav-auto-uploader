import { describe, expect, it } from "@jest/globals";

import { formatBytes, formatRelativeTime } from "./format";

const now = Date.parse("2026-09-04T18:00:00.000Z");

describe("formatRelativeTime", () => {
  it.each([
    ["2026-09-04T17:59:31.000Z", "just now"],
    ["2026-09-04T18:00:01.000Z", "just now"],
    ["2026-09-04T17:58:00.000Z", "2 minutes ago"],
    ["2026-09-04T15:00:00.000Z", "3 hours ago"],
    ["2026-09-02T18:00:00.000Z", "2 days ago"],
    ["2026-08-07T18:00:00.000Z", "4 weeks ago"],
    ["2025-09-04T18:00:00.000Z", "1 year ago"],
    ["2026-09-04T18:03:00.000Z", "in 3 minutes"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatRelativeTime(value, now)).toBe(expected);
  });

  it("handles an invalid timestamp", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("unknown time");
  });
});

describe("formatBytes", () => {
  it.each([
    [999, "999 B"],
    [12_342, "12.3 kB"],
    [25_165_878, "25.2 MB"],
    [2_500_000_000, "2.5 GB"],
  ])("formats %d bytes as %s", (value, expected) => {
    expect(formatBytes(value)).toBe(expected);
  });
});
