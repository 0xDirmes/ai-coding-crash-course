import { Link } from "react-router";
import type { Route } from "./+types/instructor";
import { getCoursesByInstructor, getLessonCountForCourse } from "~/services/courseService";
import { requireInstructorOrAdmin } from "~/lib/access.server";
import { getUserById, getUsersByRole } from "~/services/userService";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle, BookOpen, GraduationCap, Plus } from "lucide-react";
import { CourseImage } from "~/components/course-image";
import { data, isRouteErrorResponse } from "react-router";
import { CourseStatus, UserRole } from "~/db/schema";
import { getInstructorAnalytics } from "~/services/analyticsService";
import { parseAnalyticsRange } from "~/lib/analytics-range";
import { AnalyticsSummary } from "~/components/instructor-analytics/analytics-summary";
import { CourseAnalyticsStats } from "~/components/instructor-analytics/course-analytics-stats";
import { RangeSelector } from "~/components/instructor-analytics/range-selector";
import { InstructorPicker } from "~/components/instructor-analytics/instructor-picker";
import { resolveDashboardView } from "~/lib/instructor-dashboard";

export function meta() {
  return [
    { title: "My Courses — Cadence" },
    { name: "description", content: "Manage your courses" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireInstructorOrAdmin(request);
  const searchParams = new URL(request.url).searchParams;

  // Keep the instructor resolveDashboardView looks up so we don't fetch it twice.
  let chosenInstructor: ReturnType<typeof getUserById>;
  const view = resolveDashboardView(user, searchParams.get("instructorId"), (id) => {
    chosenInstructor = getUserById(id);
    return chosenInstructor;
  });

  if (view.mode === "forbidden") {
    throw data("Only instructors can access this page.", {
      status: 403,
    });
  }

  if (view.mode === "not-found") {
    throw data("Instructor not found.", { status: 404 });
  }

  const range = parseAnalyticsRange(searchParams.get("range"));

  if (view.mode === "picker") {
    const instructors = getUsersByRole(UserRole.Instructor).map(
      (instructor) => ({ id: instructor.id, name: instructor.name })
    );
    return { mode: view.mode, instructors, range } as const;
  }

  const { instructorId } = view;
  const analytics = getInstructorAnalytics(instructorId, range, new Date());
  const statsByCourse = new Map(analytics.courses.map((c) => [c.courseId, c]));

  const instructorCourses = getCoursesByInstructor(instructorId);

  const coursesWithStats = instructorCourses.map((course) => {
    const lessonCount = getLessonCountForCourse(course.id);

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      status: course.status,
      coverImageUrl: course.coverImageUrl,
      lessonCount,
      // Drafts are excluded from analytics, so they have no stats.
      analytics: statsByCourse.get(course.id) ?? null,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  });

  return {
    mode: view.mode,
    // Admins get a read-only view of someone else's dashboard.
    readOnly: view.mode === "admin",
    instructorName: (view.mode === "own" ? user : chosenInstructor)?.name ?? "",
    courses: coursesWithStats,
    totals: analytics.totals,
    range,
  } as const;
}

function statusBadge(status: string) {
  switch (status) {
    case CourseStatus.Published:
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Published
        </span>
      );
    case CourseStatus.Draft:
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          Draft
        </span>
      );
    case CourseStatus.Archived:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
          Archived
        </span>
      );
    default:
      return null;
  }
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="flex flex-col">
            <Skeleton className="aspect-video rounded-b-none rounded-t-lg" />
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function InstructorDashboard({
  loaderData,
}: Route.ComponentProps) {
  if (loaderData.mode === "picker") {
    return (
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Instructor Dashboards</span>
        </nav>
        <h1 className="text-3xl font-bold">Instructor Dashboards</h1>
        <p className="mb-6 mt-1 text-muted-foreground">
          Choose an instructor to view their dashboard (read-only).
        </p>
        <InstructorPicker instructors={loaderData.instructors} />
      </div>
    );
  }

  const { courses, totals, range, readOnly, instructorName } = loaderData;
  const pageTitle = readOnly ? `${instructorName}'s Courses` : "My Courses";

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        {readOnly && (
          <>
            <Link to="/instructor" className="hover:text-foreground">
              Instructor Dashboards
            </Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-foreground">{pageTitle}</span>
      </nav>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          <p className="mt-1 text-muted-foreground">
            {readOnly
              ? "Read-only view of this instructor's dashboard"
              : "Manage your courses and track enrollments"}
          </p>
        </div>
        {!readOnly && (
          <Link to="/instructor/new">
            <Button>
              <Plus className="mr-2 size-4" />
              New Course
            </Button>
          </Link>
        )}
      </div>

      <section className="mb-8" aria-label="Analytics">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Analytics</h2>
          <RangeSelector range={range} />
        </div>
        <AnalyticsSummary totals={totals} />
      </section>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GraduationCap className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">No courses yet</h2>
          {!readOnly && (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first course to get started.
              </p>
              <Link to="/instructor/new" className="mt-4">
                <Button>
                  <Plus className="mr-2 size-4" />
                  Create Course
                </Button>
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col overflow-hidden pt-0">
              <Link to={`/courses/${course.slug}`} className="aspect-video overflow-hidden">
                <CourseImage
                  src={course.coverImageUrl}
                  alt={course.title}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
              </Link>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/courses/${course.slug}`}
                    className="text-lg font-semibold leading-tight hover:text-primary"
                  >
                    {course.title}
                  </Link>
                  {statusBadge(course.status)}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {course.description}
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="size-4" />
                    <span>
                      {course.lessonCount}{" "}
                      {course.lessonCount === 1 ? "lesson" : "lessons"}
                    </span>
                  </div>
                </div>
                {course.analytics && (
                  <CourseAnalyticsStats stats={course.analytics} />
                )}
              </CardContent>
              {!readOnly && (
                <CardFooter>
                  <Link to={`/instructor/${course.id}`} className="w-full">
                    <Button className="w-full" variant="outline">
                      <BookOpen className="mr-2 size-4" />
                      Edit Course
                    </Button>
                  </Link>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading your courses.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message = typeof error.data === "string" ? error.data : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message = typeof error.data === "string" ? error.data : "You don't have permission to access this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/courses">
            <Button variant="outline">Browse Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
