import { describe, it, expect } from "vitest";
import { formatCompletionRate, formatRating } from "./analytics-format";

describe("formatCompletionRate", () => {
  it("renders a whole percent", () => {
    expect(formatCompletionRate(0.666)).toBe("67%");
    expect(formatCompletionRate(0)).toBe("0%");
  });

  it("renders an em dash when there are no enrollments", () => {
    expect(formatCompletionRate(null)).toBe("—");
  });
});

describe("formatRating", () => {
  it("renders the average to one decimal with the count", () => {
    expect(formatRating(4.56, 128)).toBe("4.6 ★ (128)");
  });

  it("renders a placeholder when there are no ratings", () => {
    expect(formatRating(null, 0)).toBe("No ratings yet");
  });
});
