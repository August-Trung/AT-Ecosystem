import { describe, expect, it } from "vitest";
import { formatDuration, slugToTitle } from "./format";

describe("format utilities", () => {
  it("formats audio durations", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(187)).toBe("3:07");
  });

  it("turns slugs into readable titles", () => {
    expect(slugToTitle("rain-city")).toBe("Rain City");
  });
});
