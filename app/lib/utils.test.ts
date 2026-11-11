import { describe, it, expect } from "vitest";
import { formatMoney, formatPrice } from "./utils";

describe("formatPrice", () => {
  it("renders a list price in dollars", () => {
    expect(formatPrice(4999)).toBe("$49.99");
  });

  it("renders zero or missing prices as Free", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(null)).toBe("Free");
    expect(formatPrice(undefined)).toBe("Free");
  });
});

describe("formatMoney", () => {
  it("renders an amount in dollars", () => {
    expect(formatMoney(123456)).toBe("$1234.56");
  });

  it("renders zero as $0.00", () => {
    expect(formatMoney(0)).toBe("$0.00");
  });
});
