import { describe, it, expect } from "vitest";
import { withSearchParam } from "./search-params";

describe("withSearchParam", () => {
  it("replaces the param and keeps the others", () => {
    const params = new URLSearchParams("instructorId=3&range=7d");
    expect(withSearchParam(params, "range", "90d").toString()).toBe(
      "instructorId=3&range=90d"
    );
  });

  it("adds the param when it is missing", () => {
    const params = new URLSearchParams("range=7d");
    expect(withSearchParam(params, "instructorId", "3").toString()).toBe(
      "range=7d&instructorId=3"
    );
  });

  it("leaves the original params untouched", () => {
    const params = new URLSearchParams("range=7d");
    withSearchParam(params, "range", "30d");
    expect(params.toString()).toBe("range=7d");
  });
});
