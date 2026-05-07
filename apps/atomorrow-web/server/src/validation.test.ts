import { describe, expect, it } from "vitest";
import { validateConfessionInput } from "./validation";

describe("backend confession validation", () => {
  it("accepts a valid confession payload", () => {
    const result = validateConfessionInput({
      text: "I stayed awake listening to rain because the city felt kinder that way.",
      mood: "I can't sleep",
      destination: "Keep private",
      station: "rain-city"
    });

    expect(result.ok).toBe(true);
  });

  it("rejects unsupported stations", () => {
    const result = validateConfessionInput({
      text: "I stayed awake listening to rain because the city felt kinder that way.",
      mood: "I can't sleep",
      destination: "Keep private",
      station: "unknown"
    });

    expect(result.ok).toBe(false);
  });
});
