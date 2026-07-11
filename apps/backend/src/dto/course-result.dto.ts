import {
  CoursePassStatus,
  CourseResult,
  CourseResultMode,
  CourseResultSource,
} from '../entities/course-result.entity';
import { Enrollment } from '../entities/enrollment.entity';

export type ManualCourseResultDto = {
  pointsAchieved?: number | null;
  maxPoints?: number | null;
  manualGrade?: string | null;
  passStatus: CoursePassStatus;
  comment?: string | null;
};

export type CourseResultListQueryDto = {
  page?: number | string;
  pageSize?: number | string;
  passStatus?: CoursePassStatus | string;
  source?: CourseResultSource | string;
};

export type CourseResultResponseDto = {
  id?: string;
  courseId: string;
  enrollmentId: string;
  studentId: string;
  assessmentMode?: CourseResultMode;
  pointsAchieved?: number | null;
  maxPoints?: number | null;
  percentage?: number | null;
  manualGrade?: string | null;
  passStatus: CoursePassStatus;
  source?: CourseResultSource;
  comment?: string | null;
  gradedBy?: string | null;
  gradedAt?: string | null;
  updatedAt?: string | null;
  sourceDetails?: Record<string, unknown> | null;
};

export type CourseResultListResponseDto = {
  items: CourseResultResponseDto[];
  page: number;
  pageSize: number;
  total: number;
};

const toIsoString = (value?: Date | null): string | null | undefined =>
  value instanceof Date ? value.toISOString() : value;

const toNumberOrNull = (value?: number | string | null): number | null | undefined => {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
};

export const mapCourseResultToDto = (
  result: CourseResult,
): CourseResultResponseDto => ({
  id: result.id,
  courseId: result.courseId,
  enrollmentId: result.enrollmentId,
  studentId: result.studentId,
  assessmentMode: result.assessmentMode,
  pointsAchieved: toNumberOrNull(result.pointsAchieved),
  maxPoints: toNumberOrNull(result.maxPoints),
  percentage: toNumberOrNull(result.percentage),
  manualGrade: result.manualGrade,
  passStatus: result.passStatus,
  source: result.source,
  comment: result.comment,
  gradedBy: result.gradedBy,
  gradedAt: toIsoString(result.gradedAt),
  updatedAt: toIsoString(result.updatedAt),
  sourceDetails: result.sourceDetails,
});

export const mapMissingCourseResultToDto = (
  courseId: string,
  enrollment: Enrollment,
): CourseResultResponseDto => ({
  courseId,
  enrollmentId: enrollment.id,
  studentId: enrollment.userId,
  passStatus: CoursePassStatus.NOT_ASSESSED,
});
