import { CourseMemberRole } from './entities/enrollment.entity';

export enum CoursePermission {
  ReadCourseContent = 'course.content.read',
  ManageCourseContent = 'course.content.manage',
  ManageCourse = 'course.manage',
  ManageMembers = 'course.members.manage',
  ReadOwnResults = 'course.results.own.read',
  ReadAllResults = 'course.results.all.read',
}

const teacherPermissions = [
  CoursePermission.ReadCourseContent,
  CoursePermission.ManageCourseContent,
  CoursePermission.ManageCourse,
  CoursePermission.ManageMembers,
  CoursePermission.ReadOwnResults,
  CoursePermission.ReadAllResults,
];

const tutorPermissions = [
  CoursePermission.ReadCourseContent,
  CoursePermission.ManageCourseContent,
  CoursePermission.ManageMembers,
  CoursePermission.ReadOwnResults,
  CoursePermission.ReadAllResults,
];

const studentPermissions = [
  CoursePermission.ReadCourseContent,
  CoursePermission.ReadOwnResults,
];

export const COURSE_ROLE_PERMISSIONS: Record<CourseMemberRole, CoursePermission[]> = {
  [CourseMemberRole.TEACHER]: teacherPermissions,
  [CourseMemberRole.TUTOR]: tutorPermissions,
  [CourseMemberRole.STUDENT]: studentPermissions,
};

export const normalizeCourseRole = (role: string): CourseMemberRole => {
  const normalizedRole = String(role).toUpperCase();

  if (normalizedRole === 'OWNER') {
    return CourseMemberRole.TEACHER;
  }

  if (Object.values(CourseMemberRole).includes(normalizedRole as CourseMemberRole)) {
    return normalizedRole as CourseMemberRole;
  }

  throw new Error('Invalid course role');
};

export const hasCoursePermission = (
  role: CourseMemberRole | null | undefined,
  permission: CoursePermission,
): boolean => {
  if (!role) {
    return false;
  }

  return COURSE_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};

export const buildCoursePermissions = (
  role: CourseMemberRole | null,
): Record<CoursePermission, boolean> =>
  Object.values(CoursePermission).reduce(
    (permissions, permission) => ({
      ...permissions,
      [permission]: hasCoursePermission(role, permission),
    }),
    {} as Record<CoursePermission, boolean>,
  );
