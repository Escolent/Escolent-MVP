import { AUTH_ERROR_CODES, AuthError } from "@/lib/api/errors";

const CLASSROOM_API_BASE = "https://classroom.googleapis.com/v1";

export type FetchLike = typeof fetch;

/**
 * Determines whether `userId` (Google's numeric/opaque user id, i.e. the
 * ID token's `sub`) is a teacher or student of `courseId`, via Classroom
 * API point-lookups (courses.teachers.get / courses.students.get) rather
 * than listing the whole roster. `fetchImpl` is injectable so tests don't
 * need a real Google API call.
 */
export async function fetchCourseRole(
  accessToken: string,
  courseId: string,
  userId: string,
  fetchImpl: FetchLike = fetch,
): Promise<"teacher" | "student" | null> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const teacherCheck = await fetchImpl(
    `${CLASSROOM_API_BASE}/courses/${encodeURIComponent(courseId)}/teachers/${encodeURIComponent(userId)}`,
    { headers },
  );
  if (teacherCheck.ok) return "teacher";
  if (teacherCheck.status !== 404) throw classroomApiError(teacherCheck.status);

  const studentCheck = await fetchImpl(
    `${CLASSROOM_API_BASE}/courses/${encodeURIComponent(courseId)}/students/${encodeURIComponent(userId)}`,
    { headers },
  );
  if (studentCheck.ok) return "student";
  if (studentCheck.status !== 404) throw classroomApiError(studentCheck.status);

  return null;
}

function classroomApiError(status: number): AuthError {
  return new AuthError(
    AUTH_ERROR_CODES.INVALID_GOOGLE_TOKEN,
    "Could not verify your Google Classroom course membership.",
    401,
    { classroomApiStatus: status },
  );
}
