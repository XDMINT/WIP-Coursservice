import { Course, CourseStatus } from '../entities/course.entity';
import { Enrollment, CourseMemberRole } from '../entities/enrollment.entity';
import { CoursePermission, buildCoursePermissions } from '../courses.permissions';

export type CourseResponseDto = {
  id: string;
  external_id: string;
  externalId: string;
  title: string;
  description?: string;
  semester?: string;
  status: CourseStatus;
  location?: string;
  key_password?: string;
  keyPassword?: string;
  requiresEnrollmentKey: boolean;
  owner_id?: number;
  ownerId?: number;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

export type EnrollmentResponseDto = {
  id: string;
  courseId: string;
  userId: string;
  role: CourseMemberRole;
  enrolledAt?: string;
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type CourseMembershipDto = {
  userId: string;
  role: CourseMemberRole;
};

export type CourseContextResponseDto = {
  course: CourseResponseDto;
  membership: CourseMembershipDto;
  permissions: Record<CoursePermission, boolean>;
};

const toIsoString = (value?: Date): string | undefined =>
  value instanceof Date ? value.toISOString() : undefined;

export const mapCourseToDto = (course: Course): CourseResponseDto => ({
  id: course.id,
  external_id: course.external_id,
  externalId: course.external_id,
  title: course.title,
  description: course.description,
  semester: course.semester,
  status: course.status,
  location: course.location,
  key_password: course.key_password,
  keyPassword: course.key_password,
  requiresEnrollmentKey: Boolean(course.key_password),
  owner_id: course.owner_id,
  ownerId: course.owner_id,
  created_at: toIsoString(course.created_at),
  createdAt: toIsoString(course.created_at),
  updated_at: toIsoString(course.updated_at),
  updatedAt: toIsoString(course.updated_at),
});

export const mapEnrollmentToDto = (
  enrollment: Enrollment,
): EnrollmentResponseDto => ({
  id: enrollment.id,
  courseId: enrollment.courseId,
  userId: enrollment.userId,
  role: enrollment.role,
  enrolledAt: toIsoString(enrollment.enrolledAt),
  createdBy: enrollment.createdBy,
  updatedBy: enrollment.updatedBy,
  updatedAt: toIsoString(enrollment.updatedAt),
});

export const mapCourseContextToDto = (
  course: Course,
  userId: string,
  role: CourseMemberRole,
): CourseContextResponseDto => ({
  course: mapCourseToDto(course),
  membership: {
    userId,
    role,
  },
  permissions: buildCoursePermissions(role),
});
