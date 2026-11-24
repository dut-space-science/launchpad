import { describe, expect, it } from "vite-plus/test";
import { LOCALE, fmtDate, mondayIndex } from "./format";

describe("dates", () => {
  it("weeks start on Monday", () => {
    expect(mondayIndex(new Date(2026, 10, 23))).toBe(0); // Monday
    expect(mondayIndex(new Date(2026, 10, 24))).toBe(1); // Tuesday
    expect(mondayIndex(new Date(2026, 10, 22))).toBe(6); // Sunday, the last day of the week
  });

  it("uses South African English, day first", () => {
    expect(LOCALE).toBe("en-ZA");
    expect(fmtDate(new Date(2026, 10, 21))).toBe("21 Nov 2026");
    expect(
      fmtDate(new Date(2026, 10, 24), { weekday: "short", day: "numeric", month: "short" }),
    ).toMatch(/^Tue,? 24 Nov$/);
  });
});
