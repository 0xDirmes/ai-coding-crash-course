import { UserRole } from "~/db/schema";

// ─── Instructor Dashboard Access ───
// Decides whose dashboard the instructor page shows. Pure (the user lookup is
// injected) so the route keeps HTTP concerns and this stays unit-testable.

export type DashboardView =
  /** An instructor viewing their own dashboard. */
  | { mode: "own"; instructorId: number }
  /** An admin viewing an instructor's dashboard, read-only. */
  | { mode: "admin"; instructorId: number }
  /** An admin who hasn't chosen an instructor yet. */
  | { mode: "picker" }
  /** An admin asked for an id that isn't an instructor. */
  | { mode: "not-found" }
  | { mode: "forbidden" };

/**
 * Instructors always see their own data — `instructorIdParam` is ignored for
 * them. Admins see the instructor named by `instructorIdParam`, or a picker
 * when it's absent. Everyone else is forbidden.
 */
export function resolveDashboardView(
  viewer: { id: number; role: UserRole },
  instructorIdParam: string | null,
  findUser: (id: number) => { role: UserRole } | undefined
): DashboardView {
  if (viewer.role === UserRole.Instructor) {
    return { mode: "own", instructorId: viewer.id };
  }
  if (viewer.role !== UserRole.Admin) {
    return { mode: "forbidden" };
  }
  if (!instructorIdParam) {
    return { mode: "picker" };
  }

  const instructorId = Number(instructorIdParam);
  if (!Number.isInteger(instructorId)) {
    return { mode: "not-found" };
  }
  if (findUser(instructorId)?.role !== UserRole.Instructor) {
    return { mode: "not-found" };
  }
  return { mode: "admin", instructorId };
}
