import { Course, CourseRunTemplateStrategy, CourseStatus } from '../entities/course.entity';
import { Enrollment, CourseMemberRole } from '../entities/enrollment.entity';
import { CourseRecurrenceType, CourseRun, CourseRunStatus } from '../entities/course-run.entity';
import { CourseVersion, CourseVersionStatus } from '../entities/course-version.entity';
import { CoursePermission, buildCoursePermissions } from '../courses.permissions';

export type CourseResponseDto = {
  id: string;
  external_id: string;
  externalId: string;
  title: string;
  description?: string;
  semester?: string;
  recurrenceType: CourseRecurrenceType;
  recurrence_type: CourseRecurrenceType;
  contentTemplateStrategy?: CourseRunTemplateStrategy;
  plannedSourceVersionId?: string | null;
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
  courseRunId?: string;
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
  currentRun?: CourseRunResponseDto;
  currentVersion?: CourseVersionResponseDto;
  membership: CourseMembershipDto;
  permissions: Record<CoursePermission, boolean>;
};

export type CourseCatalogItemResponseDto = CourseResponseDto & {
  enrolled: boolean;
  membershipRole?: CourseMemberRole;
  canEnroll: boolean;
  currentRun?: CourseRunResponseDto;
};

export type CourseRunResponseDto = {
  id: string;
  courseId: string;
  label: string;
  startDate?: string;
  endDate?: string;
  status: CourseRunStatus;
  sourceRunId?: string | null;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  enrollmentCount?: number;
  materialCount?: number;
  taskCount?: number;
  versionCount?: number;
  resultCount?: number;
  progressCount?: number;
  assignmentCount?: number;
};

export type CourseRunDeletionResponseDto = {
  action: 'DELETED' | 'ARCHIVED';
  reason?: string;
  run?: CourseRunResponseDto;
};

export type CourseRunPlanResponseDto = {
  recurrenceType: CourseRecurrenceType;
  currentRun: CourseRunResponseDto;
  nextRun?: Pick<CourseRunResponseDto, 'label' | 'startDate' | 'endDate'> | null;
  templateStrategy: CourseRunTemplateStrategy;
  templateVersion?: CourseVersionResponseDto | null;
  regularPlanningAvailable: boolean;
};

export type CourseVersionResponseDto = {
  id: string;
  courseId: string;
  courseRunId?: string;
  courseRunLabel?: string;
  version_number: number;
  versionNumber: number;
  label?: string | null;
  content: Record<string, unknown>;
  change_summary?: string;
  changeSummary?: string;
  status: CourseVersionStatus;
  sourceVersionId?: string | null;
  sourceVersionNumber?: number;
  sourceVersionLabel?: string | null;
  sourceRunLabel?: string;
  created_at?: string;
  createdAt?: string;
  created_by: string;
  createdBy: string;
  is_active: boolean;
  isActive: boolean;
};

export type CreateCourseVersionDto = {
  label?: string;
  changeSummary?: string;
  change_summary?: string;
  activate?: boolean;
  sourceVersionId?: string;
  copyMode?: 'ACTIVE' | 'SOURCE' | 'EMPTY';
};

export type CreateCourseRunDto = {
  label?: string;
  startDate?: string;
  endDate?: string;
  status?: CourseRunStatus;
  activate?: boolean;
  sourceVersionId?: string;
};

export type UpdateCourseRunPlanTemplateDto = {
  strategy?: CourseRunTemplateStrategy;
  contentTemplateStrategy?: CourseRunTemplateStrategy;
  sourceVersionId?: string | null;
  plannedSourceVersionId?: string | null;
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
  recurrenceType: course.recurrenceType ?? CourseRecurrenceType.CONTINUOUS,
  recurrence_type: course.recurrenceType ?? CourseRecurrenceType.CONTINUOUS,
  contentTemplateStrategy:
    course.contentTemplateStrategy ?? CourseRunTemplateStrategy.ACTIVE_VERSION_OF_CURRENT_RUN,
  plannedSourceVersionId: course.plannedSourceVersionId ?? null,
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

export const mapCourseToCatalogItemDto = (
  course: Course,
  enrollment?: Enrollment | null,
  currentRun?: CourseRun | null,
): CourseCatalogItemResponseDto => ({
  ...mapCourseToDto(course),
  enrolled: Boolean(enrollment),
  membershipRole: enrollment?.role,
  canEnroll: course.status === CourseStatus.PUBLISHED && !enrollment,
  currentRun: currentRun ? mapCourseRunToDto(currentRun) : undefined,
});

export const mapEnrollmentToDto = (
  enrollment: Enrollment,
): EnrollmentResponseDto => ({
  id: enrollment.id,
  courseId: enrollment.courseId,
  courseRunId: enrollment.courseRunId,
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
  currentRun?: CourseRun | null,
  currentVersion?: CourseVersion | null,
): CourseContextResponseDto => ({
  course: mapCourseToDto(course),
  currentRun: currentRun ? mapCourseRunToDto(currentRun) : undefined,
  currentVersion: currentVersion ? mapCourseVersionToDto(currentVersion) : undefined,
  membership: {
    userId,
    role,
  },
  permissions: buildCoursePermissions(role),
});

export const mapCourseRunToDto = (
  run: CourseRun,
  counts: Partial<Pick<CourseRunResponseDto, 'enrollmentCount' | 'materialCount' | 'taskCount' | 'versionCount' | 'resultCount' | 'progressCount' | 'assignmentCount'>> = {},
): CourseRunResponseDto => ({
  id: run.id,
  courseId: run.courseId,
  label: run.label,
  startDate: run.startDate,
  endDate: run.endDate,
  status: run.status,
  sourceRunId: run.sourceRunId,
  isActive: run.isActive,
  createdBy: run.createdBy,
  createdAt: toIsoString(run.createdAt),
  updatedAt: toIsoString(run.updatedAt),
  ...counts,
});

export const mapCourseVersionToDto = (
  version: CourseVersion,
): CourseVersionResponseDto => ({
  id: version.id,
  courseId: version.course_id,
  courseRunId: version.course_run_id,
  courseRunLabel: version.courseRun?.label,
  version_number: version.version_number,
  versionNumber: version.version_number,
  label: version.label,
  content: version.content,
  change_summary: version.change_summary,
  changeSummary: version.change_summary,
  status: version.status ?? CourseVersionStatus.PUBLISHED,
  sourceVersionId: version.sourceVersionId,
  sourceVersionNumber: version.sourceVersion?.version_number,
  sourceVersionLabel: version.sourceVersion?.label ?? version.sourceVersion?.change_summary,
  sourceRunLabel: version.sourceVersion?.courseRun?.label,
  created_at: toIsoString(version.created_at),
  createdAt: toIsoString(version.created_at),
  created_by: version.created_by,
  createdBy: version.created_by,
  is_active: version.is_active,
  isActive: version.is_active,
});
