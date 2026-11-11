import { describe, it, expect } from "vitest";
import { UserRole } from "~/db/schema";
import { resolveDashboardView } from "./instructor-dashboard";

const users: Record<number, { role: UserRole }> = {
  1: { role: UserRole.Student },
  2: { role: UserRole.Instructor },
  3: { role: UserRole.Instructor },
  4: { role: UserRole.Admin },
};
const findUser = (id: number) => users[id];

describe("resolveDashboardView", () => {
  it("shows an instructor their own dashboard", () => {
    expect(resolveDashboardView({ id: 2, role: UserRole.Instructor }, null, findUser)).toEqual({
      mode: "own",
      instructorId: 2,
    });
  });

  it("ignores another instructor's instructorId from an instructor", () => {
    expect(resolveDashboardView({ id: 2, role: UserRole.Instructor }, "3", findUser)).toEqual({
      mode: "own",
      instructorId: 2,
    });
  });

  it("forbids students, even with an instructorId", () => {
    expect(resolveDashboardView({ id: 1, role: UserRole.Student }, null, findUser)).toEqual({
      mode: "forbidden",
    });
    expect(resolveDashboardView({ id: 1, role: UserRole.Student }, "2", findUser)).toEqual({
      mode: "forbidden",
    });
  });

  it("shows an admin the picker when no instructorId is given", () => {
    expect(resolveDashboardView({ id: 4, role: UserRole.Admin }, null, findUser)).toEqual({
      mode: "picker",
    });
    expect(resolveDashboardView({ id: 4, role: UserRole.Admin }, "", findUser)).toEqual({
      mode: "picker",
    });
  });

  it("shows an admin the chosen instructor's dashboard read-only", () => {
    expect(resolveDashboardView({ id: 4, role: UserRole.Admin }, "3", findUser)).toEqual({
      mode: "admin",
      instructorId: 3,
    });
  });

  it.each([
    ["an unknown user", "99"],
    ["a student", "1"],
    ["an admin", "4"],
    ["a malformed id", "abc"],
    ["a fractional id", "2.5"],
  ])("reports not-found when an admin asks for %s", (_label, param) => {
    expect(resolveDashboardView({ id: 4, role: UserRole.Admin }, param, findUser)).toEqual({
      mode: "not-found",
    });
  });
});
