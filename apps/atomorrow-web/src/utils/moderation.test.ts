import { describe, expect, it } from "vitest";
import { isConfessionSubmittable, moderateConfession, sanitizePersonalInfo } from "./moderation";

describe("moderation utilities", () => {
  it("removes obvious personal info", () => {
    const result = sanitizePersonalInfo("Reach me at alex@example.com, @alex, or 555-123-4567.");
    expect(result).toContain("[email removed]");
    expect(result).toContain("[handle removed]");
    expect(result).toContain("[phone removed]");
  });

  it("detects crisis language and blocks entertainment submission", () => {
    const result = moderateConfession("I want to die tonight and I do not know what to do.");
    expect(result.status).toBe("crisis");
    expect(isConfessionSubmittable("I want to die tonight and I do not know what to do.", result)).toBe(false);
  });

  it("allows long clear confessions", () => {
    const text = "I rode the last train twice because the motion made the night feel less sharp.";
    const result = moderateConfession(text);
    expect(result.status).toBe("clear");
    expect(isConfessionSubmittable(text, result)).toBe(true);
  });
});
