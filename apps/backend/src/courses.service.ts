/**
 * Courses Service - Business logic layer for course management
 * 
 * This service provides all the business logic for managing courses, learning materials,
 * assignments, grades, tasks, content releases, templates, groups, and calendar events.
 * It acts as the bridge between the controllers and the database repositories.
 * 
 * @module CoursesService
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, ILike, MoreThanOrEqual, Not, IsNull, In } from 'typeorm';
import { Readable } from 'stream';
import {
  LearningMaterial,
  LearningMaterialPublicationStatus,
  LearningMaterialReleaseMode,
  LearningMaterialType,
} from './entities/learning-material.entity';
import { Assignment } from './entities/assignment.entity';
import { Grade } from './entities/grade.entity';
import {
  CoursePassStatus,
  CourseResult,
  CourseResultMode,
  CourseResultSource,
} from './entities/course-result.entity';
import { Enrollment, CourseMemberRole } from './entities/enrollment.entity';
import { Task, TaskUnlockMode } from './entities/task.entity';
import {
  TaskProgress,
  TaskProgressStatus,
  TaskUnlockSource,
} from './entities/task-progress.entity';
import { ContentRelease, ReleaseType } from './entities/content-release.entity';
import { ContentTemplate } from './entities/content-template.entity';
import { Course, CourseRunTemplateStrategy, CourseStatus } from './entities/course.entity';
import {
  CourseRecurrenceType,
  CourseRun,
  CourseRunStatus,
} from './entities/course-run.entity';
import { CourseVersion, CourseVersionStatus } from './entities/course-version.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { CalendarEvent } from './entities/calendar-event.entity';
import {
  ApiForbiddenError,
  ApiNotFoundError,
  ApiUnauthorizedError,
  ApiValidationError,
} from './common/api-errors';
import {
  CourseContextResponseDto,
  CourseCatalogItemResponseDto,
  CourseResponseDto,
  CourseRunDeletionResponseDto,
  CourseRunPlanResponseDto,
  CourseRunResponseDto,
  CourseVersionResponseDto,
  CreateCourseRunDto,
  CreateCourseVersionDto,
  EnrollmentResponseDto,
  UpdateCourseRunPlanTemplateDto,
  mapCourseContextToDto,
  mapCourseToCatalogItemDto,
  mapCourseToDto,
  mapCourseRunToDto,
  mapCourseVersionToDto,
  mapEnrollmentToDto,
} from './dto/course.dto';
import {
  CourseResultListQueryDto,
  CourseResultListResponseDto,
  CourseResultResponseDto,
  ManualCourseResultDto,
  mapCourseResultToDto,
  mapMissingCourseResultToDto,
} from './dto/course-result.dto';
import {
  CoursePermission,
  hasCoursePermission,
  normalizeCourseRole,
} from './courses.permissions';
import {
  CreateExternalLearningMaterialDto,
  LearningMaterialResponseDto,
  UpdateLearningMaterialDto,
  UpdateLearningMaterialSortDto,
  mapLearningMaterialToDto,
} from './dto/learning-material.dto';
import {
  CreateLearningTaskDto,
  LearningPathResponseDto,
  LearningTaskProgressDto,
  LearningTaskResponseDto,
  ManualUnlockLearningTaskDto,
  StudentLearningTaskResponseDto,
  StudentProgressOverviewDto,
  UpdateLearningTaskDto,
  UpdateLearningTaskReleaseConfigDto,
  UpdateLearningTaskSortDto,
  mapLearningTaskToDto,
  mapLearningTaskWithProgressToDto,
  mapTaskProgressToDto,
} from './dto/learning-process.dto';
import {
  COURSE_PASSING_RULE_DESCRIPTION,
  COURSE_PASSING_THRESHOLD_PERCENT,
  calculateCoursePassStatus,
} from './course-result.rules';
import { LocalMaterialStorage } from './storage/material-storage';

export type UploadedLearningMaterialFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

export type LearningMaterialDownload = {
  stream: Readable;
  fileName: string;
  mimeType: string;
  fileSize?: number | string;
};

type LearningMaterialVisibility = {
  visible: boolean;
  locked: boolean;
  lockedReason?: string;
  releaseAfterTaskTitle?: string;
  visibleForStudents: boolean;
};

type CourseVersionSnapshotTask = {
  id?: string;
  title?: string;
  description?: string;
  type?: string;
  order?: number;
  unlockMode?: TaskUnlockMode | string;
  prerequisiteTaskId?: string | null;
  completionCriteria?: unknown;
  isPublished?: boolean;
  demoKey?: string | null;
};

type CourseVersionSnapshotMaterial = {
  id?: string;
  title?: string;
  description?: string;
  content?: string;
  type?: LearningMaterialType | string;
  url?: string;
  originalFileName?: string;
  storageKey?: string;
  mimeType?: string;
  fileSize?: number;
  previewMetadata?: Record<string, unknown>;
  tags?: string[];
  sortOrder?: number;
  publicationStatus?: LearningMaterialPublicationStatus | string;
  isPublished?: boolean;
  releaseMode?: LearningMaterialReleaseMode | string;
  releaseAt?: string | null;
  releaseAfterTaskId?: string | null;
  filePath?: string;
  publishedAt?: string | null;
};

const maxMaterialFileSizeBytes = () =>
  Number(process.env.COURSE_MATERIAL_MAX_FILE_SIZE_BYTES ?? 50 * 1024 * 1024);

export const ALLOWED_MATERIAL_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/markdown',
  'text/plain',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

/**
 * Courses Service Class
 * 
 * Main service class providing business logic for course management functionality
 */
@Injectable()
export class CoursesService {
  /**
   * Constructor with dependency injection
   *
   * @param {Repository<Course>} coursesRepository - Course repository
   * @param {Repository<LearningMaterial>} learningMaterialRepository - Learning material repository
   * @param {Repository<Assignment>} assignmentRepository - Assignment repository
   * @param {Repository<Grade>} gradeRepository - Grade repository
   * @param {Repository<Enrollment>} enrollmentRepository - Enrollment repository
   * @param {Repository<Task>} taskRepository - Task repository
   * @param {Repository<TaskProgress>} taskProgressRepository - Task progress repository
   * @param {Repository<ContentRelease>} contentReleaseRepository - Content release repository
   * @param {Repository<ContentTemplate>} contentTemplateRepository - Content template repository
   * @param {Repository<CourseGroup>} courseGroupRepository - Course group repository
   * @param {Repository<GroupMembership>} groupMembershipRepository - Group membership repository
   * @param {Repository<CalendarEvent>} calendarEventRepository - Calendar event repository
   */
  constructor(
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    @InjectRepository(CourseRun)
    private courseRunRepository: Repository<CourseRun>,
    @InjectRepository(CourseVersion)
    private courseVersionRepository: Repository<CourseVersion>,
    @InjectRepository(LearningMaterial)
    private learningMaterialRepository: Repository<LearningMaterial>,
    @InjectRepository(Assignment)
    private assignmentRepository: Repository<Assignment>,
    @InjectRepository(Grade)
    private gradeRepository: Repository<Grade>,
    @InjectRepository(CourseResult)
    private courseResultRepository: Repository<CourseResult>,
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(TaskProgress)
    private taskProgressRepository: Repository<TaskProgress>,
    @InjectRepository(ContentRelease)
    private contentReleaseRepository: Repository<ContentRelease>,
    @InjectRepository(ContentTemplate)
    private contentTemplateRepository: Repository<ContentTemplate>,
    @InjectRepository(CourseGroup)
    private courseGroupRepository: Repository<CourseGroup>,
    @InjectRepository(GroupMembership)
    private groupMembershipRepository: Repository<GroupMembership>,
    @InjectRepository(CalendarEvent)
    private calendarEventRepository: Repository<CalendarEvent>,
    private readonly materialStorage: LocalMaterialStorage,
  ) {}

  /**
   * Get hello message for testing
   *
   * @returns {string} A simple hello message
   */
  getHello(): string {
    return 'Hello World!';
  }

  private toCourseId(id: string | number): string {
    return String(id);
  }

  private toUserId(userId: string | number): string {
    return String(userId);
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  private normalizeCourseStatus(status: unknown): CourseStatus | undefined {
    if (status === undefined || status === null || status === '') {
      return undefined;
    }

    const normalizedStatus = String(status).toUpperCase() as CourseStatus;

    if (!Object.values(CourseStatus).includes(normalizedStatus)) {
      throw new ApiValidationError('Invalid course status');
    }

    return normalizedStatus;
  }

  private normalizeCourseRunStatus(status: unknown): CourseRunStatus | undefined {
    if (status === undefined || status === null || status === '') {
      return undefined;
    }

    const normalizedStatus = String(status).toUpperCase() as CourseRunStatus;

    if (!Object.values(CourseRunStatus).includes(normalizedStatus)) {
      throw new ApiValidationError('Invalid course run status');
    }

    return normalizedStatus;
  }

  private normalizeRecurrenceType(type: unknown): CourseRecurrenceType {
    if (type === undefined || type === null || type === '') {
      return CourseRecurrenceType.CONTINUOUS;
    }

    const normalizedType = String(type).toUpperCase() as CourseRecurrenceType;

    if (!Object.values(CourseRecurrenceType).includes(normalizedType)) {
      throw new ApiValidationError('Invalid course recurrence type');
    }

    return normalizedType;
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private parseDateOnly(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const date = new Date(String(value));

    if (Number.isNaN(date.getTime())) {
      throw new ApiValidationError('Date values must be valid ISO dates');
    }

    return this.toDateOnly(date);
  }

  private dateFromDateOnly(value?: string | null): Date {
    return value ? new Date(`${value}T00:00:00.000Z`) : new Date();
  }

  private courseStatusToRunStatus(status: CourseStatus): CourseRunStatus {
    if (status === CourseStatus.PUBLISHED) {
      return CourseRunStatus.PUBLISHED;
    }

    if (status === CourseStatus.ARCHIVED) {
      return CourseRunStatus.ARCHIVED;
    }

    return CourseRunStatus.DRAFT;
  }

  private calculateSemesterRun(startDate: Date): {
    label: string;
    startDate: string;
    endDate: string;
  } {
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth() + 1;

    if (month >= 4 && month <= 9) {
      return {
        label: `Sommersemester ${year}`,
        startDate: `${year}-04-01`,
        endDate: `${year}-09-30`,
      };
    }

    const winterStartYear = month <= 3 ? year - 1 : year;
    const winterEndYear = winterStartYear + 1;

    return {
      label: `Wintersemester ${winterStartYear}/${String(winterEndYear).slice(2)}`,
      startDate: `${winterStartYear}-10-01`,
      endDate: `${winterEndYear}-03-31`,
    };
  }

  private calculateYearlyRun(startDate: Date): {
    label: string;
    startDate: string;
    endDate: string;
  } {
    const year = startDate.getUTCFullYear();

    return {
      label: String(year),
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }

  private calculateInitialRunFields(
    recurrenceType: CourseRecurrenceType,
    input: Record<string, unknown>,
  ): {
    label: string;
    startDate?: string;
    endDate?: string;
  } {
    const explicitLabel = this.normalizeOptionalText(
      input.initialRunLabel ?? input.runLabel ?? input.semester,
    );
    const parsedStartDate = this.parseDateOnly(
      input.initialStartDate ?? input.startDate,
    );
    const startDate = this.dateFromDateOnly(parsedStartDate);
    const explicitEndDate = this.parseDateOnly(input.initialEndDate ?? input.endDate);

    if (recurrenceType === CourseRecurrenceType.SEMESTER) {
      const calculated = this.calculateSemesterRun(startDate);

      return {
        ...calculated,
        label: explicitLabel ?? calculated.label,
        endDate: explicitEndDate ?? calculated.endDate,
      };
    }

    if (recurrenceType === CourseRecurrenceType.YEARLY) {
      const calculated = this.calculateYearlyRun(startDate);

      return {
        ...calculated,
        label: explicitLabel ?? calculated.label,
        endDate: explicitEndDate ?? calculated.endDate,
      };
    }

    return {
      label: explicitLabel ?? 'Fortlaufend',
      startDate: parsedStartDate,
      endDate: explicitEndDate,
    };
  }

  private calculateNextRunFields(
    course: Course,
    previousRun: CourseRun,
    body: CreateCourseRunDto = {},
  ): {
    label: string;
    startDate?: string;
    endDate?: string;
  } {
    const explicitLabel = this.normalizeOptionalText(body.label);
    const explicitStartDate = this.parseDateOnly(body.startDate);
    const explicitEndDate = this.parseDateOnly(body.endDate);
    const recurrenceType = course.recurrenceType ?? CourseRecurrenceType.CONTINUOUS;

    if (recurrenceType === CourseRecurrenceType.CONTINUOUS) {
      if (!explicitLabel) {
        throw new ApiValidationError(
          'Continuous courses require an explicit label for a manual new run',
        );
      }

      return {
        label: explicitLabel,
        startDate: explicitStartDate,
        endDate: explicitEndDate,
      };
    }

    const previousStart = this.dateFromDateOnly(previousRun.startDate);
    const month = previousStart.getUTCMonth() + 1;
    let nextStart: Date;

    if (recurrenceType === CourseRecurrenceType.SEMESTER) {
      const year = previousStart.getUTCFullYear();
      nextStart = month >= 4 && month <= 9
        ? new Date(Date.UTC(year, 9, 1))
        : new Date(Date.UTC(month <= 3 ? year : year + 1, 3, 1));
      const calculated = this.calculateSemesterRun(
        explicitStartDate ? this.dateFromDateOnly(explicitStartDate) : nextStart,
      );

      return {
        ...calculated,
        label: explicitLabel ?? calculated.label,
        endDate: explicitEndDate ?? calculated.endDate,
      };
    }

    nextStart = new Date(Date.UTC(previousStart.getUTCFullYear() + 1, 0, 1));
    const calculated = this.calculateYearlyRun(
      explicitStartDate ? this.dateFromDateOnly(explicitStartDate) : nextStart,
    );

    return {
      ...calculated,
      label: explicitLabel ?? calculated.label,
      endDate: explicitEndDate ?? calculated.endDate,
    };
  }

  private calculatePlannedNextRunFields(
    course: Course,
    currentRun: CourseRun,
  ): {
    label: string;
    startDate?: string;
    endDate?: string;
  } | null {
    if ((course.recurrenceType ?? CourseRecurrenceType.CONTINUOUS) === CourseRecurrenceType.CONTINUOUS) {
      return null;
    }

    return this.calculateNextRunFields(course, currentRun);
  }

  private calculateSpecialRunFields(
    body: CreateCourseRunDto,
  ): {
    label: string;
    startDate?: string;
    endDate?: string;
  } {
    const label = this.normalizeOptionalText(body.label);

    if (!label) {
      throw new ApiValidationError(
        'Ein Sonderdurchlauf benötigt eine eindeutige Bezeichnung.',
      );
    }

    return {
      label,
      startDate: this.parseDateOnly(body.startDate),
      endDate: this.parseDateOnly(body.endDate),
    };
  }

  private normalizeCourseRunTemplateStrategy(
    value: unknown,
  ): CourseRunTemplateStrategy {
    if (value === undefined || value === null || value === '') {
      return CourseRunTemplateStrategy.ACTIVE_VERSION_OF_CURRENT_RUN;
    }

    const normalized = String(value).toUpperCase() as CourseRunTemplateStrategy;

    if (!Object.values(CourseRunTemplateStrategy).includes(normalized)) {
      throw new ApiValidationError('Invalid course run template strategy');
    }

    return normalized;
  }

  private normalizeCourseRole(role: string): CourseMemberRole {
    try {
      return normalizeCourseRole(role);
    } catch {
      throw new ApiValidationError('Invalid course role');
    }
  }

  private createExternalCourseId(): string {
    return `course-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private requireActorUserId(actorUserId?: string | number): string {
    if (actorUserId === undefined || actorUserId === null || actorUserId === '') {
      throw new ApiUnauthorizedError();
    }

    return this.toUserId(actorUserId);
  }

  private requireCourseTitle(title: unknown): string {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new ApiValidationError('Course title is required', ['title must not be empty']);
    }

    return title.trim();
  }

  private async findCourseOrThrow(courseId: string | number): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id: this.toCourseId(courseId) },
    });

    if (!course) {
      throw new ApiNotFoundError('Course not found');
    }

    return course;
  }

  private async resolveCourseRole(
    courseId: string | number,
    userId: string | number,
  ): Promise<CourseMemberRole | null> {
    const normalizedCourseId = this.toCourseId(courseId);
    const enrollment = await this.findCourseEnrollment(
      normalizedCourseId,
      userId,
    );

    if (enrollment) {
      return this.normalizeCourseRole(enrollment.role);
    }

    const ownerId = this.toOptionalNumber(userId);

    if (ownerId === undefined) {
      return null;
    }

    const ownedCourse = await this.coursesRepository.findOne({
      where: {
        id: normalizedCourseId,
        owner_id: ownerId,
      },
    });

    return ownedCourse ? CourseMemberRole.TEACHER : null;
  }

  private async assertCoursePermission(
    courseId: string | number,
    actorUserId: string | number | undefined,
    permission: CoursePermission,
  ): Promise<CourseMemberRole> {
    const normalizedActorId = this.requireActorUserId(actorUserId);
    const role = await this.resolveCourseRole(courseId, normalizedActorId);

    if (!hasCoursePermission(role, permission)) {
      throw new ApiForbiddenError(
        'You do not have permission to access this course resource',
        'COURSE_ACCESS_DENIED',
      );
    }

    return role;
  }

  private normalizeMaterialType(type: unknown): LearningMaterialType {
    const normalizedType = String(type ?? '').toUpperCase();

    if (normalizedType === 'LINK') {
      return LearningMaterialType.EXTERNAL_LINK;
    }

    if (
      Object.values(LearningMaterialType).includes(
        normalizedType as LearningMaterialType,
      )
    ) {
      return normalizedType as LearningMaterialType;
    }

    throw new ApiValidationError('Invalid learning material type');
  }

  private parseTags(tags: unknown): string[] {
    if (tags === undefined || tags === null || tags === '') {
      return [];
    }

    let rawTags: unknown;

    try {
      rawTags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string' && tags.trim().startsWith('[')
          ? JSON.parse(tags)
          : String(tags).split(',');
    } catch {
      throw new ApiValidationError('Tags must be valid JSON or a comma separated list');
    }

    if (!Array.isArray(rawTags)) {
      throw new ApiValidationError('Tags must be a list');
    }

    return rawTags
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .filter((tag, index, list) => list.indexOf(tag) === index);
  }

  private parsePreviewMetadata(
    previewMetadata: unknown,
  ): Record<string, unknown> | undefined {
    if (
      previewMetadata === undefined ||
      previewMetadata === null ||
      previewMetadata === ''
    ) {
      return undefined;
    }

    if (typeof previewMetadata === 'object' && !Array.isArray(previewMetadata)) {
      return previewMetadata as Record<string, unknown>;
    }

    if (typeof previewMetadata === 'string') {
      let parsed: unknown;

      try {
        parsed = JSON.parse(previewMetadata);
      } catch {
        throw new ApiValidationError('Preview metadata must be valid JSON');
      }

      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }

    throw new ApiValidationError('Preview metadata must be an object');
  }

  private parseSortOrder(sortOrder: unknown): number {
    if (sortOrder === undefined || sortOrder === null || sortOrder === '') {
      return 0;
    }

    const parsedSortOrder = Number(sortOrder);

    if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
      throw new ApiValidationError('Sort order must be a non-negative integer');
    }

    return parsedSortOrder;
  }

  private requireMaterialTitle(title: unknown): string {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new ApiValidationError('Learning material title is required', [
        'title must not be empty',
      ]);
    }

    return title.trim();
  }

  private validateExternalUrl(url: unknown): string {
    if (typeof url !== 'string' || url.trim().length === 0) {
      throw new ApiValidationError('URL is required');
    }

    try {
      const parsedUrl = new URL(url);

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Unsupported protocol');
      }

      return parsedUrl.toString();
    } catch {
      throw new ApiValidationError('External link must be a valid HTTP or HTTPS URL');
    }
  }

  private validateUploadedMaterialFile(file?: UploadedLearningMaterialFile): asserts file is UploadedLearningMaterialFile & {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  } {
    if (!file?.buffer || !file.originalname || !file.mimetype) {
      throw new ApiValidationError('A file upload is required');
    }

    if (!ALLOWED_MATERIAL_MIME_TYPES.includes(file.mimetype)) {
      throw new ApiValidationError('File type is not allowed', [
        `${file.mimetype} is not allowed`,
      ]);
    }

    if (file.size > maxMaterialFileSizeBytes()) {
      throw new ApiValidationError('File is too large', [
        `maximum size is ${maxMaterialFileSizeBytes()} bytes`,
      ]);
    }
  }

  private normalizeMaterialReleaseMode(mode: unknown): LearningMaterialReleaseMode {
    if (mode === undefined || mode === null || mode === '') {
      return LearningMaterialReleaseMode.IMMEDIATE;
    }

    const normalizedMode = String(mode).toUpperCase() as LearningMaterialReleaseMode;

    if (!Object.values(LearningMaterialReleaseMode).includes(normalizedMode)) {
      throw new ApiValidationError('Invalid material release mode');
    }

    return normalizedMode;
  }

  private hasProvidedValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
  }

  private hasOwnInputField(input: Record<string, unknown>, field: string): boolean {
    return Object.prototype.hasOwnProperty.call(input, field);
  }

  private parseReleaseDate(value: unknown): Date | null {
    if (!this.hasProvidedValue(value)) {
      return null;
    }

    const parsedDate = value instanceof Date ? value : new Date(String(value));

    if (Number.isNaN(parsedDate.getTime())) {
      throw new ApiValidationError('Release date must be a valid date-time');
    }

    return parsedDate;
  }

  private async applyLearningMaterialReleaseConfiguration(
    material: LearningMaterial,
    input: Record<string, unknown>,
    forceDefault = false,
  ): Promise<void> {
    const modeProvided = this.hasOwnInputField(input, 'releaseMode');
    const releaseAtProvided = this.hasOwnInputField(input, 'releaseAt');
    const releaseAfterTaskProvided = this.hasOwnInputField(input, 'releaseAfterTaskId');
    const hasReleaseChange =
      forceDefault || modeProvided || releaseAtProvided || releaseAfterTaskProvided;

    if (!hasReleaseChange) {
      return;
    }

    const mode = modeProvided
      ? this.normalizeMaterialReleaseMode(input.releaseMode)
      : material.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE;
    const releaseAt = releaseAtProvided
      ? this.parseReleaseDate(input.releaseAt)
      : material.releaseAt ?? null;
    const releaseAfterTaskId = releaseAfterTaskProvided
      ? this.hasProvidedValue(input.releaseAfterTaskId)
        ? String(input.releaseAfterTaskId)
        : null
      : material.releaseAfterTaskId ?? null;

    if (mode === LearningMaterialReleaseMode.IMMEDIATE) {
      if (
        (!modeProvided || releaseAtProvided) &&
        releaseAtProvided &&
        this.hasProvidedValue(input.releaseAt)
      ) {
        throw new ApiValidationError('Immediate materials cannot define a release date');
      }

      if (
        (!modeProvided || releaseAfterTaskProvided) &&
        releaseAfterTaskProvided &&
        this.hasProvidedValue(input.releaseAfterTaskId)
      ) {
        throw new ApiValidationError('Immediate materials cannot define a release task');
      }

      material.releaseMode = mode;
      material.releaseAt = null;
      material.releaseAfterTaskId = null;
      return;
    }

    if (mode === LearningMaterialReleaseMode.SCHEDULED) {
      if (releaseAfterTaskProvided && this.hasProvidedValue(input.releaseAfterTaskId)) {
        throw new ApiValidationError('Scheduled materials cannot define a release task');
      }

      if (!releaseAt) {
        throw new ApiValidationError('Scheduled materials require a release date');
      }

      material.releaseMode = mode;
      material.releaseAt = releaseAt;
      material.releaseAfterTaskId = null;
      return;
    }

    if (releaseAtProvided && this.hasProvidedValue(input.releaseAt)) {
      throw new ApiValidationError('Task-based materials cannot define a release date');
    }

    if (!releaseAfterTaskId) {
      throw new ApiValidationError('Task-based materials require a release task');
    }

    const releaseTask = await this.taskRepository.findOne({
      where: {
        id: releaseAfterTaskId,
        courseId: material.courseId,
        courseRunId: material.courseRunId,
        ...(material.courseVersionId ? { courseVersionId: material.courseVersionId } : {}),
      },
    });

    if (!releaseTask) {
      throw new ApiValidationError(
        'Release task must belong to the same content version as the material',
      );
    }

    material.releaseMode = mode;
    material.releaseAt = null;
    material.releaseAfterTaskId = releaseTask.id;
  }

  private async buildLearningMaterialVisibility(
    material: LearningMaterial,
    actorUserId?: string | number,
    role?: CourseMemberRole,
  ): Promise<LearningMaterialVisibility> {
    const releaseMode = material.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE;
    const releaseAfterTaskTitle = material.releaseAfterTaskId
      ? (await this.taskRepository.findOne({
        where: {
          id: material.releaseAfterTaskId,
        },
      }))?.title
      : undefined;
    const isPublished =
      material.publicationStatus === LearningMaterialPublicationStatus.PUBLISHED;

    if (!isPublished) {
      return {
        visible: false,
        locked: false,
        releaseAfterTaskTitle,
        visibleForStudents: false,
      };
    }

    if (releaseMode === LearningMaterialReleaseMode.IMMEDIATE) {
      return {
        visible: true,
        locked: false,
        releaseAfterTaskTitle,
        visibleForStudents: true,
      };
    }

    if (releaseMode === LearningMaterialReleaseMode.SCHEDULED) {
      const releaseAt = material.releaseAt;
      const visible = Boolean(releaseAt && releaseAt.getTime() <= Date.now());

      return {
        visible,
        locked: !visible,
        lockedReason: visible
          ? undefined
          : `Wird sichtbar ab ${this.formatGermanDateTime(releaseAt)}`,
        releaseAfterTaskTitle,
        visibleForStudents: visible,
      };
    }

    const conditionalVisibility: LearningMaterialVisibility = {
      visible: false,
      locked: true,
      lockedReason: releaseAfterTaskTitle
        ? `Wird sichtbar, sobald Aufgabe "${releaseAfterTaskTitle}" erfolgreich abgeschlossen wurde.`
        : 'Wird sichtbar, sobald die vorausgesetzte Aufgabe erfolgreich abgeschlossen wurde.',
      releaseAfterTaskTitle,
      visibleForStudents: false,
    };

    if (
      !actorUserId ||
      !role ||
      hasCoursePermission(role, CoursePermission.ManageCourseContent)
    ) {
      return {
        ...conditionalVisibility,
        locked: false,
      };
    }

    const enrollment = await this.findCourseEnrollment(
      material.courseId,
      actorUserId,
      material.courseRunId,
    );

    if (!enrollment || enrollment.role !== CourseMemberRole.STUDENT) {
      return conditionalVisibility;
    }

    const progress = material.releaseAfterTaskId
      ? await this.taskProgressRepository.findOne({
        where: {
          enrollmentId: enrollment.id,
          taskId: material.releaseAfterTaskId,
        },
      })
      : null;
    const visible =
      progress?.status === TaskProgressStatus.COMPLETED &&
      progress.resultPassed === true;

    return {
      ...conditionalVisibility,
      visible,
      locked: !visible,
      lockedReason: visible ? undefined : conditionalVisibility.lockedReason,
      visibleForStudents: visible,
    };
  }

  private async mapLearningMaterialForActor(
    material: LearningMaterial,
    actorUserId?: string | number,
    role?: CourseMemberRole,
  ): Promise<LearningMaterialResponseDto> {
    const visibility = await this.buildLearningMaterialVisibility(
      material,
      actorUserId,
      role,
    );

    return mapLearningMaterialToDto(material, visibility);
  }

  private formatGermanDateTime(value?: Date | null): string {
    if (!value) {
      return 'dem geplanten Zeitpunkt';
    }

    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Berlin',
    }).format(value);
  }

  private async findLearningMaterialOrThrow(
    materialId: string,
  ): Promise<LearningMaterial> {
    const material = await this.learningMaterialRepository.findOne({
      where: { id: materialId },
    });

    if (!material || material.publicationStatus === LearningMaterialPublicationStatus.ARCHIVED) {
      throw new ApiNotFoundError(
        'Learning material not found',
        'MATERIAL_NOT_FOUND',
      );
    }

    return material;
  }

  private async findCurrentCourseRun(courseId: string | number): Promise<CourseRun | null> {
    return this.courseRunRepository.findOne({
      where: {
        courseId: this.toCourseId(courseId),
        isActive: true,
      },
    });
  }

  private async createInitialCourseRun(
    course: Course,
    actorId: string | undefined,
    input: Record<string, unknown> = {},
  ): Promise<CourseRun> {
    const fields = this.calculateInitialRunFields(
      course.recurrenceType ?? CourseRecurrenceType.CONTINUOUS,
      input,
    );
    const run = new CourseRun();
    run.courseId = course.id;
    run.course = course;
    run.label = fields.label;
    run.startDate = fields.startDate;
    run.endDate = fields.endDate;
    run.status = this.courseStatusToRunStatus(course.status);
    run.isActive = true;
    run.createdBy = actorId;

    return this.courseRunRepository.save(run);
  }

  private async getCurrentCourseRunOrCreate(
    courseId: string | number,
  ): Promise<CourseRun> {
    const normalizedCourseId = this.toCourseId(courseId);
    const currentRun = await this.findCurrentCourseRun(normalizedCourseId);

    if (currentRun) {
      return currentRun;
    }

    const course = await this.findCourseOrThrow(normalizedCourseId);

    return this.createInitialCourseRun(
      course,
      course.created_by ?? course.updated_by,
      {
        initialRunLabel: course.semester,
      },
    );
  }

  private async assertLearningMaterialReadable(
    material: LearningMaterial,
    actorUserId?: string | number,
  ): Promise<CourseMemberRole> {
    const role = await this.assertCoursePermission(
      material.courseId,
      actorUserId,
      CoursePermission.ReadCourseContent,
    );

    if (
      !hasCoursePermission(role, CoursePermission.ManageCourseContent) &&
      material.publicationStatus !== LearningMaterialPublicationStatus.PUBLISHED
    ) {
      throw new ApiForbiddenError(
        'Learning material is not published',
        'MATERIAL_ACCESS_DENIED',
      );
    }

    if (!hasCoursePermission(role, CoursePermission.ManageCourseContent)) {
      const { run: currentRun, version } =
        await this.getActiveCourseVersionForCurrentRunOrThrow(material.courseId);

      if (
        material.courseRunId !== currentRun.id ||
        material.courseVersionId !== version.id
      ) {
        throw new ApiForbiddenError(
          'Learning material is not available in the active content version',
          'MATERIAL_ACCESS_DENIED',
        );
      }
    }

    return role;
  }

  private async assertLearningMaterialManageable(
    material: LearningMaterial,
    actorUserId?: string | number,
  ): Promise<void> {
    await this.assertCoursePermission(
      material.courseId,
      actorUserId,
      CoursePermission.ManageCourseContent,
    );
  }

  private async findCourseEnrollment(
    courseId: string,
    userId: string | number,
    courseRunId?: string,
  ): Promise<Enrollment | null> {
    const resolvedRunId =
      courseRunId ?? (await this.findCurrentCourseRun(courseId))?.id;

    return this.enrollmentRepository.findOne({
      where: {
        courseId,
        ...(resolvedRunId ? { courseRunId: resolvedRunId } : {}),
        userId: this.toUserId(userId),
      },
    });
  }

  private normalizeChangeSummary(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const summary = String(value).trim();

    return summary.length > 0 ? summary : undefined;
  }

  private async buildCourseVersionContent(
    course: Course,
    courseRun: CourseRun,
    courseVersion?: CourseVersion,
  ): Promise<Record<string, unknown>> {
    const materialWhere = {
      courseId: course.id,
      courseRunId: courseRun.id,
      ...(courseVersion ? { courseVersionId: courseVersion.id } : {}),
      publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
    };
    const taskWhere = {
      courseId: course.id,
      courseRunId: courseRun.id,
      ...(courseVersion ? { courseVersionId: courseVersion.id } : {}),
    };
    const [materials, tasks] = await Promise.all([
      this.learningMaterialRepository.find({
        where: materialWhere,
        order: {
          sortOrder: 'ASC',
          createdAt: 'ASC',
        },
      }),
      this.taskRepository.find({
        where: taskWhere,
        order: {
          order: 'ASC',
        },
      }),
    ]);

    return {
      course: {
        id: course.id,
        externalId: course.external_id,
        title: course.title,
        description: course.description,
        semester: course.semester,
        status: course.status,
        location: course.location,
        ownerId: course.owner_id,
        updatedAt: course.updated_at instanceof Date ? course.updated_at.toISOString() : undefined,
      },
      courseRun: {
        id: courseRun.id,
        label: courseRun.label,
        startDate: courseRun.startDate,
        endDate: courseRun.endDate,
        status: courseRun.status,
        isActive: courseRun.isActive,
      },
      courseVersion: courseVersion
        ? {
          id: courseVersion.id,
          versionNumber: courseVersion.version_number,
          label: courseVersion.label,
          changeSummary: courseVersion.change_summary,
          status: courseVersion.status,
          isActive: courseVersion.is_active,
          sourceVersionId: courseVersion.sourceVersionId,
        }
        : undefined,
      learningMaterials: materials.map((material) => ({
        id: material.id,
        courseVersionId: material.courseVersionId,
        title: material.title,
        description: material.description,
        type: material.type,
        url: material.url,
        content: material.content,
        originalFileName: material.originalFileName,
        storageKey: material.storageKey,
        mimeType: material.mimeType,
        fileSize: material.fileSize,
        previewMetadata: material.previewMetadata,
        tags: material.tags ?? [],
        sortOrder: material.sortOrder,
        publicationStatus: material.publicationStatus,
        isPublished: material.isPublished,
        releaseMode: material.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE,
        releaseAt: material.releaseAt instanceof Date
          ? material.releaseAt.toISOString()
          : undefined,
        releaseAfterTaskId: material.releaseAfterTaskId,
        publishedAt: material.publishedAt instanceof Date
          ? material.publishedAt.toISOString()
          : undefined,
        filePath: material.filePath,
      })),
      tasks: tasks.map((task) => ({
        id: task.id,
        courseVersionId: task.courseVersionId,
        title: task.title,
        description: task.description,
        type: task.type,
        order: task.order,
        unlockMode: task.unlockMode,
        prerequisiteTaskId: task.prerequisiteTaskId,
        completionCriteria: task.completionCriteria ?? {},
        isPublished: task.isPublished,
        demoKey: task.demoKey,
      })),
    };
  }

  private async getNextCourseVersionNumber(courseRunId: string): Promise<number> {
    const versions = await this.courseVersionRepository.find({
      where: {
        course_run_id: courseRunId,
      },
      order: {
        version_number: 'DESC',
      },
    });

    return (versions[0]?.version_number ?? 0) + 1;
  }

  private async findActiveOrLatestCourseVersionForRun(
    courseId: string,
    runId: string,
  ): Promise<CourseVersion | null> {
    const versions = await this.courseVersionRepository.find({
      where: {
        course_id: courseId,
        course_run_id: runId,
        status: Not(CourseVersionStatus.ARCHIVED),
      },
      order: {
        version_number: 'DESC',
      },
      relations: ['courseRun', 'sourceVersion', 'sourceVersion.courseRun'],
    });

    return versions.find((version) => version.is_active) ?? versions[0] ?? null;
  }

  private async attachLegacyRunContentToVersion(
    courseId: string,
    runId: string,
    versionId: string,
  ): Promise<void> {
    const [legacyMaterials, legacyTasks] = await Promise.all([
      this.learningMaterialRepository.find({
        where: {
          courseId,
          courseRunId: runId,
          courseVersionId: IsNull(),
          publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
        },
      }),
      this.taskRepository.find({
        where: {
          courseId,
          courseRunId: runId,
          courseVersionId: IsNull(),
        },
      }),
    ]);

    legacyMaterials.forEach((material) => {
      material.courseVersionId = versionId;
    });
    legacyTasks.forEach((task) => {
      task.courseVersionId = versionId;
    });

    await Promise.all([
      legacyMaterials.length > 0
        ? this.learningMaterialRepository.save(legacyMaterials)
        : Promise.resolve([]),
      legacyTasks.length > 0
        ? this.taskRepository.save(legacyTasks)
        : Promise.resolve([]),
    ]);
  }

  private async getActiveCourseVersionForRunOrThrow(
    courseId: string,
    runId: string,
  ): Promise<CourseVersion> {
    const version = await this.findActiveOrLatestCourseVersionForRun(courseId, runId);

    if (version) {
      await this.attachLegacyRunContentToVersion(courseId, runId, version.id);
      await this.refreshCourseVersionContent(version.id);

      if (!version.is_active) {
        return this.setActiveCourseVersion(courseId, version.id);
      }

      return version;
    }

    const course = await this.findCourseOrThrow(courseId);
    const run = await this.courseRunRepository.findOne({
      where: {
        id: runId,
        courseId,
      },
    });

    if (!run) {
      throw new ApiNotFoundError('Course run not found', 'COURSE_RUN_NOT_FOUND');
    }

    const createdVersion = await this.createInitialContentVersionForRun(
      course,
      run,
      course.created_by ?? run.createdBy ?? 'system',
      `Initiale Inhaltsversion fuer ${run.label}`,
    );

    await this.attachLegacyRunContentToVersion(course.id, run.id, createdVersion.id);
    await this.refreshCourseVersionContent(createdVersion.id);

    const reloadedVersion = await this.courseVersionRepository.findOne({
      where: {
        id: createdVersion.id,
      },
      relations: ['courseRun', 'sourceVersion', 'sourceVersion.courseRun'],
    });

    return reloadedVersion ?? createdVersion;
  }

  private async getActiveCourseVersionForCurrentRunOrThrow(
    courseId: string,
  ): Promise<{ run: CourseRun; version: CourseVersion }> {
    const run = await this.getCurrentCourseRunOrCreate(courseId);
    const version = await this.getActiveCourseVersionForRunOrThrow(courseId, run.id);

    return { run, version };
  }

  private async findCourseVersionInRunOrThrow(
    courseId: string,
    runId: string,
    versionId: string,
  ): Promise<CourseVersion> {
    const version = await this.courseVersionRepository.findOne({
      where: {
        id: versionId,
        course_id: courseId,
        course_run_id: runId,
        status: Not(CourseVersionStatus.ARCHIVED),
      },
      relations: ['courseRun', 'sourceVersion', 'sourceVersion.courseRun'],
    });

    if (!version) {
      throw new ApiNotFoundError('Course version not found', 'COURSE_NOT_FOUND');
    }

    return version;
  }

  private async refreshCourseVersionContent(versionId?: string | null): Promise<void> {
    if (!versionId) {
      return;
    }

    const version = await this.courseVersionRepository.findOne({
      where: { id: versionId },
      relations: ['courseRun'],
    });

    if (!version || !version.course_run_id) {
      return;
    }

    const course = await this.findCourseOrThrow(version.course_id);
    const run = version.courseRun ?? await this.courseRunRepository.findOne({
      where: {
        id: version.course_run_id,
        courseId: version.course_id,
      },
    });

    if (!run) {
      return;
    }

    version.content = await this.buildCourseVersionContent(course, run, version);
    await this.courseVersionRepository.save(version);
  }

  private async findCourseVersionTemplateOrThrow(
    courseId: string,
    sourceVersionId: string,
  ): Promise<CourseVersion> {
    const sourceVersion = await this.courseVersionRepository.findOne({
      where: {
        id: sourceVersionId,
      },
      relations: ['courseRun', 'sourceVersion', 'sourceVersion.courseRun'],
    });

    if (!sourceVersion || sourceVersion.status === CourseVersionStatus.ARCHIVED) {
      throw new ApiNotFoundError('Course version template not found', 'COURSE_NOT_FOUND');
    }

    if (sourceVersion.course_id !== courseId) {
      throw new ApiValidationError(
        'Die ausgewählte Inhaltsvorlage gehört nicht zu diesem Kurs.',
      );
    }

    if (!sourceVersion.course_run_id) {
      throw new ApiValidationError(
        'Die ausgewählte Inhaltsvorlage gehört zu keinem Kursdurchlauf.',
      );
    }

    return sourceVersion;
  }

  private async resolveCourseRunTemplateVersion(
    course: Course,
    currentRun: CourseRun,
    sourceVersionId?: string | null,
  ): Promise<CourseVersion | null> {
    if (sourceVersionId) {
      return this.findCourseVersionTemplateOrThrow(course.id, sourceVersionId);
    }

    const strategy = this.normalizeCourseRunTemplateStrategy(
      course.contentTemplateStrategy,
    );

    if (strategy === CourseRunTemplateStrategy.EMPTY) {
      return null;
    }

    if (
      strategy === CourseRunTemplateStrategy.SPECIFIC_VERSION &&
      course.plannedSourceVersionId
    ) {
      return this.findCourseVersionTemplateOrThrow(
        course.id,
        course.plannedSourceVersionId,
      );
    }

    return this.getActiveCourseVersionForRunOrThrow(course.id, currentRun.id);
  }

  private async assertPlannedRunDoesNotExist(
    courseId: string,
    fields: {
      label: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<void> {
    const existingRuns = await this.courseRunRepository.find({
      where: {
        courseId,
      },
    });
    const duplicate = existingRuns.find((run) =>
      run.label === fields.label &&
      (run.startDate ?? null) === (fields.startDate ?? null) &&
      (run.endDate ?? null) === (fields.endDate ?? null),
    );

    if (duplicate) {
      throw new ApiValidationError(
        'Der nächste geplante Kursdurchlauf wurde bereits vorbereitet.',
      );
    }
  }

  private async hydrateCourseVersionTemplateInfo(
    version: CourseVersion,
  ): Promise<CourseVersion> {
    if (version.courseRun && (!version.sourceVersionId || version.sourceVersion)) {
      return version;
    }

    if (!version.courseRun && version.course_run_id) {
      version.courseRun = await this.courseRunRepository.findOne({
        where: {
          id: version.course_run_id,
        },
      }) ?? undefined;
    }

    if (version.sourceVersionId && !version.sourceVersion) {
      const sourceVersion = await this.courseVersionRepository.findOne({
        where: {
          id: version.sourceVersionId,
        },
        relations: ['courseRun'],
      });
      version.sourceVersion = sourceVersion ?? null;
    }

    if (version.sourceVersion && !version.sourceVersion.courseRun && version.sourceVersion.course_run_id) {
      version.sourceVersion.courseRun = await this.courseRunRepository.findOne({
        where: {
          id: version.sourceVersion.course_run_id,
        },
      }) ?? undefined;
    }

    return version;
  }

  private async mapCourseVersionWithTemplateInfo(
    version: CourseVersion,
  ): Promise<CourseVersionResponseDto> {
    return mapCourseVersionToDto(
      await this.hydrateCourseVersionTemplateInfo(version),
    );
  }

  private getSnapshotTasks(version: CourseVersion): CourseVersionSnapshotTask[] {
    const tasks = (version.content ?? {}).tasks;

    return Array.isArray(tasks) ? tasks as CourseVersionSnapshotTask[] : [];
  }

  private getSnapshotMaterials(version: CourseVersion): CourseVersionSnapshotMaterial[] {
    const materials = (version.content ?? {}).learningMaterials;

    return Array.isArray(materials)
      ? materials as CourseVersionSnapshotMaterial[]
      : [];
  }

  private hasCourseVersionContentSnapshot(version: CourseVersion): boolean {
    return (
      Array.isArray((version.content ?? {}).tasks) &&
      Array.isArray((version.content ?? {}).learningMaterials)
    );
  }

  private async assertCourseVersionReadable(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<void> {
    await this.assertCoursePermission(
      courseId,
      actorUserId,
      CoursePermission.ManageCourseContent,
    );
  }

  private async setActiveCourseVersion(
    courseId: string,
    versionId: string,
  ): Promise<CourseVersion> {
    const version = await this.courseVersionRepository.findOne({
      where: {
        id: versionId,
        course_id: courseId,
        status: Not(CourseVersionStatus.ARCHIVED),
      },
    });

    if (!version) {
      throw new ApiNotFoundError('Course version not found', 'COURSE_NOT_FOUND');
    }

    const versions = await this.courseVersionRepository.find({
      where: {
        course_id: courseId,
        course_run_id: version.course_run_id,
      },
    });

    versions.forEach((candidate) => {
      candidate.is_active = false;
    });
    await this.courseVersionRepository.save(versions);
    version.is_active = true;

    const savedVersion = await this.courseVersionRepository.save(version);
    await this.refreshCourseVersionContent(savedVersion.id);

    return savedVersion;
  }

  private async mapCourseRunWithCounts(run: CourseRun): Promise<CourseRunResponseDto> {
    const activeVersion = await this.getActiveCourseVersionForRunOrThrow(
      run.courseId,
      run.id,
    );
    const [enrollments, materials, tasks, versions, results, assignments] = await Promise.all([
      this.enrollmentRepository.find({ where: { courseRunId: run.id } }),
      this.learningMaterialRepository.find({
        where: {
          courseRunId: run.id,
          courseVersionId: activeVersion.id,
          publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
        },
      }),
      this.taskRepository.find({
        where: {
          courseRunId: run.id,
          courseVersionId: activeVersion.id,
        },
      }),
      this.courseVersionRepository.find({
        where: {
          course_run_id: run.id,
          status: Not(CourseVersionStatus.ARCHIVED),
        },
      }),
      this.courseResultRepository.find({ where: { courseRunId: run.id } }),
      this.assignmentRepository.find({ where: { courseRunId: run.id } }),
    ]);
    const progressRecords = tasks.length > 0
      ? await this.taskProgressRepository.find({
        where: {
          taskId: In(tasks.map((task) => task.id)),
        },
      })
      : [];

    return mapCourseRunToDto(run, {
      enrollmentCount: enrollments.length,
      materialCount: materials.length,
      taskCount: tasks.length,
      versionCount: versions.length,
      resultCount: results.length,
      progressCount: progressRecords.length,
      assignmentCount: assignments.length,
    });
  }

  private async assertCourseRunReadable(
    courseId: string,
    runId: string,
    actorUserId?: string | number,
  ): Promise<CourseMemberRole | null> {
    const actorId = this.requireActorUserId(actorUserId);
    const run = await this.courseRunRepository.findOne({
      where: {
        id: runId,
        courseId,
      },
    });

    if (!run) {
      throw new ApiNotFoundError('Course run not found', 'COURSE_RUN_NOT_FOUND');
    }

    const activeRole = await this.resolveCourseRole(courseId, actorId);

    if (hasCoursePermission(activeRole, CoursePermission.ManageCourseContent)) {
      return activeRole;
    }

    if (!run.isActive) {
      throw new ApiForbiddenError(
        'You do not have permission to access historical course runs',
        'COURSE_ACCESS_DENIED',
      );
    }

    const enrollment = await this.findCourseEnrollment(courseId, actorId, runId);

    if (!enrollment) {
      throw new ApiForbiddenError(
        'You do not have permission to access this course run',
        'COURSE_ACCESS_DENIED',
      );
    }

    return this.normalizeCourseRole(enrollment.role);
  }

  private async assertCourseRunManageable(
    courseId: string | number,
    runId: string,
    actorUserId?: string | number,
  ): Promise<CourseRun> {
    const normalizedCourseId = this.toCourseId(courseId);

    await this.assertCoursePermission(
      normalizedCourseId,
      actorUserId,
      CoursePermission.ManageCourseContent,
    );

    const run = await this.courseRunRepository.findOne({
      where: {
        id: runId,
        courseId: normalizedCourseId,
      },
    });

    if (!run) {
      throw new ApiNotFoundError('Course run not found', 'COURSE_RUN_NOT_FOUND');
    }

    return run;
  }

  private async setActiveCourseRun(
    courseId: string,
    runId: string,
  ): Promise<CourseRun> {
    const run = await this.courseRunRepository.findOne({
      where: {
        id: runId,
        courseId,
      },
    });

    if (!run) {
      throw new ApiNotFoundError('Course run not found', 'COURSE_RUN_NOT_FOUND');
    }

    const runs = await this.courseRunRepository.find({
      where: {
        courseId,
      },
    });

    runs.forEach((candidate) => {
      candidate.isActive = false;
    });
    await this.courseRunRepository.save(runs);
    run.isActive = true;

    return this.courseRunRepository.save(run);
  }

  private async copyLearningMaterialsToRun(
    sourceRunId: string,
    targetRun: CourseRun,
    actorId: string,
    taskIdMap: Map<string, string> = new Map(),
    targetVersion?: CourseVersion,
    sourceVersionId?: string,
  ): Promise<void> {
    const materials = await this.learningMaterialRepository.find({
      where: {
        courseRunId: sourceRunId,
        ...(sourceVersionId ? { courseVersionId: sourceVersionId } : {}),
        publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
      },
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });

    for (const source of materials) {
      const material = new LearningMaterial();
      material.courseId = targetRun.courseId;
      material.courseRunId = targetRun.id;
      material.courseRun = targetRun;
      material.courseVersionId = targetVersion?.id;
      material.courseVersion = targetVersion;
      material.title = source.title;
      material.description = source.description;
      material.content = source.content;
      material.type = source.type;
      material.url = source.url;
      material.originalFileName = source.originalFileName;
      material.storageKey = source.storageKey;
      material.mimeType = source.mimeType;
      material.fileSize = source.fileSize;
      material.previewMetadata = source.previewMetadata;
      material.tags = [...(source.tags ?? [])];
      material.sortOrder = source.sortOrder;
      material.publicationStatus = source.publicationStatus;
      material.publishedAt = source.publishedAt;
      material.releaseMode = source.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE;
      material.releaseAt = source.releaseAt;
      material.releaseAfterTaskId = source.releaseAfterTaskId
        ? taskIdMap.get(source.releaseAfterTaskId)
        : null;
      material.filePath = source.filePath;
      material.isPublished = source.isPublished;
      material.createdBy = actorId;
      material.updatedBy = actorId;
      await this.learningMaterialRepository.save(material);
    }
  }

  private async copyTasksToRun(
    sourceRunId: string,
    targetRun: CourseRun,
    actorId: string,
    targetVersion?: CourseVersion,
    sourceVersionId?: string,
  ): Promise<Map<string, string>> {
    const sourceTasks = await this.taskRepository.find({
      where: {
        courseRunId: sourceRunId,
        ...(sourceVersionId ? { courseVersionId: sourceVersionId } : {}),
      },
      order: {
        order: 'ASC',
      },
    });
    const taskIdMap = new Map<string, string>();

    for (const source of sourceTasks) {
      const task = new Task();
      task.courseId = targetRun.courseId;
      task.courseRunId = targetRun.id;
      task.courseRun = targetRun;
      task.courseVersionId = targetVersion?.id;
      task.courseVersion = targetVersion;
      task.title = source.title;
      task.description = source.description;
      task.type = source.type;
      task.order = source.order;
      task.unlockMode = source.unlockMode;
      task.prerequisiteTaskId = undefined;
      task.completionCriteria = source.completionCriteria;
      task.isPublished = source.isPublished;
      task.demoKey = source.demoKey;
      task.createdBy = actorId;
      task.updatedBy = actorId;
      const savedTask = await this.taskRepository.save(task);
      taskIdMap.set(source.id, savedTask.id);
    }

    for (const source of sourceTasks) {
      if (!source.prerequisiteTaskId) {
        continue;
      }

      const copiedTaskId = taskIdMap.get(source.id);
      const copiedPrerequisiteId = taskIdMap.get(source.prerequisiteTaskId);

      if (!copiedTaskId || !copiedPrerequisiteId) {
        continue;
      }

      const copiedTask = await this.taskRepository.findOne({
        where: {
          id: copiedTaskId,
        },
      });

      if (copiedTask) {
        copiedTask.prerequisiteTaskId = copiedPrerequisiteId;
        copiedTask.updatedBy = actorId;
        await this.taskRepository.save(copiedTask);
      }
    }

    return taskIdMap;
  }

  private cloneJsonValue<T>(value: T): T {
    if (value === undefined || value === null) {
      return value;
    }

    return JSON.parse(JSON.stringify(value)) as T;
  }

  private normalizeSnapshotTaskUnlockMode(value: unknown): TaskUnlockMode {
    const normalizedValue = String(value ?? TaskUnlockMode.IMMEDIATE).toUpperCase() as TaskUnlockMode;

    return Object.values(TaskUnlockMode).includes(normalizedValue)
      ? normalizedValue
      : TaskUnlockMode.IMMEDIATE;
  }

  private normalizeSnapshotMaterialType(value: unknown): LearningMaterialType {
    const normalizedValue = String(value ?? LearningMaterialType.OTHER_FILE).toUpperCase() as LearningMaterialType;

    return Object.values(LearningMaterialType).includes(normalizedValue)
      ? normalizedValue
      : LearningMaterialType.OTHER_FILE;
  }

  private normalizeSnapshotPublicationStatus(
    value: unknown,
  ): LearningMaterialPublicationStatus {
    const normalizedValue = String(
      value ?? LearningMaterialPublicationStatus.DRAFT,
    ).toUpperCase() as LearningMaterialPublicationStatus;

    return Object.values(LearningMaterialPublicationStatus).includes(normalizedValue)
      ? normalizedValue
      : LearningMaterialPublicationStatus.DRAFT;
  }

  private normalizeSnapshotReleaseMode(value: unknown): LearningMaterialReleaseMode {
    const normalizedValue = String(
      value ?? LearningMaterialReleaseMode.IMMEDIATE,
    ).toUpperCase() as LearningMaterialReleaseMode;

    return Object.values(LearningMaterialReleaseMode).includes(normalizedValue)
      ? normalizedValue
      : LearningMaterialReleaseMode.IMMEDIATE;
  }

  private parseSnapshotDate(value?: string | Date | null): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private parseSnapshotFileSize(value?: number | string | null): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) && parsedValue >= 0
      ? parsedValue
      : undefined;
  }

  private async copyTasksFromVersionSnapshot(
    sourceVersion: CourseVersion,
    targetRun: CourseRun,
    actorId: string,
    targetVersion: CourseVersion,
  ): Promise<Map<string, string>> {
    if (!this.hasCourseVersionContentSnapshot(sourceVersion)) {
      if (!sourceVersion.course_run_id) {
        return new Map();
      }

      return this.copyTasksToRun(
        sourceVersion.course_run_id,
        targetRun,
        actorId,
        targetVersion,
        sourceVersion.id,
      );
    }

    const sourceTasks = this.getSnapshotTasks(sourceVersion);
    const taskIdMap = new Map<string, string>();
    const copiedTasksBySourceId = new Map<string, Task>();

    for (const source of sourceTasks) {
      const task = new Task();
      task.courseId = targetRun.courseId;
      task.courseRunId = targetRun.id;
      task.courseRun = targetRun;
      task.courseVersionId = targetVersion.id;
      task.courseVersion = targetVersion;
      task.title = String(source.title ?? 'Unbenannte Aufgabe');
      task.description = String(source.description ?? '');
      task.type = String(source.type ?? 'TASK');
      task.order = Number.isInteger(Number(source.order)) ? Number(source.order) : 0;
      task.unlockMode = this.normalizeSnapshotTaskUnlockMode(source.unlockMode);
      task.prerequisiteTaskId = undefined;
      task.completionCriteria = this.cloneJsonValue(source.completionCriteria ?? {});
      task.isPublished = source.isPublished === true;
      task.demoKey = source.demoKey ?? undefined;
      task.createdBy = actorId;
      task.updatedBy = actorId;
      const savedTask = await this.taskRepository.save(task);

      if (source.id) {
        taskIdMap.set(source.id, savedTask.id);
        copiedTasksBySourceId.set(source.id, savedTask);
      }
    }

    for (const source of sourceTasks) {
      if (!source.id || !source.prerequisiteTaskId) {
        continue;
      }

      const copiedTask = copiedTasksBySourceId.get(source.id);
      const copiedPrerequisiteId = taskIdMap.get(source.prerequisiteTaskId);

      if (!copiedTask || !copiedPrerequisiteId) {
        throw new ApiValidationError(
          'Eine Aufgabenabhängigkeit der ausgewählten Vorlage konnte nicht kopiert werden.',
        );
      }

      copiedTask.prerequisiteTaskId = copiedPrerequisiteId;
      copiedTask.updatedBy = actorId;
      await this.taskRepository.save(copiedTask);
    }

    return taskIdMap;
  }

  private async copyLearningMaterialsFromVersionSnapshot(
    sourceVersion: CourseVersion,
    targetRun: CourseRun,
    actorId: string,
    taskIdMap: Map<string, string>,
    targetVersion: CourseVersion,
  ): Promise<void> {
    if (!this.hasCourseVersionContentSnapshot(sourceVersion)) {
      if (!sourceVersion.course_run_id) {
        return;
      }

      await this.copyLearningMaterialsToRun(
        sourceVersion.course_run_id,
        targetRun,
        actorId,
        taskIdMap,
        targetVersion,
        sourceVersion.id,
      );
      return;
    }

    const sourceMaterials = this.getSnapshotMaterials(sourceVersion);

    for (const source of sourceMaterials) {
      const releaseMode = this.normalizeSnapshotReleaseMode(source.releaseMode);
      const releaseAfterTaskId = source.releaseAfterTaskId
        ? taskIdMap.get(source.releaseAfterTaskId)
        : null;

      if (
        releaseMode === LearningMaterialReleaseMode.AFTER_TASK_COMPLETION &&
        source.releaseAfterTaskId &&
        !releaseAfterTaskId
      ) {
        throw new ApiValidationError(
          'Eine Material-Freischaltregel der ausgewählten Vorlage konnte nicht kopiert werden.',
        );
      }

      const material = new LearningMaterial();
      material.courseId = targetRun.courseId;
      material.courseRunId = targetRun.id;
      material.courseRun = targetRun;
      material.courseVersionId = targetVersion.id;
      material.courseVersion = targetVersion;
      material.title = String(source.title ?? 'Unbenanntes Material');
      material.description = source.description;
      material.content = source.content;
      material.type = this.normalizeSnapshotMaterialType(source.type);
      material.url = source.url;
      material.originalFileName = source.originalFileName;
      material.storageKey = source.storageKey;
      material.mimeType = source.mimeType;
      material.fileSize = this.parseSnapshotFileSize(source.fileSize);
      material.previewMetadata = this.cloneJsonValue(source.previewMetadata);
      material.tags = Array.isArray(source.tags) ? [...source.tags] : [];
      material.sortOrder = Number.isInteger(Number(source.sortOrder))
        ? Number(source.sortOrder)
        : 0;
      material.publicationStatus = this.normalizeSnapshotPublicationStatus(
        source.publicationStatus,
      );
      material.publishedAt = this.parseSnapshotDate(source.publishedAt) ?? undefined;
      material.releaseMode = releaseMode;
      material.releaseAt = releaseMode === LearningMaterialReleaseMode.SCHEDULED
        ? this.parseSnapshotDate(source.releaseAt)
        : null;
      material.releaseAfterTaskId = releaseMode === LearningMaterialReleaseMode.AFTER_TASK_COMPLETION
        ? releaseAfterTaskId
        : null;
      material.filePath = source.filePath;
      material.isPublished = source.isPublished === true;
      material.createdBy = actorId;
      material.updatedBy = actorId;
      await this.learningMaterialRepository.save(material);
    }
  }

  private async copyCourseVersionContentToRun(
    sourceVersion: CourseVersion,
    targetRun: CourseRun,
    actorId: string,
    targetVersion: CourseVersion,
  ): Promise<void> {
    if (sourceVersion.course_id !== targetRun.courseId) {
      throw new ApiValidationError(
        'Die ausgewählte Inhaltsvorlage gehört nicht zu diesem Kurs.',
      );
    }

    const sourceHasSnapshot = this.hasCourseVersionContentSnapshot(sourceVersion);

    if (!sourceHasSnapshot && sourceVersion.is_active && sourceVersion.course_run_id) {
      await this.attachLegacyRunContentToVersion(
        sourceVersion.course_id,
        sourceVersion.course_run_id,
        sourceVersion.id,
      );
    }

    const [sourceMaterials, sourceTasks] = await Promise.all([
      this.learningMaterialRepository.find({
        where: {
          courseVersionId: sourceVersion.id,
          publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
        },
      }),
      this.taskRepository.find({
        where: {
          courseVersionId: sourceVersion.id,
        },
      }),
    ]);
    let copySource = sourceVersion;

    if (!sourceHasSnapshot && (sourceMaterials.length > 0 || sourceTasks.length > 0)) {
      await this.refreshCourseVersionContent(sourceVersion.id);
      copySource = await this.courseVersionRepository.findOne({
        where: {
          id: sourceVersion.id,
        },
        relations: ['courseRun', 'sourceVersion', 'sourceVersion.courseRun'],
      }) ?? sourceVersion;
    }

    const copiedTaskIds = await this.copyTasksFromVersionSnapshot(
      copySource,
      targetRun,
      actorId,
      targetVersion,
    );
    await this.copyLearningMaterialsFromVersionSnapshot(
      copySource,
      targetRun,
      actorId,
      copiedTaskIds,
      targetVersion,
    );
  }

  private async createInitialContentVersionForRun(
    course: Course,
    run: CourseRun,
    actorId: string,
    changeSummary: string,
    sourceVersionId?: string | null,
  ): Promise<CourseVersion> {
    const version = new CourseVersion();
    version.course_id = course.id;
    version.course = course;
    version.course_run_id = run.id;
    version.courseRun = run;
    version.version_number = 1;
    version.label = 'Version 1';
    version.content = {};
    version.change_summary = changeSummary;
    version.status = CourseVersionStatus.PUBLISHED;
    version.sourceVersionId = sourceVersionId ?? null;
    version.created_by = actorId;
    version.is_active = true;

    const savedVersion = await this.courseVersionRepository.save(version);
    savedVersion.content = await this.buildCourseVersionContent(
      course,
      run,
      savedVersion,
    );

    return this.courseVersionRepository.save(savedVersion);
  }

  private parseCourseResultNumber(
    value: unknown,
    fieldName: string,
  ): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      throw new ApiValidationError(`${fieldName} must be a valid number`);
    }

    if (numericValue < 0) {
      throw new ApiValidationError(`${fieldName} cannot be negative`);
    }

    return Math.round(numericValue * 100) / 100;
  }

  private normalizeOptionalText(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const text = String(value).trim();

    return text.length > 0 ? text : null;
  }

  private normalizeManualPassStatus(value: unknown): CoursePassStatus {
    const normalizedStatus = String(value ?? '').toUpperCase() as CoursePassStatus;

    if (
      normalizedStatus !== CoursePassStatus.PASSED &&
      normalizedStatus !== CoursePassStatus.FAILED
    ) {
      throw new ApiValidationError(
        'Manual results require PASSED or FAILED as pass status',
      );
    }

    return normalizedStatus;
  }

  private normalizeOptionalPassStatus(
    value: unknown,
  ): CoursePassStatus | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const normalizedStatus = String(value).toUpperCase() as CoursePassStatus;

    if (!Object.values(CoursePassStatus).includes(normalizedStatus)) {
      throw new ApiValidationError('Invalid pass status filter');
    }

    return normalizedStatus;
  }

  private normalizeOptionalCourseResultSource(
    value: unknown,
  ): CourseResultSource | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const normalizedSource = String(value).toUpperCase() as CourseResultSource;

    if (!Object.values(CourseResultSource).includes(normalizedSource)) {
      throw new ApiValidationError('Invalid result source filter');
    }

    return normalizedSource;
  }

  private parsePaginationValue(
    value: unknown,
    defaultValue: number,
    maxValue?: number,
  ): number {
    const numericValue =
      value === undefined || value === null || value === ''
        ? defaultValue
        : Number(value);

    if (!Number.isInteger(numericValue) || numericValue < 1) {
      throw new ApiValidationError('Pagination values must be positive integers');
    }

    return maxValue ? Math.min(numericValue, maxValue) : numericValue;
  }

  private validateCourseResultPoints(
    pointsAchieved: number | null,
    maxPoints: number | null,
  ): void {
    if (
      (pointsAchieved === null && maxPoints !== null) ||
      (pointsAchieved !== null && maxPoints === null)
    ) {
      throw new ApiValidationError(
        'Points achieved and max points must be provided together',
      );
    }

    if (
      pointsAchieved !== null &&
      maxPoints !== null &&
      pointsAchieved > maxPoints
    ) {
      throw new ApiValidationError(
        'Points achieved cannot be greater than max points',
      );
    }
  }

  private calculatePercentage(
    pointsAchieved: number | null,
    maxPoints: number | null,
  ): number | null {
    if (
      pointsAchieved === null ||
      maxPoints === null ||
      maxPoints === 0
    ) {
      return null;
    }

    return Math.round((pointsAchieved / maxPoints) * 10000) / 100;
  }

  private async findCourseResult(
    courseId: string,
    enrollmentId: string,
  ): Promise<CourseResult | null> {
    return this.courseResultRepository.findOne({
      where: {
        courseId,
        enrollmentId,
      },
    });
  }

  private assignCourseResultRelations(
    result: CourseResult,
    courseId: string,
    enrollment: Enrollment,
  ): void {
    result.courseId = courseId;
    result.courseRunId = enrollment.courseRunId;
    result.enrollmentId = enrollment.id;
    result.studentId = enrollment.userId;

    const course = new Course();
    course.id = courseId;
    result.course = course;
    result.enrollment = enrollment;
  }

  private ensureValidAssignmentMaxPoints(assignment: Assignment): number {
    const maxPoints = Number(assignment.maxPoints);

    if (!Number.isFinite(maxPoints) || maxPoints < 0) {
      throw new ApiValidationError('Assignment max points must be non-negative');
    }

    return maxPoints;
  }

  private ensureValidAutomaticGradePoints(
    pointsAchieved: unknown,
    maxPoints: number,
  ): number {
    const numericPoints = Number(pointsAchieved);

    if (!Number.isFinite(numericPoints)) {
      throw new ApiValidationError('Grade points must be a valid number');
    }

    if (numericPoints < 0) {
      throw new ApiValidationError('Grade points cannot be negative');
    }

    if (numericPoints > maxPoints) {
      throw new ApiValidationError(
        'Grade points cannot be greater than assignment max points',
      );
    }

    return numericPoints;
  }

  private async assertCourseResultManager(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<string> {
    const actorId = this.requireActorUserId(actorUserId);

    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ReadAllResults,
    );

    return actorId;
  }

  private async calculateAndSaveAutomaticCourseResult(
    courseId: string,
    enrollment: Enrollment,
    actorId: string,
  ): Promise<CourseResultResponseDto> {
    const assignments = await this.assignmentRepository.find({
      where: {
        course: { id: courseId },
        courseRunId: enrollment.courseRunId,
        isGraded: true,
      },
    });
    const grades = await this.gradeRepository.find({
      where: { enrollment: { id: enrollment.id } },
      relations: ['assignment'],
    });
    const finalGrades = grades.filter((grade) => grade.isFinal);

    let totalPointsAchieved = 0;
    let totalMaxPoints = 0;
    const assignmentAudit = assignments.map((assignment) => {
      const maxPoints = this.ensureValidAssignmentMaxPoints(assignment);
      const grade = finalGrades.find(
        (candidate) => candidate.assignment?.id === assignment.id,
      );
      const pointsAchieved = grade
        ? this.ensureValidAutomaticGradePoints(grade.pointsAchieved, maxPoints)
        : 0;

      totalPointsAchieved += pointsAchieved;
      totalMaxPoints += maxPoints;

      return {
        assignmentId: assignment.id,
        title: assignment.title,
        maxPoints,
        pointsAchieved,
        gradeId: grade?.id,
        finalGradeAvailable: Boolean(grade),
      };
    });
    const roundedPointsAchieved = Math.round(totalPointsAchieved * 100) / 100;
    const roundedMaxPoints = Math.round(totalMaxPoints * 100) / 100;
    const percentage = this.calculatePercentage(
      roundedPointsAchieved,
      roundedMaxPoints,
    );
    const existingResult = await this.findCourseResult(courseId, enrollment.id);
    const result = existingResult ?? new CourseResult();

    this.assignCourseResultRelations(result, courseId, enrollment);
    result.assessmentMode = CourseResultMode.AUTOMATIC;
    result.pointsAchieved = roundedPointsAchieved;
    result.maxPoints = roundedMaxPoints;
    result.percentage = percentage;
    result.manualGrade = null;
    result.passStatus = calculateCoursePassStatus(percentage);
    result.source = CourseResultSource.AUTOMATIC_CALCULATION;
    result.comment = null;
    result.gradedBy = actorId;
    result.gradedAt = new Date();
    result.sourceDetails = {
      rule: COURSE_PASSING_RULE_DESCRIPTION,
      passThresholdPercent: COURSE_PASSING_THRESHOLD_PERCENT,
      comparator: '>',
      calculatedFrom: 'course.assignments.finalGrades',
      assignments: assignmentAudit,
    };
    result.createdBy = result.createdBy ?? actorId;
    result.updatedBy = actorId;

    return mapCourseResultToDto(
      await this.courseResultRepository.save(result),
    );
  }

  async findAll(userId?: string | number): Promise<CourseResponseDto[]> {
    if (userId === undefined || userId === null) {
      const courses = await this.coursesRepository.find();
      return courses.map(mapCourseToDto);
    }

    const coursesById = new Map<string, Course>();
    const ownerId = this.toOptionalNumber(userId);

    if (ownerId !== undefined) {
      const ownedCourses = await this.coursesRepository.find({
        where: { owner_id: ownerId },
      });

      ownedCourses.forEach((course) => coursesById.set(course.id, course));
    }

    const enrollments = await this.enrollmentRepository.find({
      where: { userId: this.toUserId(userId) },
      relations: ['course', 'courseRun'],
    });

    enrollments
      .filter((enrollment) => enrollment.courseRun?.isActive === true)
      .map((enrollment) => enrollment.course)
      .filter(Boolean)
      .forEach((course) => coursesById.set(course.id, course));

    return Array.from(coursesById.values()).map(mapCourseToDto);
  }

  async getAvailableCourses(
    actorUserId?: string | number,
  ): Promise<CourseCatalogItemResponseDto[]> {
    const actorId = this.requireActorUserId(actorUserId);
    const courses = await this.coursesRepository.find({
      where: {
        status: CourseStatus.PUBLISHED,
      },
      order: {
        title: 'ASC',
      },
    });
    const enrollments = await this.enrollmentRepository.find({
      where: {
        userId: actorId,
      },
      relations: ['courseRun'],
    });
    const enrollmentByCourseId = new Map(
      enrollments
        .filter((enrollment) => enrollment.courseRun?.isActive)
        .map((enrollment) => [enrollment.courseId, enrollment]),
    );
    const ownerId = this.toOptionalNumber(actorId);
    const result: CourseCatalogItemResponseDto[] = [];

    for (const course of courses) {
      if (enrollmentByCourseId.has(course.id)) {
        continue;
      }

      if (ownerId !== undefined && course.owner_id === ownerId) {
        continue;
      }

      const currentRun = await this.getCurrentCourseRunOrCreate(course.id);

      result.push(mapCourseToCatalogItemDto(course, null, currentRun));
    }

    return result;
  }

  async getEnrolledCourses(
    actorUserId?: string | number,
  ): Promise<CourseCatalogItemResponseDto[]> {
    const actorId = this.requireActorUserId(actorUserId);
    const coursesById = new Map<string, CourseCatalogItemResponseDto>();
    const enrollments = await this.enrollmentRepository.find({
      where: {
        userId: actorId,
      },
      relations: ['course', 'courseRun'],
    });

    enrollments
      .filter((enrollment) => Boolean(enrollment.course))
      .filter((enrollment) => enrollment.courseRun?.isActive === true)
      .forEach((enrollment) => {
        coursesById.set(
          enrollment.course.id,
          mapCourseToCatalogItemDto(
            enrollment.course,
            enrollment,
            enrollment.courseRun,
          ),
        );
      });

    const ownerId = this.toOptionalNumber(actorId);

    if (ownerId !== undefined) {
      const ownedCourses = await this.coursesRepository.find({
        where: {
          owner_id: ownerId,
        },
        order: {
          title: 'ASC',
        },
      });

      for (const course of ownedCourses) {
        if (!coursesById.has(course.id)) {
          const currentRun = await this.getCurrentCourseRunOrCreate(course.id);
          const teacherEnrollment = new Enrollment();
          teacherEnrollment.courseId = course.id;
          teacherEnrollment.course = course;
          teacherEnrollment.courseRunId = currentRun.id;
          teacherEnrollment.courseRun = currentRun;
          teacherEnrollment.userId = actorId;
          teacherEnrollment.role = CourseMemberRole.TEACHER;
          coursesById.set(
            course.id,
            mapCourseToCatalogItemDto(course, teacherEnrollment, currentRun),
          );
        }
      }
    }

    return Array.from(coursesById.values()).sort((left, right) =>
      left.title.localeCompare(right.title),
    );
  }

  async findOne(id: string | number): Promise<CourseResponseDto> {
    const course = await this.coursesRepository.findOne({
      where: { id: this.toCourseId(id) },
      relations: ['versions', 'enrollments', 'groups'],
    });

    if (!course) {
      throw new ApiNotFoundError('Course not found');
    }

    return mapCourseToDto(course);
  }

  async getUserRoleInCourse(
    courseId: string | number,
    userId: string | number,
  ): Promise<CourseMemberRole | null> {
    await this.findCourseOrThrow(courseId);
    return this.resolveCourseRole(courseId, userId);
  }

  async getCourseContext(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<CourseContextResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const course = await this.findCourseOrThrow(courseId);
    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);
    const role = await this.resolveCourseRole(courseId, actorId);

    if (!hasCoursePermission(role, CoursePermission.ReadCourseContent)) {
      throw new ApiForbiddenError(
        'You are not enrolled in this course',
        'COURSE_ACCESS_DENIED',
      );
    }

    if (role === CourseMemberRole.STUDENT && course.status !== CourseStatus.PUBLISHED) {
      throw new ApiForbiddenError(
        'Course content is not released for students',
        'COURSE_ACCESS_DENIED',
      );
    }

    const currentVersion = await this.getActiveCourseVersionForRunOrThrow(
      course.id,
      currentRun.id,
    );

    return mapCourseContextToDto(course, actorId, role, currentRun, currentVersion);
  }

  async getCourseMembers(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<EnrollmentResponseDto[]> {
    await this.assertCoursePermission(
      courseId,
      actorUserId,
      CoursePermission.ManageMembers,
    );

    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);
    const enrollments = await this.enrollmentRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: currentRun.id,
      },
    });

    return enrollments.map(mapEnrollmentToDto);
  }

  async getCourseMembersByRun(
    courseId: string | number,
    runId: string,
    actorUserId?: string | number,
  ): Promise<EnrollmentResponseDto[]> {
    const run = await this.assertCourseRunManageable(courseId, runId, actorUserId);
    const enrollments = await this.enrollmentRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
      },
    });

    return enrollments.map(mapEnrollmentToDto);
  }

  async createCourse(
    body: any,
    actorUserId?: string | number,
  ): Promise<CourseResponseDto> {
    body = body ?? {};

    const course = new Course();
    const actorId = actorUserId !== undefined ? this.toUserId(actorUserId) : undefined;
    const ownerId = this.toOptionalNumber(
      body.owner_id ?? body.ownerId ?? actorId ?? body.userId,
    );
    const status = this.normalizeCourseStatus(body.status);
    const recurrenceType = this.normalizeRecurrenceType(
      body.recurrenceType ?? body.recurrence_type,
    );

    course.external_id =
      body.external_id ?? body.externalId ?? this.createExternalCourseId();
    course.title = this.requireCourseTitle(body.title);
    course.description = body.description;
    course.semester = body.semester;
    course.recurrenceType = recurrenceType;
    course.status = status ?? CourseStatus.DRAFT;
    course.location = body.location;
    course.key_password = body.key_password ?? body.keyPassword;
    course.owner_id = ownerId;
    course.created_by = actorId ?? ownerId?.toString();
    course.updated_by = actorId ?? ownerId?.toString();

    const savedCourse = await this.coursesRepository.save(course);
    const initialRun = await this.createInitialCourseRun(savedCourse, actorId, body);
    await this.createInitialContentVersionForRun(
      savedCourse,
      initialRun,
      actorId ?? savedCourse.created_by ?? 'system',
      `Initiale Inhaltsversion fuer ${initialRun.label}`,
    );

    if (ownerId !== undefined) {
      const existingEnrollment = await this.findCourseEnrollment(
        savedCourse.id,
        ownerId,
        initialRun.id,
      );

      if (!existingEnrollment) {
        const enrollment = new Enrollment();
        enrollment.courseId = savedCourse.id;
        enrollment.course = savedCourse;
        enrollment.courseRunId = initialRun.id;
        enrollment.courseRun = initialRun;
        enrollment.userId = this.toUserId(ownerId);
        enrollment.role = CourseMemberRole.TEACHER;
        enrollment.createdBy = actorId ?? this.toUserId(ownerId);
        enrollment.updatedBy = actorId ?? this.toUserId(ownerId);

        await this.enrollmentRepository.save(enrollment);
      }
    }

    return mapCourseToDto(savedCourse);
  }

  async joinCourse(
    courseId: string | number,
    userId: string | number,
    key?: string,
  ): Promise<EnrollmentResponseDto> {
    return this.enrollInCourse(courseId, userId, key);
  }

  async enrollInCourse(
    courseId: string | number,
    actorUserId?: string | number,
    key?: string,
  ): Promise<EnrollmentResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const normalizedCourseId = this.toCourseId(courseId);
    const course = await this.coursesRepository.findOne({
      where: { id: normalizedCourseId },
    });

    if (!course) {
      throw new ApiNotFoundError('Course not found');
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new ApiForbiddenError(
        'Only published courses can be joined',
        'COURSE_ACCESS_DENIED',
      );
    }

    if (course.key_password && course.key_password !== key) {
      throw new ApiForbiddenError('Invalid course key', 'COURSE_ACCESS_DENIED');
    }

    const currentRun = await this.getCurrentCourseRunOrCreate(normalizedCourseId);
    const existingEnrollment = await this.findCourseEnrollment(
      normalizedCourseId,
      actorId,
      currentRun.id,
    );

    if (existingEnrollment) {
      if (existingEnrollment.role !== CourseMemberRole.STUDENT) {
        throw new ApiForbiddenError(
          'Teaching roles cannot be enrolled as students',
          'COURSE_ACCESS_DENIED',
        );
      }

      return mapEnrollmentToDto(existingEnrollment);
    }

    const ownerId = this.toOptionalNumber(actorId);

    if (ownerId !== undefined && course.owner_id === ownerId) {
      throw new ApiForbiddenError(
        'Course owners cannot be enrolled as students',
        'COURSE_ACCESS_DENIED',
      );
    }

    const enrollment = new Enrollment();
    enrollment.courseId = normalizedCourseId;
    enrollment.course = course;
    enrollment.courseRunId = currentRun.id;
    enrollment.courseRun = currentRun;
    enrollment.userId = actorId;
    enrollment.role = CourseMemberRole.STUDENT;
    enrollment.createdBy = actorId;
    enrollment.updatedBy = actorId;

    const savedEnrollment = await this.enrollmentRepository.save(enrollment);
    await this.initializeImmediateTaskProgressForEnrollment(
      normalizedCourseId,
      savedEnrollment,
      actorId,
    );

    return mapEnrollmentToDto(savedEnrollment);
  }

  async leaveCourse(
    courseId: string | number,
    userId?: string | number,
    actorUserId?: string | number,
  ): Promise<void> {
    if (userId === undefined || userId === null) {
      throw new ApiValidationError('User ID is required to leave a course');
    }

    const actorId = this.requireActorUserId(actorUserId ?? userId);
    const normalizedUserId = this.toUserId(userId);

    if (actorId !== normalizedUserId) {
      await this.assertCoursePermission(
        courseId,
        actorId,
        CoursePermission.ManageMembers,
      );
    }

    await this.enrollmentRepository.delete({
      courseId: this.toCourseId(courseId),
      courseRunId: (await this.getCurrentCourseRunOrCreate(courseId)).id,
      userId: normalizedUserId,
    });
  }

  async updateCourse(
    id: string | number,
    body: any,
    actorUserId?: string | number,
  ): Promise<CourseResponseDto> {
    body = body ?? {};
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(id, actorId, CoursePermission.ManageCourse);

    const course = await this.coursesRepository.findOne({
      where: { id: this.toCourseId(id) },
    });

    if (!course) {
      throw new ApiNotFoundError('Course not found');
    }

    const status = this.normalizeCourseStatus(body.status);
    const ownerId = this.toOptionalNumber(body.owner_id ?? body.ownerId);

    if (body.external_id !== undefined || body.externalId !== undefined) {
      course.external_id = body.external_id ?? body.externalId;
    }

    if (body.title !== undefined) {
      course.title = this.requireCourseTitle(body.title);
    }

    if (body.description !== undefined) {
      course.description = body.description;
    }

    if (body.semester !== undefined) {
      course.semester = body.semester;
    }

    if (body.recurrenceType !== undefined || body.recurrence_type !== undefined) {
      course.recurrenceType = this.normalizeRecurrenceType(
        body.recurrenceType ?? body.recurrence_type,
      );
    }

    if (status !== undefined) {
      course.status = status;
    }

    if (body.location !== undefined) {
      course.location = body.location;
    }

    if (body.key_password !== undefined || body.keyPassword !== undefined) {
      course.key_password = body.key_password ?? body.keyPassword;
    }

    if (ownerId !== undefined) {
      course.owner_id = ownerId;
    }

    course.updated_by = actorId;

    return mapCourseToDto(await this.coursesRepository.save(course));
  }

  async changeUserRole(
    courseId: string | number,
    userId: string | number,
    role: string,
    actorUserId?: string | number,
  ): Promise<EnrollmentResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorId,
      CoursePermission.ManageMembers,
    );
    const enrollment = await this.findCourseEnrollment(
      normalizedCourseId,
      userId,
    );

    if (!enrollment) {
      throw new ApiNotFoundError('Enrollment not found');
    }

    enrollment.role = this.normalizeCourseRole(role);
    enrollment.updatedBy = actorId;

    return mapEnrollmentToDto(await this.enrollmentRepository.save(enrollment));
  }

  async removeCourse(
    id: string | number,
    actorUserId?: string | number,
  ): Promise<void> {
    await this.assertCoursePermission(id, actorUserId, CoursePermission.ManageCourse);
    const result = await this.coursesRepository.delete(this.toCourseId(id));

    if (result.affected === 0) {
      throw new ApiNotFoundError('Course not found');
    }
  }

  /**
   * Create a new learning material for a course
   *
   * @param {string} courseId - ID of the course to add the material to
   * @param {string} title - Title of the learning material
   * @param {string} description - Description of the material
   * @param {string} type - Type of material (e.g., 'PRESENTATION', 'DOCUMENT')
   * @param {string} url - URL to access the material
   * @param {string} filePath - File path for uploaded materials
   * @param {string} createdBy - User ID of the creator
   * @returns {Promise<LearningMaterial>} The created learning material
   */
  async createLearningMaterial(
    courseId: string,
    title: string,
    description: string,
    type: string,
    url: string,
    filePath: string,
    createdBy: string,
  ): Promise<LearningMaterial> {
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));
    const material = new LearningMaterial();
    material.title = this.requireMaterialTitle(title);
    material.description = description;
    material.type = this.normalizeMaterialType(type);
    material.url = url;
    material.filePath = filePath;
    material.createdBy = createdBy;
    material.updatedBy = createdBy;
    material.courseId = this.toCourseId(courseId);
    material.courseRunId = currentRun.id;
    material.courseRun = currentRun;
    material.courseVersionId = version.id;
    material.courseVersion = version;
    material.isPublished = false;
    material.publicationStatus = LearningMaterialPublicationStatus.DRAFT;
    material.tags = [];
    material.sortOrder = 0;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    material.course = course;

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);

    return savedMaterial;
  }

  async createLearningMaterialFile(
    courseId: string,
    body: CreateExternalLearningMaterialDto,
    file: UploadedLearningMaterialFile | undefined,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );
    this.validateUploadedMaterialFile(file);

    const materialType = this.normalizeMaterialType(
      body.type ?? LearningMaterialType.OTHER_FILE,
    );

    if (materialType === LearningMaterialType.EXTERNAL_LINK) {
      throw new ApiValidationError('Uploaded files cannot use EXTERNAL_LINK type');
    }

    const storedFile = await this.materialStorage.saveFile(
      this.toCourseId(courseId),
      file.originalname,
      file.buffer,
    );
    const material = new LearningMaterial();
    material.courseId = this.toCourseId(courseId);
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));
    material.courseRunId = currentRun.id;
    material.courseRun = currentRun;
    material.courseVersionId = version.id;
    material.courseVersion = version;
    material.title = this.requireMaterialTitle(body.title);
    material.description = body.description;
    material.type = materialType;
    material.originalFileName = storedFile.safeFileName;
    material.storageKey = storedFile.storageKey;
    material.filePath = storedFile.storageKey;
    material.mimeType = file.mimetype;
    material.fileSize = file.size;
    material.previewMetadata = this.parsePreviewMetadata(body.previewMetadata);
    material.tags = this.parseTags(body.tags);
    material.sortOrder = this.parseSortOrder(body.sortOrder);
    material.publicationStatus = LearningMaterialPublicationStatus.DRAFT;
    material.isPublished = false;
    material.createdBy = actorId;
    material.updatedBy = actorId;
    await this.applyLearningMaterialReleaseConfiguration(
      material,
      body as Record<string, unknown>,
      true,
    );

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);

    return this.mapLearningMaterialForActor(
      savedMaterial,
      actorId,
      CourseMemberRole.TEACHER,
    );
  }

  async createExternalLearningMaterial(
    courseId: string,
    body: CreateExternalLearningMaterialDto,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );

    const material = new LearningMaterial();
    material.courseId = this.toCourseId(courseId);
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));
    material.courseRunId = currentRun.id;
    material.courseRun = currentRun;
    material.courseVersionId = version.id;
    material.courseVersion = version;
    material.title = this.requireMaterialTitle(body.title);
    material.description = body.description;
    material.type = LearningMaterialType.EXTERNAL_LINK;
    material.url = this.validateExternalUrl(body.url);
    material.previewMetadata = this.parsePreviewMetadata(body.previewMetadata);
    material.tags = this.parseTags(body.tags);
    material.sortOrder = this.parseSortOrder(body.sortOrder);
    material.publicationStatus = LearningMaterialPublicationStatus.DRAFT;
    material.isPublished = false;
    material.createdBy = actorId;
    material.updatedBy = actorId;
    await this.applyLearningMaterialReleaseConfiguration(
      material,
      body as Record<string, unknown>,
      true,
    );

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);

    return this.mapLearningMaterialForActor(
      savedMaterial,
      actorId,
      CourseMemberRole.TEACHER,
    );
  }

  async getLearningMaterialsByCourse(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto[]> {
    const role = await this.assertCoursePermission(
      courseId,
      actorUserId,
      CoursePermission.ReadCourseContent,
    );
    const canManage = hasCoursePermission(role, CoursePermission.ManageCourseContent);
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));
    const materials = await this.learningMaterialRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: currentRun.id,
        courseVersionId: version.id,
        publicationStatus: canManage
          ? Not(LearningMaterialPublicationStatus.ARCHIVED)
          : LearningMaterialPublicationStatus.PUBLISHED,
      },
      order: {
        sortOrder: 'ASC',
        createdAt: 'DESC',
      },
    });

    return Promise.all(
      materials.map((material) =>
        this.mapLearningMaterialForActor(material, actorUserId, role),
      ),
    );
  }

  async getLearningMaterialsByCourseRun(
    courseId: string,
    runId: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto[]> {
    const run = await this.assertCourseRunManageable(courseId, runId, actorUserId);
    const version = await this.getActiveCourseVersionForRunOrThrow(
      this.toCourseId(courseId),
      run.id,
    );
    const materials = await this.learningMaterialRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
        courseVersionId: version.id,
        publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
      },
      order: {
        sortOrder: 'ASC',
        createdAt: 'DESC',
      },
    });

    return Promise.all(
      materials.map((material) =>
        this.mapLearningMaterialForActor(
          material,
          actorUserId,
          CourseMemberRole.TEACHER,
        ),
      ),
    );
  }

  async getLearningMaterialsByCourseVersion(
    courseId: string,
    runId: string,
    versionId: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto[]> {
    const run = await this.assertCourseRunManageable(courseId, runId, actorUserId);
    const version = await this.findCourseVersionInRunOrThrow(
      this.toCourseId(courseId),
      run.id,
      versionId,
    );
    const materials = await this.learningMaterialRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
        courseVersionId: version.id,
        publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
      },
      order: {
        sortOrder: 'ASC',
        createdAt: 'DESC',
      },
    });

    return Promise.all(
      materials.map((material) =>
        this.mapLearningMaterialForActor(
          material,
          actorUserId,
          CourseMemberRole.TEACHER,
        ),
      ),
    );
  }

  async getLearningMaterialById(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const material = await this.findLearningMaterialOrThrow(id);

    const role = await this.assertLearningMaterialReadable(material, actorUserId);

    return this.mapLearningMaterialForActor(material, actorUserId, role);
  }

  async updateLearningMaterialMetadata(
    id: string,
    body: UpdateLearningMaterialDto,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const material = await this.findLearningMaterialOrThrow(id);

    await this.assertLearningMaterialManageable(material, actorId);

    if (body.title !== undefined) {
      material.title = this.requireMaterialTitle(body.title);
    }

    if (body.description !== undefined) {
      material.description = body.description;
    }

    if (body.type !== undefined) {
      const materialType = this.normalizeMaterialType(body.type);

      if (
        material.storageKey &&
        materialType === LearningMaterialType.EXTERNAL_LINK
      ) {
        throw new ApiValidationError('Uploaded files cannot be converted to external links');
      }

      if (
        !material.storageKey &&
        materialType !== LearningMaterialType.EXTERNAL_LINK
      ) {
        throw new ApiValidationError('External links cannot be converted to uploaded files');
      }

      material.type = materialType;
    }

    if (body.url !== undefined) {
      if (material.type !== LearningMaterialType.EXTERNAL_LINK) {
        throw new ApiValidationError('Only external links can have a URL');
      }

      material.url = this.validateExternalUrl(body.url);
    }

    if (body.previewMetadata !== undefined) {
      material.previewMetadata = this.parsePreviewMetadata(body.previewMetadata);
    }

    if (body.tags !== undefined) {
      material.tags = this.parseTags(body.tags);
    }

    if (body.sortOrder !== undefined) {
      material.sortOrder = this.parseSortOrder(body.sortOrder);
    }

    await this.applyLearningMaterialReleaseConfiguration(
      material,
      body as Record<string, unknown>,
    );

    material.updatedBy = actorId;

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);

    return this.mapLearningMaterialForActor(
      savedMaterial,
      actorId,
      CourseMemberRole.TEACHER,
    );
  }

  async updateLearningMaterialSortOrder(
    courseId: string,
    body: UpdateLearningMaterialSortDto,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto[]> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );

    if (!Array.isArray(body.items)) {
      throw new ApiValidationError('Sort items are required');
    }

    const materialIds = body.items
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));
    const materials = await this.learningMaterialRepository.find({
      where: {
        id: In(materialIds),
        courseId: this.toCourseId(courseId),
        courseRunId: currentRun.id,
        courseVersionId: version.id,
        publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
      },
    });
    const materialById = new Map(materials.map((material) => [material.id, material]));

    for (const item of body.items) {
      if (!item.id || !materialById.has(item.id)) {
        throw new ApiValidationError('Sort list contains an unknown material');
      }

      const material = materialById.get(item.id);
      material.sortOrder = this.parseSortOrder(item.sortOrder);
      material.updatedBy = actorId;
    }

    const savedMaterials = (await this.learningMaterialRepository.save(materials))
      .sort((left, right) => left.sortOrder - right.sortOrder);
    await this.refreshCourseVersionContent(version.id);

    return Promise.all(
      savedMaterials.map((material) =>
        this.mapLearningMaterialForActor(
          material,
          actorId,
          CourseMemberRole.TEACHER,
        ),
      ),
    );
  }

  async deleteLearningMaterial(
    id: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const actorId = this.requireActorUserId(actorUserId);
    const material = await this.findLearningMaterialOrThrow(id);

    await this.assertLearningMaterialManageable(material, actorId);

    material.publicationStatus = LearningMaterialPublicationStatus.ARCHIVED;
    material.isPublished = false;
    material.archivedAt = new Date();
    material.updatedBy = actorId;

    await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(material.courseVersionId);
  }

  async publishLearningMaterial(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const material = await this.findLearningMaterialOrThrow(id);

    await this.assertLearningMaterialManageable(material, actorId);

    material.isPublished = true;
    material.publicationStatus = LearningMaterialPublicationStatus.PUBLISHED;
    material.publishedAt = new Date();
    material.updatedBy = actorId;

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);

    return this.mapLearningMaterialForActor(
      savedMaterial,
      actorId,
      CourseMemberRole.TEACHER,
    );
  }

  async unpublishLearningMaterial(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const material = await this.findLearningMaterialOrThrow(id);

    await this.assertLearningMaterialManageable(material, actorId);

    material.isPublished = false;
    material.publicationStatus = LearningMaterialPublicationStatus.DRAFT;
    material.updatedBy = actorId;

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);

    return this.mapLearningMaterialForActor(
      savedMaterial,
      actorId,
      CourseMemberRole.TEACHER,
    );
  }

  async downloadLearningMaterial(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialDownload> {
    const material = await this.findLearningMaterialOrThrow(id);

    const role = await this.assertLearningMaterialReadable(material, actorUserId);
    const visibility = await this.buildLearningMaterialVisibility(
      material,
      actorUserId,
      role,
    );

    if (
      !hasCoursePermission(role, CoursePermission.ManageCourseContent) &&
      !visibility.visible
    ) {
      throw new ApiForbiddenError(
        visibility.lockedReason ?? 'Learning material is locked',
        'MATERIAL_ACCESS_DENIED',
      );
    }

    if (!material.storageKey) {
      throw new ApiValidationError('External links do not have downloadable files');
    }

    const file = this.materialStorage.openFile(material.courseId, material.storageKey);

    return {
      stream: file.stream,
      fileName: material.originalFileName ?? 'learning-material',
      mimeType: material.mimeType ?? 'application/octet-stream',
      fileSize:
        material.fileSize === undefined || material.fileSize === null
          ? undefined
          : Number(material.fileSize),
    };
  }

  async getMyCourseResult(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);

    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ReadOwnResults,
    );

    const enrollment = await this.findStudentEnrollmentOrThrow(
      this.toCourseId(courseId),
      actorId,
    );
    const result = await this.findCourseResult(
      this.toCourseId(courseId),
      enrollment.id,
    );

    return result
      ? mapCourseResultToDto(result)
      : mapMissingCourseResultToDto(this.toCourseId(courseId), enrollment);
  }

  private async buildCourseResultsForRun(
    courseId: string,
    courseRunId: string,
    query: CourseResultListQueryDto = {},
  ): Promise<CourseResultListResponseDto> {
    const page = this.parsePaginationValue(query.page, 1);
    const pageSize = this.parsePaginationValue(query.pageSize, 10, 100);
    const passStatus = this.normalizeOptionalPassStatus(query.passStatus);
    const source = this.normalizeOptionalCourseResultSource(query.source);
    const enrollments = await this.enrollmentRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId,
        role: CourseMemberRole.STUDENT,
      },
      order: {
        userId: 'ASC',
      },
    });
    const results = await this.courseResultRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId,
      },
    });
    const resultByEnrollmentId = new Map(
      results.map((result) => [result.enrollmentId, result]),
    );
    const allItems = enrollments
      .map((enrollment) => {
        const result = resultByEnrollmentId.get(enrollment.id);

        return result
          ? mapCourseResultToDto(result)
          : mapMissingCourseResultToDto(this.toCourseId(courseId), enrollment);
      })
      .filter((item) => !passStatus || item.passStatus === passStatus)
      .filter((item) => !source || item.source === source)
      .sort((left, right) =>
        String(left.studentId).localeCompare(String(right.studentId), undefined, {
          numeric: true,
        }),
      );
    const offset = (page - 1) * pageSize;

    return {
      items: allItems.slice(offset, offset + pageSize),
      page,
      pageSize,
      total: allItems.length,
    };
  }

  async getCourseResults(
    courseId: string,
    query: CourseResultListQueryDto = {},
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    await this.assertCourseResultManager(courseId, actorUserId);
    await this.findCourseOrThrow(courseId);
    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);

    return this.buildCourseResultsForRun(courseId, currentRun.id, query);
  }

  async getCourseResultsByRun(
    courseId: string,
    runId: string,
    query: CourseResultListQueryDto = {},
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    const run = await this.assertCourseRunManageable(courseId, runId, actorUserId);

    return this.buildCourseResultsForRun(courseId, run.id, query);
  }

  async setManualCourseResult(
    courseId: string,
    studentId: string,
    body: ManualCourseResultDto,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    const actorId = await this.assertCourseResultManager(courseId, actorUserId);
    const enrollment = await this.findStudentEnrollmentOrThrow(
      this.toCourseId(courseId),
      studentId,
    );
    const pointsAchieved = this.parseCourseResultNumber(
      body?.pointsAchieved,
      'Points achieved',
    );
    const maxPoints = this.parseCourseResultNumber(body?.maxPoints, 'Max points');
    const manualGrade = this.normalizeOptionalText(body?.manualGrade);
    const comment = this.normalizeOptionalText(body?.comment);
    const passStatus = this.normalizeManualPassStatus(body?.passStatus);

    this.validateCourseResultPoints(pointsAchieved, maxPoints);

    const existingResult = await this.findCourseResult(
      this.toCourseId(courseId),
      enrollment.id,
    );
    const result = existingResult ?? new CourseResult();
    const previousSource = existingResult?.source;
    const previousAssessmentMode = existingResult?.assessmentMode;
    const source =
      previousSource === CourseResultSource.AUTOMATIC_CALCULATION ||
      previousSource === CourseResultSource.MANUAL_OVERRIDE
        ? CourseResultSource.MANUAL_OVERRIDE
        : CourseResultSource.MANUAL_ENTRY;

    this.assignCourseResultRelations(result, this.toCourseId(courseId), enrollment);
    result.assessmentMode = CourseResultMode.MANUAL;
    result.pointsAchieved = pointsAchieved;
    result.maxPoints = maxPoints;
    result.percentage = this.calculatePercentage(pointsAchieved, maxPoints);
    result.manualGrade = manualGrade;
    result.passStatus = passStatus;
    result.source = source;
    result.comment = comment;
    result.gradedBy = actorId;
    result.gradedAt = new Date();
    result.sourceDetails = {
      source,
      previousSource,
      previousAssessmentMode,
      enteredBy: actorId,
      enteredAt: result.gradedAt.toISOString(),
    };
    result.createdBy = result.createdBy ?? actorId;
    result.updatedBy = actorId;

    return mapCourseResultToDto(
      await this.courseResultRepository.save(result),
    );
  }

  async recalculateCourseResult(
    courseId: string,
    studentId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    const actorId = await this.assertCourseResultManager(courseId, actorUserId);
    const enrollment = await this.findStudentEnrollmentOrThrow(
      this.toCourseId(courseId),
      studentId,
    );

    return this.calculateAndSaveAutomaticCourseResult(
      this.toCourseId(courseId),
      enrollment,
      actorId,
    );
  }

  async recalculateAllCourseResults(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    const actorId = await this.assertCourseResultManager(courseId, actorUserId);
    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);
    const enrollments = await this.enrollmentRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: currentRun.id,
        role: CourseMemberRole.STUDENT,
      },
      order: {
        userId: 'ASC',
      },
    });

    for (const enrollment of enrollments) {
      await this.calculateAndSaveAutomaticCourseResult(
        this.toCourseId(courseId),
        enrollment,
        actorId,
      );
    }

    return this.getCourseResults(
      this.toCourseId(courseId),
      {
        page: 1,
        pageSize: Math.max(enrollments.length, 1),
      },
      actorId,
    );
  }

  // Assignment methods
  async createAssignment(
    courseId: string,
    title: string,
    description: string,
    type: string,
    maxPoints: number,
    weight: number,
    dueDate: Date,
    createdBy: string,
  ): Promise<Assignment> {
    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);
    const assignment = new Assignment();
    assignment.title = title;
    assignment.description = description;
    assignment.type = type;
    assignment.maxPoints = maxPoints;
    assignment.weight = weight;
    assignment.dueDate = dueDate;
    assignment.createdBy = createdBy;
    assignment.updatedBy = createdBy;
    assignment.isPublished = false;
    assignment.isGraded = false;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    assignment.course = course;
    assignment.courseRunId = currentRun.id;
    assignment.courseRun = currentRun;

    return this.assignmentRepository.save(assignment);
  }

  async getAssignmentsByCourse(courseId: string): Promise<Assignment[]> {
    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);

    return this.assignmentRepository.find({
      where: {
        course: { id: courseId },
        courseRunId: currentRun.id,
      },
      relations: ['grades'],
    });
  }

  async getAssignmentById(id: string): Promise<Assignment> {
    return this.assignmentRepository.findOne({
      where: { id },
      relations: ['grades'],
    });
  }

  async updateAssignment(
    id: string,
    title: string,
    description: string,
    type: string,
    maxPoints: number,
    weight: number,
    dueDate: Date,
    isPublished: boolean,
    isGraded: boolean,
    updatedBy: string,
  ): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    assignment.title = title;
    assignment.description = description;
    assignment.type = type;
    assignment.maxPoints = maxPoints;
    assignment.weight = weight;
    assignment.dueDate = dueDate;
    assignment.isPublished = isPublished;
    assignment.isGraded = isGraded;
    assignment.updatedBy = updatedBy;

    return this.assignmentRepository.save(assignment);
  }

  async deleteAssignment(id: string): Promise<void> {
    await this.assignmentRepository.delete(id);
  }

  async publishAssignment(id: string, updatedBy: string): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    assignment.isPublished = true;
    assignment.updatedBy = updatedBy;

    return this.assignmentRepository.save(assignment);
  }

  async unpublishAssignment(id: string, updatedBy: string): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    assignment.isPublished = false;
    assignment.updatedBy = updatedBy;

    return this.assignmentRepository.save(assignment);
  }

  // Grade methods
  async createGrade(
    assignmentId: string,
    enrollmentId: string,
    pointsAchieved: number,
    feedback: string,
    gradedBy: string,
    isFinal: boolean,
  ): Promise<Grade> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new ApiNotFoundError('Assignment not found');
    }

    this.ensureValidAutomaticGradePoints(
      pointsAchieved,
      this.ensureValidAssignmentMaxPoints(assignment),
    );

    const grade = new Grade();
    grade.pointsAchieved = pointsAchieved;
    grade.feedback = feedback;
    grade.gradedBy = gradedBy;
    grade.gradedAt = new Date();
    grade.isFinal = isFinal;
    grade.updatedBy = gradedBy;

    grade.assignment = assignment;

    // Set the enrollment relation
    const enrollment = new Enrollment();
    enrollment.id = enrollmentId;
    grade.enrollment = enrollment;

    return this.gradeRepository.save(grade);
  }

  async getGradesByAssignment(assignmentId: string): Promise<Grade[]> {
    return this.gradeRepository.find({
      where: { assignment: { id: assignmentId } },
      relations: ['enrollment', 'assignment'],
    });
  }

  async getGradesByEnrollment(enrollmentId: string): Promise<Grade[]> {
    return this.gradeRepository.find({
      where: { enrollment: { id: enrollmentId } },
      relations: ['assignment'],
    });
  }

  async getGradeById(id: string): Promise<Grade> {
    return this.gradeRepository.findOne({
      where: { id },
      relations: ['enrollment', 'assignment'],
    });
  }

  async updateGrade(
    id: string,
    pointsAchieved: number,
    feedback: string,
    gradedBy: string,
    isFinal: boolean,
    updatedBy: string,
  ): Promise<Grade> {
    const grade = await this.gradeRepository.findOne({
      where: { id },
      relations: ['assignment'],
    });

    if (!grade) {
      throw new ApiNotFoundError('Grade not found');
    }

    const assignment = grade.assignment
      ? grade.assignment
      : await this.assignmentRepository.findOne({
          where: { id: (grade as any).assignmentId },
        });

    if (!assignment) {
      throw new ApiNotFoundError('Assignment not found');
    }

    this.ensureValidAutomaticGradePoints(
      pointsAchieved,
      this.ensureValidAssignmentMaxPoints(assignment),
    );

    grade.pointsAchieved = pointsAchieved;
    grade.feedback = feedback;
    grade.gradedBy = gradedBy;
    grade.gradedAt = new Date();
    grade.isFinal = isFinal;
    grade.updatedBy = updatedBy;

    return this.gradeRepository.save(grade);
  }

  async deleteGrade(id: string): Promise<void> {
    await this.gradeRepository.delete(id);
  }

  async calculateCourseGrade(courseId: string, enrollmentId: string): Promise<{ grade: number; passed: boolean }> {
    // Get all assignments for the course
    const assignments = await this.assignmentRepository.find({
      where: { course: { id: courseId }, isGraded: true },
    });

    if (assignments.length === 0) {
      throw new Error('No graded assignments found for this course');
    }

    // Get all grades for the enrollment
    const grades = await this.gradeRepository.find({
      where: { enrollment: { id: enrollmentId } },
      relations: ['assignment'],
    });

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const assignment of assignments) {
      const grade = grades.find(g => g.assignment.id === assignment.id);

      if (grade && grade.isFinal) {
        const maxPoints = this.ensureValidAssignmentMaxPoints(assignment);

        if (maxPoints === 0) {
          continue;
        }

        const pointsAchieved = this.ensureValidAutomaticGradePoints(
          grade.pointsAchieved,
          maxPoints,
        );
        const percentage = pointsAchieved / maxPoints;
        totalWeightedScore += percentage * assignment.weight;
        totalWeight += assignment.weight;
      }
    }

    if (totalWeight === 0) {
      throw new Error('No valid grades found for calculation');
    }

    const finalGrade = totalWeightedScore / totalWeight;
    const passed =
      calculateCoursePassStatus(finalGrade * 100) === CoursePassStatus.PASSED;

    return { grade: finalGrade, passed };
  }

  async getCoursePerformance(courseId: string): Promise<any> {
    // Get all enrollments for the course
    const enrollments = await this.enrollmentRepository.find({
      where: { courseId: courseId },
    });

    const performanceData = [];

    for (const enrollment of enrollments) {
      try {
        const result = await this.calculateCourseGrade(courseId, enrollment.id);
        performanceData.push({
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          grade: result.grade,
          passed: result.passed,
        });
      } catch (error) {
        performanceData.push({
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          grade: null,
          passed: false,
          error: error.message,
        });
      }
    }

    return performanceData;
  }

  async listCourseVersions(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseVersionResponseDto[]> {
    await this.assertCourseVersionReadable(courseId, actorUserId);
    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);

    return this.listCourseVersionsByRun(courseId, currentRun.id, actorUserId);
  }

  async listCourseVersionsByRun(
    courseId: string,
    runId: string,
    actorUserId?: string | number,
  ): Promise<CourseVersionResponseDto[]> {
    await this.assertCourseRunManageable(courseId, runId, actorUserId);
    await this.getActiveCourseVersionForRunOrThrow(this.toCourseId(courseId), runId);

    const versions = await this.courseVersionRepository.find({
      where: {
        course_id: this.toCourseId(courseId),
        course_run_id: runId,
        status: Not(CourseVersionStatus.ARCHIVED),
      },
      order: {
        version_number: 'DESC',
      },
      relations: ['courseRun', 'sourceVersion', 'sourceVersion.courseRun'],
    });

    return Promise.all(
      versions.map((version) => this.mapCourseVersionWithTemplateInfo(version)),
    );
  }

  async listCourseVersionTemplates(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseVersionResponseDto[]> {
    await this.assertCoursePermission(
      courseId,
      actorUserId,
      CoursePermission.ManageCourseContent,
    );

    const versions = await this.courseVersionRepository.find({
      where: {
        course_id: this.toCourseId(courseId),
        status: Not(CourseVersionStatus.ARCHIVED),
      },
      order: {
        version_number: 'DESC',
      },
      relations: ['courseRun', 'sourceVersion', 'sourceVersion.courseRun'],
    });
    const versionsWithRunInfo = await Promise.all(
      versions.map((version) => this.hydrateCourseVersionTemplateInfo(version)),
    );

    return versionsWithRunInfo
      .sort((left, right) => {
        const leftRunDate = left.courseRun?.startDate ?? left.courseRun?.createdAt?.toISOString() ?? '';
        const rightRunDate = right.courseRun?.startDate ?? right.courseRun?.createdAt?.toISOString() ?? '';
        const runComparison = rightRunDate.localeCompare(leftRunDate);

        return runComparison !== 0
          ? runComparison
          : right.version_number - left.version_number;
      })
      .map(mapCourseVersionToDto);
  }

  async getCourseVersion(
    courseId: string,
    versionId: string,
    actorUserId?: string | number,
  ): Promise<CourseVersionResponseDto> {
    await this.assertCourseVersionReadable(courseId, actorUserId);

    const version = await this.courseVersionRepository.findOne({
      where: {
        id: versionId,
        course_id: this.toCourseId(courseId),
        status: Not(CourseVersionStatus.ARCHIVED),
      },
      relations: ['courseRun', 'sourceVersion', 'sourceVersion.courseRun'],
    });

    if (!version) {
      throw new ApiNotFoundError('Course version not found', 'COURSE_NOT_FOUND');
    }

    return this.mapCourseVersionWithTemplateInfo(version);
  }

  async createCourseVersion(
    courseId: string,
    body: CreateCourseVersionDto = {},
    actorUserId?: string | number,
  ): Promise<CourseVersionResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourse,
    );

    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);

    return this.createCourseVersionForRun(courseId, currentRun.id, body, actorId);
  }

  async createCourseVersionForRun(
    courseId: string,
    runId: string,
    body: CreateCourseVersionDto = {},
    actorUserId?: string | number,
  ): Promise<CourseVersionResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourse,
    );

    const course = await this.findCourseOrThrow(courseId);
    const run = await this.assertCourseRunManageable(courseId, runId, actorId);
    const existingVersions = await this.courseVersionRepository.find({
      where: {
        course_id: course.id,
        course_run_id: run.id,
        status: Not(CourseVersionStatus.ARCHIVED),
      },
      order: {
        version_number: 'DESC',
      },
      relations: ['courseRun', 'sourceVersion', 'sourceVersion.courseRun'],
    });
    const copyMode = String(
      body.copyMode ?? (body.sourceVersionId ? 'SOURCE' : 'ACTIVE'),
    ).toUpperCase();

    if (!['ACTIVE', 'SOURCE', 'EMPTY'].includes(copyMode)) {
      throw new ApiValidationError('Invalid course version copy mode');
    }

    if (copyMode === 'SOURCE' && !body.sourceVersionId) {
      throw new ApiValidationError('Eine Quellversion ist erforderlich.');
    }

    const sourceVersion = copyMode === 'EMPTY'
      ? null
      : body.sourceVersionId
        ? await this.findCourseVersionTemplateOrThrow(course.id, body.sourceVersionId)
        : existingVersions.find((version) => version.is_active) ?? existingVersions[0] ?? null;
    const activate = body.activate === true || !existingVersions.some((version) => version.is_active);

    if (sourceVersion && sourceVersion.course_id !== course.id) {
      throw new ApiValidationError(
        'Die ausgewählte Inhaltsvorlage gehört nicht zu diesem Kurs.',
      );
    }

    if (activate && existingVersions.length > 0) {
      existingVersions.forEach((version) => {
        version.is_active = false;
      });
      await this.courseVersionRepository.save(existingVersions);
    }

    const version = new CourseVersion();
    version.course_id = course.id;
    version.course = course;
    version.course_run_id = run.id;
    version.courseRun = run;
    version.version_number = await this.getNextCourseVersionNumber(run.id);
    version.label = this.normalizeChangeSummary(body.label) ?? `Version ${version.version_number}`;
    version.content = {};
    version.change_summary = this.normalizeChangeSummary(
      body.changeSummary ?? body.change_summary,
    );
    version.status = CourseVersionStatus.PUBLISHED;
    version.sourceVersionId = sourceVersion?.id ?? null;
    version.created_by = actorId;
    version.is_active = activate;

    const savedVersion = await this.courseVersionRepository.save(version);

    if (sourceVersion) {
      await this.copyCourseVersionContentToRun(
        sourceVersion,
        run,
        actorId,
        savedVersion,
      );
    }

    await this.refreshCourseVersionContent(savedVersion.id);

    return this.mapCourseVersionWithTemplateInfo(
      await this.courseVersionRepository.findOne({
        where: { id: savedVersion.id },
        relations: ['courseRun', 'sourceVersion', 'sourceVersion.courseRun'],
      }) ?? savedVersion,
    );
  }

  async activateCourseVersion(
    courseId: string,
    versionId: string,
    actorUserId?: string | number,
  ): Promise<CourseVersionResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourse,
    );

    return this.mapCourseVersionWithTemplateInfo(
      await this.setActiveCourseVersion(
        this.toCourseId(courseId),
        versionId,
      ),
    );
  }

  async activateCourseVersionForRun(
    courseId: string,
    runId: string,
    versionId: string,
    actorUserId?: string | number,
  ): Promise<CourseVersionResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourse,
    );
    await this.findCourseVersionInRunOrThrow(
      this.toCourseId(courseId),
      runId,
      versionId,
    );

    return this.activateCourseVersion(courseId, versionId, actorId);
  }

  async deleteCourseVersion(
    courseId: string,
    runId: string,
    versionId: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const actorId = this.requireActorUserId(actorUserId);
    const run = await this.assertCourseRunManageable(courseId, runId, actorId);

    if (run.status === CourseRunStatus.ARCHIVED) {
      throw new ApiValidationError(
        'Versionen archivierter Kursdurchläufe können nicht gelöscht werden.',
      );
    }

    const version = await this.courseVersionRepository.findOne({
      where: {
        id: versionId,
        course_id: this.toCourseId(courseId),
        course_run_id: run.id,
        status: Not(CourseVersionStatus.ARCHIVED),
      },
    });

    if (!version) {
      throw new ApiNotFoundError('Course version not found', 'COURSE_NOT_FOUND');
    }

    if (version.is_active) {
      throw new ApiValidationError(
        'Diese Version kann nicht gelöscht werden, da sie die aktive Version des Durchlaufs ist.',
      );
    }

    const versionsInRun = await this.courseVersionRepository.find({
      where: {
        course_id: this.toCourseId(courseId),
        course_run_id: run.id,
        status: Not(CourseVersionStatus.ARCHIVED),
      },
    });

    if (versionsInRun.length <= 1) {
      throw new ApiValidationError(
        'Diese Version kann nicht gelöscht werden, da sie die einzige Version des Durchlaufs ist.',
      );
    }

    const referencingVersions = await this.courseVersionRepository.find({
      where: {
        sourceVersionId: version.id,
      },
    });

    if (referencingVersions.length > 0) {
      throw new ApiValidationError(
        'Diese Version kann nicht gelöscht werden, da ein späterer Durchlauf auf ihr basiert.',
      );
    }

    const versionTasks = await this.taskRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
        courseVersionId: version.id,
      },
    });

    if (versionTasks.length > 0) {
      const progressCount = await this.taskProgressRepository.count({
        where: {
          taskId: In(versionTasks.map((task) => task.id)),
        },
      });

      if (progressCount > 0) {
        throw new ApiValidationError(
          'Diese Version kann nicht gelöscht werden, da sie Lernfortschritt enthält.',
        );
      }
    }

    await this.courseVersionRepository.delete(version.id);
  }

  async listCourseRuns(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseRunResponseDto[]> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );
    const runs = await this.courseRunRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
      },
      order: {
        startDate: 'DESC',
        createdAt: 'DESC',
      },
    });

    return Promise.all(runs.map((run) => this.mapCourseRunWithCounts(run)));
  }

  async getCurrentCourseRun(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseRunResponseDto> {
    const run = await this.getCurrentCourseRunOrCreate(courseId);
    await this.assertCourseRunReadable(this.toCourseId(courseId), run.id, actorUserId);

    return this.mapCourseRunWithCounts(run);
  }

  async getCourseRun(
    courseId: string,
    runId: string,
    actorUserId?: string | number,
  ): Promise<CourseRunResponseDto> {
    await this.assertCourseRunReadable(this.toCourseId(courseId), runId, actorUserId);
    const run = await this.courseRunRepository.findOne({
      where: {
        id: runId,
        courseId: this.toCourseId(courseId),
      },
    });

    if (!run) {
      throw new ApiNotFoundError('Course run not found', 'COURSE_RUN_NOT_FOUND');
    }

    return this.mapCourseRunWithCounts(run);
  }

  async getCourseRunPlan(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseRunPlanResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourse,
    );

    const course = await this.findCourseOrThrow(courseId);
    const currentRun = await this.getCurrentCourseRunOrCreate(course.id);
    const nextRun = this.calculatePlannedNextRunFields(course, currentRun);
    const templateVersion = await this.resolveCourseRunTemplateVersion(
      course,
      currentRun,
    );

    return {
      recurrenceType: course.recurrenceType ?? CourseRecurrenceType.CONTINUOUS,
      currentRun: await this.mapCourseRunWithCounts(currentRun),
      nextRun,
      templateStrategy: this.normalizeCourseRunTemplateStrategy(
        course.contentTemplateStrategy,
      ),
      templateVersion: templateVersion
        ? await this.mapCourseVersionWithTemplateInfo(templateVersion)
        : null,
      regularPlanningAvailable: nextRun !== null,
    };
  }

  async updateCourseRunPlanTemplate(
    courseId: string,
    body: UpdateCourseRunPlanTemplateDto = {},
    actorUserId?: string | number,
  ): Promise<CourseRunPlanResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourse,
    );

    const course = await this.findCourseOrThrow(courseId);
    const strategy = this.normalizeCourseRunTemplateStrategy(
      body.strategy ?? body.contentTemplateStrategy,
    );
    const sourceVersionId = body.sourceVersionId ?? body.plannedSourceVersionId ?? null;

    if (strategy === CourseRunTemplateStrategy.SPECIFIC_VERSION) {
      if (!sourceVersionId) {
        throw new ApiValidationError(
          'Für eine konkrete Inhaltsvorlage muss eine CourseVersion ausgewählt werden.',
        );
      }

      const sourceVersion = await this.findCourseVersionTemplateOrThrow(
        course.id,
        sourceVersionId,
      );
      course.plannedSourceVersionId = sourceVersion.id;
    } else {
      course.plannedSourceVersionId = null;
    }

    course.contentTemplateStrategy = strategy;
    await this.coursesRepository.save(course);

    return this.getCourseRunPlan(course.id, actorId);
  }

  private async createCourseRunFromTemplate(
    course: Course,
    previousRun: CourseRun,
    fields: {
      label: string;
      startDate?: string;
      endDate?: string;
    },
    sourceVersion: CourseVersion | null,
    body: CreateCourseRunDto,
    actorId: string,
  ): Promise<CourseRunResponseDto> {
    const sourceRunId = sourceVersion?.course_run_id ?? previousRun.id;
    const activate = body.activate === true;
    const run = new CourseRun();
    run.courseId = course.id;
    run.course = course;
    run.label = fields.label;
    run.startDate = fields.startDate;
    run.endDate = fields.endDate;
    run.status = this.normalizeCourseRunStatus(body.status) ?? previousRun.status;
    run.sourceRunId = sourceRunId;
    run.isActive = false;
    run.createdBy = actorId;

    const savedRun = await this.courseRunRepository.save(run);
    const targetVersion = await this.createInitialContentVersionForRun(
      course,
      savedRun,
      actorId,
      `Initiale Inhaltsversion fuer ${savedRun.label}`,
      sourceVersion?.id,
    );

    if (sourceVersion) {
      await this.copyCourseVersionContentToRun(
        sourceVersion,
        savedRun,
        actorId,
        targetVersion,
      );
    }

    await this.refreshCourseVersionContent(targetVersion.id);

    if (activate) {
      await this.setActiveCourseRun(course.id, savedRun.id);
    }

    const reloadedRun = await this.courseRunRepository.findOne({
      where: {
        id: savedRun.id,
      },
    });

    return this.mapCourseRunWithCounts(reloadedRun ?? savedRun);
  }

  async createCourseRun(
    courseId: string,
    body: CreateCourseRunDto = {},
    actorUserId?: string | number,
  ): Promise<CourseRunResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourse,
    );

    const course = await this.findCourseOrThrow(courseId);
    const currentRun = await this.getCurrentCourseRunOrCreate(course.id);
    const fields = this.calculatePlannedNextRunFields(course, currentRun);

    if (!fields) {
      throw new ApiValidationError(
        'Dauerhafte Kurse haben keinen automatisch geplanten nächsten Durchlauf.',
      );
    }

    await this.assertPlannedRunDoesNotExist(course.id, fields);

    const sourceVersion = await this.resolveCourseRunTemplateVersion(
      course,
      currentRun,
      body.sourceVersionId,
    );

    return this.createCourseRunFromTemplate(
      course,
      currentRun,
      fields,
      sourceVersion,
      body,
      actorId,
    );
  }

  async createSpecialCourseRun(
    courseId: string,
    body: CreateCourseRunDto = {},
    actorUserId?: string | number,
  ): Promise<CourseRunResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourse,
    );

    const course = await this.findCourseOrThrow(courseId);
    const currentRun = await this.getCurrentCourseRunOrCreate(course.id);
    const fields = this.calculateSpecialRunFields(body);
    await this.assertPlannedRunDoesNotExist(course.id, fields);
    const sourceVersion = await this.resolveCourseRunTemplateVersion(
      course,
      currentRun,
      body.sourceVersionId,
    );

    return this.createCourseRunFromTemplate(
      course,
      currentRun,
      fields,
      sourceVersion,
      body,
      actorId,
    );
  }

  async activateCourseRun(
    courseId: string,
    runId: string,
    actorUserId?: string | number,
  ): Promise<CourseRunResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourse,
    );

    return this.mapCourseRunWithCounts(
      await this.setActiveCourseRun(this.toCourseId(courseId), runId),
    );
  }

  async deleteOrArchiveCourseRun(
    courseId: string,
    runId: string,
    actorUserId?: string | number,
  ): Promise<CourseRunDeletionResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourse,
    );
    const normalizedCourseId = this.toCourseId(courseId);
    const run = await this.courseRunRepository.findOne({
      where: {
        id: runId,
        courseId: normalizedCourseId,
      },
    });

    if (!run) {
      throw new ApiNotFoundError('Course run not found', 'COURSE_RUN_NOT_FOUND');
    }

    if (run.isActive) {
      throw new ApiValidationError(
        'Der aktive Kursdurchlauf kann nicht gelöscht oder archiviert werden. Aktiviere zuerst einen anderen Durchlauf.',
      );
    }

    const allRuns = await this.courseRunRepository.find({
      where: {
        courseId: normalizedCourseId,
      },
    });

    if (allRuns.length <= 1) {
      throw new ApiValidationError('Der letzte verbleibende Kursdurchlauf kann nicht gelöscht werden.');
    }

    const [enrollments, tasks, materials, assignments, results] = await Promise.all([
      this.enrollmentRepository.find({ where: { courseRunId: run.id } }),
      this.taskRepository.find({ where: { courseRunId: run.id } }),
      this.learningMaterialRepository.find({ where: { courseRunId: run.id } }),
      this.assignmentRepository.find({ where: { courseRunId: run.id } }),
      this.courseResultRepository.find({ where: { courseRunId: run.id } }),
    ]);
    const progressRecords = tasks.length > 0
      ? await this.taskProgressRepository.find({
        where: {
          taskId: In(tasks.map((task) => task.id)),
        },
      })
      : [];
    const mustArchive =
      enrollments.length > 0 ||
      progressRecords.length > 0 ||
      assignments.length > 0 ||
      results.length > 0;

    if (mustArchive) {
      run.status = CourseRunStatus.ARCHIVED;
      run.isActive = false;
      const archivedRun = await this.courseRunRepository.save(run);

      return {
        action: 'ARCHIVED',
        reason: 'Der Durchlauf enthält Teilnehmer, Fortschritt, Bewertungen oder Abgaben und wurde deshalb archiviert.',
        run: await this.mapCourseRunWithCounts(archivedRun),
      };
    }

    await this.deleteUnreferencedMaterialFilesForRun(run, materials);
    await this.courseRunRepository.delete(run.id);

    return {
      action: 'DELETED',
      reason: 'Der leere inaktive Durchlauf wurde gelöscht.',
    };
  }

  private async deleteUnreferencedMaterialFilesForRun(
    run: CourseRun,
    materials: LearningMaterial[],
  ): Promise<void> {
    const storageKeys = new Set(
      materials
        .map((material) => material.storageKey)
        .filter((storageKey): storageKey is string => Boolean(storageKey)),
    );

    for (const storageKey of storageKeys) {
      const references = await this.learningMaterialRepository.find({
        where: {
          courseId: run.courseId,
          storageKey,
        },
      });
      const isReferencedByAnotherRun = references.some(
        (reference) => reference.courseRunId !== run.id,
      );

      if (!isReferencedByAnotherRun) {
        await this.materialStorage.deleteFile(run.courseId, storageKey);
      }
    }
  }

  // Task and learning process methods
  private async initializeImmediateTaskProgressForEnrollment(
    courseId: string,
    enrollment: Enrollment,
    actorId: string,
  ): Promise<void> {
    const activeVersion = enrollment.courseRunId
      ? await this.getActiveCourseVersionForRunOrThrow(courseId, enrollment.courseRunId)
      : null;
    const immediateTasks = await this.taskRepository.find({
      where: {
        courseId,
        courseRunId: enrollment.courseRunId,
        ...(activeVersion ? { courseVersionId: activeVersion.id } : {}),
        isPublished: true,
        unlockMode: TaskUnlockMode.IMMEDIATE,
      },
      order: {
        order: 'ASC',
      },
    });

    for (const task of immediateTasks) {
      await this.ensureTaskProgress(task, enrollment, actorId);
    }
  }

  private normalizeTaskUnlockMode(
    unlockMode: unknown,
    defaultMode = TaskUnlockMode.IMMEDIATE,
  ): TaskUnlockMode {
    if (unlockMode === undefined || unlockMode === null || unlockMode === '') {
      return defaultMode;
    }

    const normalizedMode = String(unlockMode).toUpperCase() as TaskUnlockMode;

    if (!Object.values(TaskUnlockMode).includes(normalizedMode)) {
      throw new ApiValidationError('Invalid task unlock mode');
    }

    return normalizedMode;
  }

  private parseTaskOrder(order: unknown): number {
    if (order === undefined || order === null || order === '') {
      return 0;
    }

    const parsedOrder = Number(order);

    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      throw new ApiValidationError('Task order must be a non-negative integer');
    }

    return parsedOrder;
  }

  private requireTaskTitle(title: unknown): string {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new ApiValidationError('Task title is required', [
        'title must not be empty',
      ]);
    }

    return title.trim();
  }

  private normalizeTaskPrerequisite(
    prerequisiteTaskId: unknown,
  ): string | undefined {
    if (
      prerequisiteTaskId === undefined ||
      prerequisiteTaskId === null ||
      prerequisiteTaskId === ''
    ) {
      return undefined;
    }

    return String(prerequisiteTaskId);
  }

  private async findLearningTaskOrThrow(taskId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new ApiNotFoundError('Task not found', 'TASK_NOT_FOUND');
    }

    return task;
  }

  private async assertTaskReadable(
    task: Task,
    actorUserId?: string | number,
  ): Promise<CourseMemberRole> {
    const role = await this.assertCoursePermission(
      task.courseId,
      actorUserId,
      CoursePermission.ReadCourseContent,
    );

    if (
      !hasCoursePermission(role, CoursePermission.ManageCourseContent) &&
      !task.isPublished
    ) {
      throw new ApiForbiddenError('Task is not published', 'TASK_ACCESS_DENIED');
    }

    if (!hasCoursePermission(role, CoursePermission.ManageCourseContent)) {
      const { run: currentRun, version } =
        await this.getActiveCourseVersionForCurrentRunOrThrow(task.courseId);

      if (task.courseRunId !== currentRun.id || task.courseVersionId !== version.id) {
        throw new ApiForbiddenError(
          'Task is not available in the active content version',
          'TASK_ACCESS_DENIED',
        );
      }
    }

    return role;
  }

  private async assertTaskManageable(
    task: Task,
    actorUserId?: string | number,
  ): Promise<void> {
    await this.assertCoursePermission(
      task.courseId,
      actorUserId,
      CoursePermission.ManageCourseContent,
    );
  }

  private async findStudentEnrollmentOrThrow(
    courseId: string,
    studentId: string | number,
  ): Promise<Enrollment> {
    const enrollment = await this.findCourseEnrollment(courseId, studentId);

    if (!enrollment || enrollment.role !== CourseMemberRole.STUDENT) {
      throw new ApiForbiddenError(
        'Student is not enrolled in this course',
        'COURSE_ACCESS_DENIED',
      );
    }

    return enrollment;
  }

  private async assertCurrentStudentEnrollment(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<Enrollment> {
    const actorId = this.requireActorUserId(actorUserId);
    const enrollment = await this.findStudentEnrollmentOrThrow(courseId, actorId);

    return enrollment;
  }

  private async validateTaskConfiguration(
    courseId: string,
    taskId: string | undefined,
    unlockMode: TaskUnlockMode,
    prerequisiteTaskId?: string,
    courseVersionId?: string,
  ): Promise<void> {
    if (unlockMode === TaskUnlockMode.IMMEDIATE && prerequisiteTaskId) {
      throw new ApiValidationError('Immediately available tasks cannot define a prerequisite');
    }

    if (unlockMode === TaskUnlockMode.AUTOMATIC && !prerequisiteTaskId) {
      throw new ApiValidationError('Automatically unlocked tasks require a prerequisite');
    }

    if (!prerequisiteTaskId) {
      return;
    }

    if (taskId && prerequisiteTaskId === taskId) {
      throw new ApiValidationError('A task cannot depend on itself');
    }

    const prerequisite = await this.taskRepository.findOne({
      where: { id: prerequisiteTaskId },
    });

    if (
      !prerequisite ||
      prerequisite.courseId !== courseId ||
      (courseVersionId && prerequisite.courseVersionId !== courseVersionId)
    ) {
      throw new ApiValidationError(
        'Prerequisite task must belong to the same content version',
      );
    }

    const visitedTaskIds = new Set<string>();
    let currentTaskId: string | undefined = prerequisiteTaskId;

    while (currentTaskId) {
      if (taskId && currentTaskId === taskId) {
        throw new ApiValidationError('Cyclic task prerequisites are not allowed');
      }

      if (visitedTaskIds.has(currentTaskId)) {
        throw new ApiValidationError('Cyclic task prerequisites are not allowed');
      }

      visitedTaskIds.add(currentTaskId);

      const currentTask = await this.taskRepository.findOne({
        where: { id: currentTaskId },
      });

      if (!currentTask) {
        return;
      }

      if (
        currentTask.courseId !== courseId ||
        (courseVersionId && currentTask.courseVersionId !== courseVersionId)
      ) {
        throw new ApiValidationError(
          'Prerequisite task must belong to the same content version',
        );
      }

      currentTaskId = currentTask.prerequisiteTaskId;
    }
  }

  private async isTaskPrerequisiteCompleted(
    task: Task,
    enrollmentId: string,
  ): Promise<boolean> {
    if (!task.prerequisiteTaskId) {
      return false;
    }

    const prerequisiteProgress = await this.taskProgressRepository.findOne({
      where: {
        taskId: task.prerequisiteTaskId,
        enrollmentId,
      },
    });

    return prerequisiteProgress?.status === TaskProgressStatus.COMPLETED;
  }

  private async isTaskEligibleByRules(
    task: Task,
    enrollmentId: string,
  ): Promise<boolean> {
    if (task.unlockMode === TaskUnlockMode.IMMEDIATE) {
      return true;
    }

    if (task.unlockMode === TaskUnlockMode.AUTOMATIC) {
      return this.isTaskPrerequisiteCompleted(task, enrollmentId);
    }

    return false;
  }

  private isMutableAvailableProgress(progress: TaskProgress): boolean {
    return progress.status === TaskProgressStatus.AVAILABLE;
  }

  private assignTaskProgressRelations(
    progress: TaskProgress,
    task: Task,
    enrollment: Enrollment,
  ): void {
    progress.task = task;
    progress.taskId = task.id;
    progress.enrollment = enrollment;
    progress.enrollmentId = enrollment.id;
  }

  private async findTaskProgress(
    taskId: string,
    enrollmentId: string,
  ): Promise<TaskProgress | null> {
    return this.taskProgressRepository.findOne({
      where: {
        taskId,
        enrollmentId,
      },
    });
  }

  private async createLockedTaskProgress(
    task: Task,
    enrollment: Enrollment,
    createdBy: string,
  ): Promise<TaskProgress> {
    const progress = new TaskProgress();
    progress.status = TaskProgressStatus.LOCKED;
    progress.completionPercentage = 0;
    progress.progressData = {};
    progress.createdBy = createdBy;
    progress.updatedBy = createdBy;
    this.assignTaskProgressRelations(progress, task, enrollment);

    return this.taskProgressRepository.save(progress);
  }

  private async ensureTaskProgress(
    task: Task,
    enrollment: Enrollment,
    updatedBy = 'system',
  ): Promise<TaskProgress> {
    let progress = await this.findTaskProgress(task.id, enrollment.id);

    if (!progress) {
      progress = await this.createLockedTaskProgress(task, enrollment, updatedBy);
    } else {
      this.assignTaskProgressRelations(progress, task, enrollment);
    }

    const eligibleByRules = await this.isTaskEligibleByRules(task, enrollment.id);

    if (progress.status === TaskProgressStatus.LOCKED && eligibleByRules) {
      progress.status = TaskProgressStatus.AVAILABLE;
      progress.completionPercentage = 0;
      progress.unlockedAt = progress.unlockedAt ?? new Date();
      progress.unlockSource =
        task.unlockMode === TaskUnlockMode.AUTOMATIC
          ? TaskUnlockSource.AUTOMATIC
          : TaskUnlockSource.IMMEDIATE;
      progress.updatedBy = updatedBy;

      return this.taskProgressRepository.save(progress);
    }

    if (
      this.isMutableAvailableProgress(progress) &&
      task.unlockMode === TaskUnlockMode.MANUAL &&
      progress.unlockSource !== TaskUnlockSource.MANUAL
    ) {
      progress.status = TaskProgressStatus.LOCKED;
      progress.completionPercentage = 0;
      progress.unlockedAt = undefined;
      progress.unlockSource = undefined;
      progress.updatedBy = updatedBy;

      return this.taskProgressRepository.save(progress);
    }

    if (
      this.isMutableAvailableProgress(progress) &&
      task.unlockMode !== TaskUnlockMode.MANUAL &&
      !eligibleByRules
    ) {
      progress.status = TaskProgressStatus.LOCKED;
      progress.completionPercentage = 0;
      progress.unlockedAt = undefined;
      progress.unlockSource = undefined;
      progress.updatedBy = updatedBy;

      return this.taskProgressRepository.save(progress);
    }

    return progress;
  }

  private async getTaskLockedReason(
    task: Task,
    progress: TaskProgress | null,
    tasksById: Map<string, Task>,
  ): Promise<string | undefined> {
    if (progress && progress.status !== TaskProgressStatus.LOCKED) {
      return undefined;
    }

    if (task.unlockMode === TaskUnlockMode.MANUAL) {
      return 'Diese Aufgabe muss durch eine Lehrperson freigeschaltet werden.';
    }

    if (task.unlockMode === TaskUnlockMode.AUTOMATIC && task.prerequisiteTaskId) {
      const prerequisite =
        tasksById.get(task.prerequisiteTaskId) ??
        (await this.taskRepository.findOne({
          where: { id: task.prerequisiteTaskId },
        }));
      const title = prerequisite?.title ?? 'die vorherige Aufgabe';

      return `Diese Aufgabe wird freigeschaltet, sobald "${title}" erfolgreich abgeschlossen wurde.`;
    }

    return undefined;
  }

  private countTaskProgress(
    tasks: StudentLearningTaskResponseDto[],
  ): Omit<LearningPathResponseDto, 'courseId' | 'studentId' | 'tasks'> {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (task) => task.status === TaskProgressStatus.COMPLETED,
    ).length;
    const inProgressTasks = tasks.filter(
      (task) => task.status === TaskProgressStatus.IN_PROGRESS,
    ).length;
    const availableTasks = tasks.filter(
      (task) => task.status === TaskProgressStatus.AVAILABLE,
    ).length;
    const failedTasks = tasks.filter(
      (task) => task.status === TaskProgressStatus.FAILED,
    ).length;
    const lockedTasks = tasks.filter(
      (task) => task.status === TaskProgressStatus.LOCKED,
    ).length;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      availableTasks,
      failedTasks,
      lockedTasks,
      progressPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }

  private async buildLearningPathForEnrollment(
    courseId: string,
    enrollment: Enrollment,
    includeUnpublished = false,
  ): Promise<LearningPathResponseDto> {
    const runId = enrollment.courseRunId ?? (await this.getCurrentCourseRunOrCreate(courseId)).id;
    const activeVersion = await this.getActiveCourseVersionForRunOrThrow(
      courseId,
      runId,
    );
    const tasks = await this.taskRepository.find({
      where: {
        courseId,
        courseRunId: runId,
        courseVersionId: activeVersion.id,
      },
      order: { order: 'ASC' },
    });
    const visibleTasks = includeUnpublished
      ? tasks
      : tasks.filter((task) => task.isPublished);
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const taskDtos: StudentLearningTaskResponseDto[] = [];

    for (const task of visibleTasks) {
      const progress = await this.ensureTaskProgress(task, enrollment);
      const lockedReason = await this.getTaskLockedReason(
        task,
        progress,
        tasksById,
      );

      taskDtos.push(mapLearningTaskWithProgressToDto(task, progress, lockedReason));
    }

    return {
      courseId,
      studentId: enrollment.userId,
      ...this.countTaskProgress(taskDtos),
      tasks: taskDtos,
    };
  }

  private async buildStudentProgressOverview(
    courseId: string,
    enrollment: Enrollment,
  ): Promise<StudentProgressOverviewDto> {
    const learningPath = await this.buildLearningPathForEnrollment(
      courseId,
      enrollment,
      true,
    );
    const tasks: LearningTaskProgressDto[] = learningPath.tasks.map((task) =>
      mapTaskProgressToDto(task as unknown as Task, {
        status: task.status,
        completionPercentage: task.completionPercentage,
        unlockedAt: task.unlockedAt ? new Date(task.unlockedAt) : undefined,
        startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        resultPassed: task.resultPassed,
        unlockSource: task.unlockSource,
      } as TaskProgress),
    );

    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.userId,
      totalTasks: learningPath.totalTasks,
      completedTasks: learningPath.completedTasks,
      inProgressTasks: learningPath.inProgressTasks,
      availableTasks: learningPath.availableTasks,
      failedTasks: learningPath.failedTasks,
      lockedTasks: learningPath.lockedTasks,
      progressPercentage: learningPath.progressPercentage,
      tasks,
    };
  }

  private async reconcileTaskProgressAfterConfigurationChange(
    task: Task,
  ): Promise<void> {
    const progressList = await this.taskProgressRepository.find({
      where: { taskId: task.id },
      relations: ['enrollment'],
    });

    for (const progress of progressList) {
      const enrollment = progress.enrollment;

      if (!enrollment) {
        continue;
      }

      await this.ensureTaskProgress(task, enrollment);
    }
  }

  private async unlockEligibleNextTasks(
    completedTask: Task,
    enrollment: Enrollment,
  ): Promise<void> {
    const nextTasks = await this.taskRepository.find({
      where: {
        courseId: completedTask.courseId,
        courseRunId: completedTask.courseRunId,
        ...(completedTask.courseVersionId ? { courseVersionId: completedTask.courseVersionId } : {}),
        prerequisiteTaskId: completedTask.id,
        unlockMode: TaskUnlockMode.AUTOMATIC,
      },
      order: { order: 'ASC' },
    });

    for (const nextTask of nextTasks) {
      if (!nextTask.isPublished) {
        continue;
      }

      await this.ensureTaskProgress(nextTask, enrollment);
    }
  }

  async createLearningTask(
    courseId: string | number,
    body: CreateLearningTaskDto,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );
    await this.findCourseOrThrow(normalizedCourseId);
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(normalizedCourseId);

    const unlockMode = this.normalizeTaskUnlockMode(body?.unlockMode);
    const prerequisiteTaskId = this.normalizeTaskPrerequisite(
      body?.prerequisiteTaskId,
    );

    await this.validateTaskConfiguration(
      normalizedCourseId,
      undefined,
      unlockMode,
      prerequisiteTaskId,
      version.id,
    );

    const task = new Task();
    task.courseId = normalizedCourseId;
    task.course = { id: normalizedCourseId } as Course;
    task.courseRunId = currentRun.id;
    task.courseRun = currentRun;
    task.courseVersionId = version.id;
    task.courseVersion = version;
    task.title = this.requireTaskTitle(body?.title);
    task.description = String(body?.description ?? '').trim();
    task.type = String(body?.type ?? 'DEMO_TASK').trim() || 'DEMO_TASK';
    task.order = this.parseTaskOrder(body?.order);
    task.unlockMode = unlockMode;
    task.prerequisiteTaskId = prerequisiteTaskId;
    task.completionCriteria = body?.completionCriteria ?? {};
    task.isPublished = body?.isPublished === true;
    task.createdBy = actorId;
    task.updatedBy = actorId;

    const savedTask = await this.taskRepository.save(task);
    await this.refreshCourseVersionContent(savedTask.courseVersionId);

    return mapLearningTaskToDto(savedTask);
  }

  async getTasksByCourse(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const role = await this.assertCoursePermission(
      normalizedCourseId,
      actorUserId,
      CoursePermission.ReadCourseContent,
    );
    const canManage = hasCoursePermission(role, CoursePermission.ManageCourseContent);
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(normalizedCourseId);
    const tasks = await this.taskRepository.find({
      where: {
        courseId: normalizedCourseId,
        courseRunId: currentRun.id,
        courseVersionId: version.id,
      },
      order: { order: 'ASC' },
    });

    return tasks
      .filter((task) => canManage || task.isPublished)
      .map(mapLearningTaskToDto);
  }

  async getTasksByCourseRun(
    courseId: string | number,
    runId: string,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const run = await this.assertCourseRunManageable(
      normalizedCourseId,
      runId,
      actorUserId,
    );
    const version = await this.getActiveCourseVersionForRunOrThrow(
      normalizedCourseId,
      run.id,
    );
    const tasks = await this.taskRepository.find({
      where: {
        courseId: normalizedCourseId,
        courseRunId: run.id,
        courseVersionId: version.id,
      },
      order: { order: 'ASC' },
    });

    return tasks.map(mapLearningTaskToDto);
  }

  async getTasksByCourseVersion(
    courseId: string | number,
    runId: string,
    versionId: string,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const run = await this.assertCourseRunManageable(
      normalizedCourseId,
      runId,
      actorUserId,
    );
    const version = await this.findCourseVersionInRunOrThrow(
      normalizedCourseId,
      run.id,
      versionId,
    );
    const tasks = await this.taskRepository.find({
      where: {
        courseId: normalizedCourseId,
        courseRunId: run.id,
        courseVersionId: version.id,
      },
      order: { order: 'ASC' },
    });

    return tasks.map(mapLearningTaskToDto);
  }

  async getTaskById(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    const task = await this.findLearningTaskOrThrow(id);
    await this.assertTaskReadable(task, actorUserId);

    return mapLearningTaskToDto(task);
  }

  async updateLearningTask(
    id: string,
    body: UpdateLearningTaskDto,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const task = await this.findLearningTaskOrThrow(id);
    await this.assertTaskManageable(task, actorId);

    const unlockMode =
      body.unlockMode !== undefined
        ? this.normalizeTaskUnlockMode(body.unlockMode, task.unlockMode)
        : task.unlockMode;
    const prerequisiteTaskId =
      body.prerequisiteTaskId !== undefined
        ? this.normalizeTaskPrerequisite(body.prerequisiteTaskId)
        : task.prerequisiteTaskId;

    await this.validateTaskConfiguration(
      task.courseId,
      task.id,
      unlockMode,
      prerequisiteTaskId,
      task.courseVersionId,
    );

    if (body.title !== undefined) {
      task.title = this.requireTaskTitle(body.title);
    }

    if (body.description !== undefined) {
      task.description = String(body.description ?? '').trim();
    }

    if (body.type !== undefined) {
      task.type = String(body.type ?? '').trim() || task.type;
    }

    if (body.order !== undefined) {
      task.order = this.parseTaskOrder(body.order);
    }

    if (body.completionCriteria !== undefined) {
      task.completionCriteria = body.completionCriteria ?? {};
    }

    if (body.isPublished !== undefined) {
      task.isPublished = body.isPublished === true;
    }

    task.unlockMode = unlockMode;
    task.prerequisiteTaskId = prerequisiteTaskId;
    task.updatedBy = actorId;

    const savedTask = await this.taskRepository.save(task);
    await this.reconcileTaskProgressAfterConfigurationChange(savedTask);
    await this.refreshCourseVersionContent(savedTask.courseVersionId);

    return mapLearningTaskToDto(savedTask);
  }

  async updateLearningTaskReleaseConfig(
    id: string,
    body: UpdateLearningTaskReleaseConfigDto,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    return this.updateLearningTask(
      id,
      {
        unlockMode: body.unlockMode,
        prerequisiteTaskId: body.prerequisiteTaskId,
      },
      actorUserId,
    );
  }

  async updateLearningTaskSortOrder(
    courseId: string | number,
    body: UpdateLearningTaskSortDto,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );

    if (!Array.isArray(body?.items)) {
      throw new ApiValidationError('Sort order items are required');
    }

    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(normalizedCourseId);
    const tasks = await this.taskRepository.find({
      where: {
        courseId: normalizedCourseId,
        courseRunId: currentRun.id,
        courseVersionId: version.id,
        id: In(body.items.map((item) => String(item.id ?? ''))),
      },
    });
    const tasksById = new Map(tasks.map((task) => [task.id, task]));

    for (const item of body.items) {
      if (!item.id || !tasksById.has(item.id)) {
        throw new ApiValidationError('All tasks must belong to the course');
      }

      const task = tasksById.get(item.id);
      task.order = this.parseTaskOrder(item.order);
      task.updatedBy = actorId;
    }

    const savedTasks = await this.taskRepository.save(tasks);
    await this.refreshCourseVersionContent(version.id);

    return savedTasks.sort((a, b) => a.order - b.order).map(mapLearningTaskToDto);
  }

  async deleteTask(
    id: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const task = await this.findLearningTaskOrThrow(id);
    await this.assertTaskManageable(task, actorUserId);

    const dependentTask = await this.taskRepository.findOne({
      where: {
        prerequisiteTaskId: task.id,
        ...(task.courseVersionId ? { courseVersionId: task.courseVersionId } : {}),
      },
    });

    if (dependentTask) {
      throw new ApiValidationError(
        'Task cannot be deleted while another task depends on it',
      );
    }

    await this.taskRepository.delete(id);
    await this.refreshCourseVersionContent(task.courseVersionId);
  }

  async publishTask(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    return this.updateLearningTask(id, { isPublished: true }, actorUserId);
  }

  async unpublishTask(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    return this.updateLearningTask(id, { isPublished: false }, actorUserId);
  }

  async getLearningPathProgress(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const enrollment = await this.assertCurrentStudentEnrollment(
      normalizedCourseId,
      actorUserId,
    );

    return this.buildLearningPathForEnrollment(normalizedCourseId, enrollment);
  }

  async startLearningTask(
    taskId: string,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const task = await this.findLearningTaskOrThrow(taskId);
    await this.assertTaskReadable(task, actorUserId);
    const actorId = this.requireActorUserId(actorUserId);
    const enrollment = await this.assertCurrentStudentEnrollment(
      task.courseId,
      actorId,
    );
    const progress = await this.ensureTaskProgress(task, enrollment, actorId);

    if (progress.status === TaskProgressStatus.LOCKED) {
      throw new ApiForbiddenError('Task is locked', 'TASK_LOCKED');
    }

    if (
      progress.status !== TaskProgressStatus.COMPLETED &&
      progress.status !== TaskProgressStatus.IN_PROGRESS
    ) {
      progress.status = TaskProgressStatus.IN_PROGRESS;
      progress.completionPercentage = 25;
      progress.startedAt = progress.startedAt ?? new Date();
      progress.updatedBy = actorId;
      await this.taskProgressRepository.save(progress);
    }

    return this.buildLearningPathForEnrollment(task.courseId, enrollment);
  }

  async recordTaskResult(
    studentId: string | number,
    taskId: string,
    passed: boolean,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const task = await this.findLearningTaskOrThrow(taskId);
    const normalizedStudentId = this.toUserId(studentId);

    if (actorUserId !== undefined && actorUserId !== null) {
      const actorId = this.requireActorUserId(actorUserId);

      if (actorId !== normalizedStudentId) {
        await this.assertTaskManageable(task, actorId);
      } else {
        await this.assertTaskReadable(task, actorId);
      }
    }

    const enrollment = await this.findStudentEnrollmentOrThrow(
      task.courseId,
      normalizedStudentId,
    );
    const progress = await this.ensureTaskProgress(
      task,
      enrollment,
      actorUserId ? this.toUserId(actorUserId) : 'system',
    );

    if (progress.status === TaskProgressStatus.LOCKED) {
      throw new ApiForbiddenError('Task is locked', 'TASK_LOCKED');
    }

    if (
      passed &&
      progress.status === TaskProgressStatus.COMPLETED &&
      progress.resultPassed === true
    ) {
      await this.unlockEligibleNextTasks(task, enrollment);
      return this.buildLearningPathForEnrollment(task.courseId, enrollment);
    }

    if (
      !passed &&
      progress.status === TaskProgressStatus.FAILED &&
      progress.resultPassed === false
    ) {
      return this.buildLearningPathForEnrollment(task.courseId, enrollment);
    }

    const now = new Date();

    progress.status = passed ? TaskProgressStatus.COMPLETED : TaskProgressStatus.FAILED;
    progress.completionPercentage = passed ? 100 : 0;
    progress.startedAt = progress.startedAt ?? now;
    progress.completedAt = now;
    progress.resultPassed = passed;
    progress.resultRecordedAt = now;
    progress.updatedBy = actorUserId ? this.toUserId(actorUserId) : 'system';

    await this.taskProgressRepository.save(progress);

    if (passed) {
      await this.unlockEligibleNextTasks(task, enrollment);
    }

    return this.buildLearningPathForEnrollment(task.courseId, enrollment);
  }

  async completeLearningTask(
    taskId: string,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    return this.recordTaskResult(actorId, taskId, true, actorId);
  }

  async failLearningTask(
    taskId: string,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    return this.recordTaskResult(actorId, taskId, false, actorId);
  }

  async manuallyUnlockLearningTask(
    taskId: string,
    body: ManualUnlockLearningTaskDto,
    actorUserId?: string | number,
  ): Promise<StudentProgressOverviewDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const studentId = body?.studentId;

    if (studentId === undefined || studentId === null || studentId === '') {
      throw new ApiValidationError('Student ID is required');
    }

    const task = await this.findLearningTaskOrThrow(taskId);
    await this.assertTaskManageable(task, actorId);
    const enrollment = await this.findStudentEnrollmentOrThrow(
      task.courseId,
      studentId,
    );
    const progress = await this.ensureTaskProgress(task, enrollment, actorId);

    if (
      progress.status === TaskProgressStatus.LOCKED ||
      (progress.status === TaskProgressStatus.AVAILABLE &&
        progress.unlockSource !== TaskUnlockSource.MANUAL)
    ) {
      progress.status = TaskProgressStatus.AVAILABLE;
      progress.completionPercentage = 0;
      progress.unlockedAt = progress.unlockedAt ?? new Date();
      progress.unlockSource = TaskUnlockSource.MANUAL;
      progress.updatedBy = actorId;
      await this.taskProgressRepository.save(progress);
    }

    return this.buildStudentProgressOverview(task.courseId, enrollment);
  }

  async getLearningTaskProgressForStudent(
    courseId: string | number,
    studentId: string | number,
    actorUserId?: string | number,
  ): Promise<StudentProgressOverviewDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorUserId,
      CoursePermission.ReadAllResults,
    );
    const enrollment = await this.findStudentEnrollmentOrThrow(
      normalizedCourseId,
      studentId,
    );

    return this.buildStudentProgressOverview(normalizedCourseId, enrollment);
  }

  private async buildLearningTaskProgressOverviewForRun(
    courseId: string,
    runId: string,
  ): Promise<StudentProgressOverviewDto[]> {
    const enrollments = await this.enrollmentRepository.find({
      where: {
        courseId,
        courseRunId: runId,
        role: CourseMemberRole.STUDENT,
      },
      order: { userId: 'ASC' },
    });
    const overview: StudentProgressOverviewDto[] = [];

    for (const enrollment of enrollments) {
      overview.push(await this.buildStudentProgressOverview(courseId, enrollment));
    }

    return overview;
  }

  async getLearningTaskProgressOverview(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<StudentProgressOverviewDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorUserId,
      CoursePermission.ReadAllResults,
    );
    const currentRun = await this.getCurrentCourseRunOrCreate(normalizedCourseId);

    return this.buildLearningTaskProgressOverviewForRun(
      normalizedCourseId,
      currentRun.id,
    );
  }

  async getLearningTaskProgressOverviewByRun(
    courseId: string | number,
    runId: string,
    actorUserId?: string | number,
  ): Promise<StudentProgressOverviewDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const run = await this.assertCourseRunManageable(
      normalizedCourseId,
      runId,
      actorUserId,
    );

    return this.buildLearningTaskProgressOverviewForRun(
      normalizedCourseId,
      run.id,
    );
  }

  // Content Release methods
  async createContentRelease(
    courseId: string,
    contentType: string,
    contentId: string,
    releaseType: string,
    releaseDate: Date,
    releaseConditions: any,
    createdBy: string,
  ): Promise<ContentRelease> {
    const release = new ContentRelease();
    release.contentType = contentType;
    release.contentId = contentId;
    release.releaseType = releaseType as ReleaseType;
    release.releaseDate = releaseDate;
    release.releaseConditions = releaseConditions;
    release.isActive = true;
    release.isReleased = false;
    release.createdBy = createdBy;
    release.updatedBy = createdBy;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    release.course = course;

    return this.contentReleaseRepository.save(release);
  }

  async getContentReleasesByCourse(courseId: string): Promise<ContentRelease[]> {
    return this.contentReleaseRepository.find({
      where: { course: { id: courseId } },
      order: { releaseDate: 'ASC' },
    });
  }

  async getContentReleaseById(id: string): Promise<ContentRelease> {
    return this.contentReleaseRepository.findOne({
      where: { id },
    });
  }

  async updateContentRelease(
    id: string,
    contentType: string,
    contentId: string,
    releaseType: string,
    releaseDate: Date,
    releaseConditions: any,
    isActive: boolean,
    updatedBy: string,
  ): Promise<ContentRelease> {
    const release = await this.contentReleaseRepository.findOne({
      where: { id },
    });

    if (!release) {
      throw new Error('Content release not found');
    }

    release.contentType = contentType;
    release.contentId = contentId;
    release.releaseType = releaseType as ReleaseType;
    release.releaseDate = releaseDate;
    release.releaseConditions = releaseConditions;
    release.isActive = isActive;
    release.updatedBy = updatedBy;

    return this.contentReleaseRepository.save(release);
  }

  async deleteContentRelease(id: string): Promise<void> {
    await this.contentReleaseRepository.delete(id);
  }

  async releaseContentManually(
    id: string,
    releasedBy: string,
  ): Promise<ContentRelease> {
    const release = await this.contentReleaseRepository.findOne({
      where: { id },
    });

    if (!release) {
      throw new Error('Content release not found');
    }

    if (release.isReleased) {
      throw new Error('Content already released');
    }

    release.isReleased = true;
    release.releasedAt = new Date();
    release.releasedBy = releasedBy;

    return this.contentReleaseRepository.save(release);
  }

  async checkAutomaticReleases(courseId: string): Promise<ContentRelease[]> {
    const now = new Date();
    const releases = await this.contentReleaseRepository.find({
      where: {
        course: { id: courseId },
        releaseType: ReleaseType.TIME_BASED,
        isReleased: false,
        isActive: true,
        releaseDate: LessThanOrEqual(now),
      },
    });

    const releasedContent = [];

    for (const release of releases) {
      release.isReleased = true;
      release.releasedAt = now;
      release.releasedBy = 'system';
      const updatedRelease = await this.contentReleaseRepository.save(release);
      releasedContent.push(updatedRelease);
    }

    return releasedContent;
  }

  async checkProgressBasedReleases(
    courseId: string,
    enrollmentId: string,
  ): Promise<ContentRelease[]> {
    const releases = await this.contentReleaseRepository.find({
      where: {
        course: { id: courseId },
        releaseType: ReleaseType.PROGRESS_BASED,
        isReleased: false,
        isActive: true,
      },
    });

    const releasedContent = [];

    for (const release of releases) {
      const conditions = release.releaseConditions;
      
      // Check if conditions are met based on learning path progress
      const learningPath = await this.getLearningPathProgress(
        courseId,
        enrollmentId,
      );

      let conditionsMet = true;

      if (conditions.minCompletionPercentage) {
        if (
          learningPath.progressPercentage <
          conditions.minCompletionPercentage
        ) {
          conditionsMet = false;
        }
      }

      if (conditions.requiredTaskIds) {
        for (const requiredTaskId of conditions.requiredTaskIds) {
          const taskProgress = await this.taskProgressRepository.findOne({
            where: {
              task: { id: requiredTaskId },
              enrollment: { id: enrollmentId },
            },
          });

          if (!taskProgress || taskProgress.status !== 'COMPLETED') {
            conditionsMet = false;
            break;
          }
        }
      }

      if (conditionsMet) {
        release.isReleased = true;
        release.releasedAt = new Date();
        release.releasedBy = 'system';
        const updatedRelease = await this.contentReleaseRepository.save(
          release,
        );
        releasedContent.push(updatedRelease);
      }
    }

    return releasedContent;
  }

  async getReleasedContentForEnrollment(
    courseId: string,
    enrollmentId: string,
  ): Promise<any[]> {
    // Check and process automatic releases
    await this.checkAutomaticReleases(courseId);
    await this.checkProgressBasedReleases(courseId, enrollmentId);

    // Get all released content for the course
    const releases = await this.contentReleaseRepository.find({
      where: {
        course: { id: courseId },
        isReleased: true,
        isActive: true,
      },
      relations: ['course'],
    });

    const releasedContent = [];

    for (const release of releases) {
      let contentDetails = null;

      switch (release.contentType) {
        case 'LEARNING_MATERIAL':
          contentDetails = await this.learningMaterialRepository.findOne({
            where: { id: release.contentId },
          });
          break;
        case 'ASSIGNMENT':
          contentDetails = await this.assignmentRepository.findOne({
            where: { id: release.contentId },
          });
          break;
        case 'TASK':
          contentDetails = await this.taskRepository.findOne({
            where: { id: release.contentId },
          });
          break;
        // Add other content types as needed
      }

      if (contentDetails) {
        releasedContent.push({
          releaseId: release.id,
          contentType: release.contentType,
          contentId: release.contentId,
          contentDetails,
          releasedAt: release.releasedAt,
          releasedBy: release.releasedBy,
        });
      }
    }

    return releasedContent;
  }

  async getContentReleaseStatus(
    courseId: string,
    enrollmentId: string,
  ): Promise<any> {
    // Get all content releases for the course
    const allReleases = await this.contentReleaseRepository.find({
      where: { course: { id: courseId }, isActive: true },
    });

    // Check automatic releases
    const autoReleased = await this.checkAutomaticReleases(courseId);
    
    // Check progress-based releases
    const progressReleased = await this.checkProgressBasedReleases(
      courseId,
      enrollmentId,
    );

    // Get final status
    const finalReleases = await this.contentReleaseRepository.find({
      where: { course: { id: courseId }, isActive: true },
    });

    const releasedCount = finalReleases.filter(r => r.isReleased).length;
    const pendingCount = finalReleases.filter(r => !r.isReleased).length;

    return {
      totalReleases: finalReleases.length,
      releasedCount,
      pendingCount,
      autoReleasedCount: autoReleased.length,
      progressReleasedCount: progressReleased.length,
      releaseDetails: finalReleases.map(r => ({
        id: r.id,
        contentType: r.contentType,
        contentId: r.contentId,
        releaseType: r.releaseType,
        isReleased: r.isReleased,
        releaseDate: r.releaseDate,
        releasedAt: r.releasedAt,
      })),
    };
  }

  // Content Template methods
  async createContentTemplate(
    courseId: string,
    name: string,
    description: string,
    templateType: string,
    templateData: any,
    placeholders: any,
    isGlobal: boolean,
    createdBy: string,
  ): Promise<ContentTemplate> {
    const template = new ContentTemplate();
    template.name = name;
    template.description = description;
    template.templateType = templateType;
    template.templateData = templateData;
    template.placeholders = placeholders;
    template.isGlobal = isGlobal;
    template.createdBy = createdBy;
    template.updatedBy = createdBy;
    template.isActive = true;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    template.course = course;

    return this.contentTemplateRepository.save(template);
  }

  async getContentTemplatesByCourse(courseId: string): Promise<ContentTemplate[]> {
    return this.contentTemplateRepository.find({
      where: { course: { id: courseId } },
      order: { name: 'ASC' },
    });
  }

  async getGlobalContentTemplates(): Promise<ContentTemplate[]> {
    return this.contentTemplateRepository.find({
      where: { isGlobal: true },
      order: { name: 'ASC' },
    });
  }

  async getContentTemplateById(id: string): Promise<ContentTemplate> {
    return this.contentTemplateRepository.findOne({
      where: { id },
    });
  }

  async updateContentTemplate(
    id: string,
    name: string,
    description: string,
    templateType: string,
    templateData: any,
    placeholders: any,
    isActive: boolean,
    isGlobal: boolean,
    updatedBy: string,
  ): Promise<ContentTemplate> {
    const template = await this.contentTemplateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new Error('Content template not found');
    }

    template.name = name;
    template.description = description;
    template.templateType = templateType;
    template.templateData = templateData;
    template.placeholders = placeholders;
    template.isActive = isActive;
    template.isGlobal = isGlobal;
    template.updatedBy = updatedBy;

    return this.contentTemplateRepository.save(template);
  }

  async deleteContentTemplate(id: string): Promise<void> {
    await this.contentTemplateRepository.delete(id);
  }

  async applyTemplateToCourse(
    templateId: string,
    courseId: string,
    appliedBy: string,
  ): Promise<any> {
    const template = await this.contentTemplateRepository.findOne({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    const result = {
      templateId: template.id,
      templateName: template.name,
      templateType: template.templateType,
      createdContent: [],
      errors: [],
    };

    try {
      switch (template.templateType) {
        case 'COURSE_STRUCTURE':
          // Apply course structure template
          const structureData = template.templateData;
          
          if (structureData.learningMaterials) {
            for (const materialData of structureData.learningMaterials) {
              try {
                const material = await this.createLearningMaterial(
                  courseId,
                  materialData.title,
                  materialData.description || '',
                  materialData.type || 'OTHER',
                  materialData.url || '',
                  materialData.filePath || '',
                  appliedBy,
                );
                result.createdContent.push({
                  type: 'LEARNING_MATERIAL',
                  id: material.id,
                  title: material.title,
                });
              } catch (error) {
                result.errors.push({
                  type: 'LEARNING_MATERIAL',
                  error: error.message,
                  data: materialData,
                });
              }
            }
          }

          if (structureData.assignments) {
            for (const assignmentData of structureData.assignments) {
              try {
                const assignment = await this.createAssignment(
                  courseId,
                  assignmentData.title,
                  assignmentData.description || '',
                  assignmentData.type || 'OTHER',
                  assignmentData.maxPoints || 100,
                  assignmentData.weight || 1,
                  assignmentData.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
                  appliedBy,
                );
                result.createdContent.push({
                  type: 'ASSIGNMENT',
                  id: assignment.id,
                  title: assignment.title,
                });
              } catch (error) {
                result.errors.push({
                  type: 'ASSIGNMENT',
                  error: error.message,
                  data: assignmentData,
                });
              }
            }
          }

          if (structureData.tasks) {
            for (const taskData of structureData.tasks) {
              try {
                const task = await this.createLearningTask(
                  courseId,
                  {
                    title: taskData.title,
                    description: taskData.description || '',
                    type: taskData.type || 'OTHER',
                    order: taskData.order || 1,
                    unlockMode: taskData.prerequisiteTaskId
                      ? TaskUnlockMode.AUTOMATIC
                      : TaskUnlockMode.IMMEDIATE,
                    prerequisiteTaskId: taskData.prerequisiteTaskId || null,
                    completionCriteria: taskData.completionCriteria || {},
                    isPublished: false,
                  },
                  appliedBy,
                );
                result.createdContent.push({
                  type: 'TASK',
                  id: task.id,
                  title: task.title,
                });
              } catch (error) {
                result.errors.push({
                  type: 'TASK',
                  error: error.message,
                  data: taskData,
                });
              }
            }
          }

          break;

        case 'ASSIGNMENT':
          // Apply assignment template
          const assignmentData = template.templateData;
          const assignment = await this.createAssignment(
            courseId,
            assignmentData.title,
            assignmentData.description || '',
            assignmentData.type || 'OTHER',
            assignmentData.maxPoints || 100,
            assignmentData.weight || 1,
            assignmentData.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            appliedBy,
          );
          result.createdContent.push({
            type: 'ASSIGNMENT',
            id: assignment.id,
            title: assignment.title,
          });
          break;

        case 'LEARNING_MATERIAL':
          // Apply learning material template
          const materialData = template.templateData;
          const material = await this.createLearningMaterial(
            courseId,
            materialData.title,
            materialData.description || '',
            materialData.type || 'OTHER',
            materialData.url || '',
            materialData.filePath || '',
            appliedBy,
          );
          result.createdContent.push({
            type: 'LEARNING_MATERIAL',
            id: material.id,
            title: material.title,
          });
          break;

        case 'SYLLABUS':
          // Apply syllabus template - could create a learning material with syllabus content
          const syllabusData = template.templateData;
          const syllabusMaterial = await this.createLearningMaterial(
            courseId,
            'Course Syllabus',
            syllabusData.description || 'Course syllabus',
            'DOCUMENT',
            '',
            '',
            appliedBy,
          );
          result.createdContent.push({
            type: 'SYLLABUS',
            id: syllabusMaterial.id,
            title: syllabusMaterial.title,
          });
          break;

        default:
          throw new Error(`Unsupported template type: ${template.templateType}`);
      }

      return result;
    } catch (error) {
      result.errors.push({
        type: 'GENERAL',
        error: error.message,
      });
      return result;
    }
  }

  async getAvailableTemplatesForCourse(courseId: string): Promise<ContentTemplate[]> {
    // Get course-specific templates
    const courseTemplates = await this.getContentTemplatesByCourse(courseId);

    // Get global templates
    const globalTemplates = await this.getGlobalContentTemplates();

    // Combine and remove duplicates
    const allTemplates = [...courseTemplates, ...globalTemplates];
    
    return allTemplates.filter(
      (template, index, self) =>
        index === self.findIndex(t => t.id === template.id),
    );
  }

  // Search methods
  async searchCourses(
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<Course[]> {
    return this.coursesRepository.find({
      where: [
        { title: ILike(`%${query}%`) },
        { description: ILike(`%${query}%`) },
        { external_id: ILike(`%${query}%`) },
      ],
      take: limit,
      skip: offset,
    });
  }

  async searchLearningMaterials(
    courseId: string,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<LearningMaterial[]> {
    const { run, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));

    return this.learningMaterialRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
        courseVersionId: version.id,
        publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
        title: ILike(`%${query}%`),
      },
      take: limit,
      skip: offset,
    });
  }

  async searchAssignments(
    courseId: string,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<Assignment[]> {
    return this.assignmentRepository.find({
      where: {
        course: { id: courseId },
        title: ILike(`%${query}%`),
      },
      take: limit,
      skip: offset,
    });
  }

  async searchTasks(
    courseId: string,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<Task[]> {
    const { run, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));

    return this.taskRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
        courseVersionId: version.id,
        title: ILike(`%${query}%`),
      },
      take: limit,
      skip: offset,
    });
  }

  async searchContentTemplates(
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<ContentTemplate[]> {
    return this.contentTemplateRepository.find({
      where: [
        { name: ILike(`%${query}%`) },
        { description: ILike(`%${query}%`) },
      ],
      take: limit,
      skip: offset,
    });
  }

  async advancedSearch(
    query: string,
    contentTypes: string[] = ['COURSE', 'LEARNING_MATERIAL', 'ASSIGNMENT', 'TASK'],
    limit: number = 10,
    offset: number = 0,
  ): Promise<any> {
    const results: any = {
      courses: [],
      learningMaterials: [],
      assignments: [],
      tasks: [],
      templates: [],
    };

    if (contentTypes.includes('COURSE')) {
      results.courses = await this.searchCourses(query, limit, offset);
    }

    if (contentTypes.includes('LEARNING_MATERIAL')) {
      // Search across all courses for learning materials
      results.learningMaterials = await this.learningMaterialRepository.find({
        where: {
          title: ILike(`%${query}%`),
        },
        take: limit,
        skip: offset,
        relations: ['course'],
      });
    }

    if (contentTypes.includes('ASSIGNMENT')) {
      // Search across all courses for assignments
      results.assignments = await this.assignmentRepository.find({
        where: {
          title: ILike(`%${query}%`),
        },
        take: limit,
        skip: offset,
        relations: ['course'],
      });
    }

    if (contentTypes.includes('TASK')) {
      // Search across all courses for tasks
      results.tasks = await this.taskRepository.find({
        where: {
          title: ILike(`%${query}%`),
        },
        take: limit,
        skip: offset,
        relations: ['course'],
      });
    }

    if (contentTypes.includes('TEMPLATE')) {
      results.templates = await this.searchContentTemplates(query, limit, offset);
    }

    return results;
  }

  async searchWithinCourse(
    courseId: string,
    query: string,
    contentTypes: string[] = ['LEARNING_MATERIAL', 'ASSIGNMENT', 'TASK'],
    limit: number = 10,
    offset: number = 0,
  ): Promise<any> {
    const results: any = {
      learningMaterials: [],
      assignments: [],
      tasks: [],
    };

    if (contentTypes.includes('LEARNING_MATERIAL')) {
      results.learningMaterials = await this.searchLearningMaterials(
        courseId,
        query,
        limit,
        offset,
      );
    }

    if (contentTypes.includes('ASSIGNMENT')) {
      results.assignments = await this.searchAssignments(
        courseId,
        query,
        limit,
        offset,
      );
    }

    if (contentTypes.includes('TASK')) {
      results.tasks = await this.searchTasks(courseId, query, limit, offset);
    }

    return results;
  }

  // Workgroup methods
  async createCourseGroup(
    courseId: string,
    name: string,
    description: string,
    groupType: string,
    createdBy: string,
  ): Promise<CourseGroup> {
    const group = new CourseGroup();
    group.course_id = courseId;
    group.name = name;
    group.description = description;
    group.group_type = groupType as any;
    group.created_by = createdBy;
    group.updated_by = createdBy;

    return this.courseGroupRepository.save(group);
  }

  async getCourseGroupsByCourse(courseId: string): Promise<CourseGroup[]> {
    return this.courseGroupRepository.find({
      where: { course_id: courseId },
      relations: ['memberships'],
    });
  }

  async getCourseGroupById(id: string): Promise<CourseGroup> {
    return this.courseGroupRepository.findOne({
      where: { id },
      relations: ['memberships'],
    });
  }

  async updateCourseGroup(
    id: string,
    name: string,
    description: string,
    groupType: string,
    isActive: boolean,
    groupGrade: number,
    groupFeedback: string,
    updatedBy: string,
  ): Promise<CourseGroup> {
    const group = await this.courseGroupRepository.findOne({
      where: { id },
    });

    if (!group) {
      throw new Error('Course group not found');
    }

    group.name = name;
    group.description = description;
    group.group_type = groupType as any;
    group.is_active = isActive;
    group.group_grade = groupGrade;
    group.group_feedback = groupFeedback;
    group.updated_by = updatedBy;

    return this.courseGroupRepository.save(group);
  }

  async deleteCourseGroup(id: string): Promise<void> {
    await this.courseGroupRepository.delete(id);
  }

  async addMemberToGroup(
    groupId: string,
    userId: string,
    role: string,
    addedBy: string,
  ): Promise<GroupMembership> {
    const membership = new GroupMembership();
    membership.group_id = groupId;
    membership.user_id = userId;
    membership.role = role as any;
    membership.joined_at = new Date();
    membership.added_by = addedBy;

    return this.groupMembershipRepository.save(membership);
  }

  async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    await this.groupMembershipRepository.delete({
      group_id: groupId,
      user_id: userId,
    });
  }

  async updateGroupMembershipRole(
    groupId: string,
    userId: string,
    role: string,
  ): Promise<GroupMembership> {
    const membership = await this.groupMembershipRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });

    if (!membership) {
      throw new Error('Group membership not found');
    }

    membership.role = role as any;

    return this.groupMembershipRepository.save(membership);
  }

  async getGroupMembers(groupId: string): Promise<GroupMembership[]> {
    return this.groupMembershipRepository.find({
      where: { group_id: groupId },
    });
  }

  async getGroupsForUser(courseId: string, userId: string): Promise<CourseGroup[]> {
    const memberships = await this.groupMembershipRepository.find({
      where: { user_id: userId },
      relations: ['group'],
    });

    return memberships
      .map(m => m.group)
      .filter(group => group.course_id === courseId);
  }

  async getGroupMembership(
    groupId: string,
    userId: string,
  ): Promise<GroupMembership> {
    return this.groupMembershipRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });
  }

  async assignGroupGrade(
    groupId: string,
    grade: number,
    feedback: string,
    updatedBy: string,
  ): Promise<CourseGroup> {
    const group = await this.courseGroupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    group.group_grade = grade;
    group.group_feedback = feedback;
    group.updated_by = updatedBy;

    return this.courseGroupRepository.save(group);
  }

  async assignIndividualGrade(
    groupId: string,
    userId: string,
    grade: number,
    feedback: string,
  ): Promise<GroupMembership> {
    const membership = await this.groupMembershipRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });

    if (!membership) {
      throw new Error('Group membership not found');
    }

    membership.individual_grade = grade;
    membership.individual_feedback = feedback;

    return this.groupMembershipRepository.save(membership);
  }

  async getGroupPerformance(groupId: string): Promise<any> {
    const group = await this.courseGroupRepository.findOne({
      where: { id: groupId },
      relations: ['memberships'],
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const members = group.memberships || [];
    
    const individualGrades = members
      .filter(m => m.individual_grade !== null && m.individual_grade !== undefined)
      .map(m => m.individual_grade);

    const averageGrade =
      individualGrades.length > 0
        ? individualGrades.reduce((sum, grade) => sum + grade, 0) /
          individualGrades.length
        : 0;

    return {
      groupId: group.id,
      groupName: group.name,
      groupGrade: group.group_grade,
      groupFeedback: group.group_feedback,
      averageIndividualGrade: averageGrade,
      memberCount: members.length,
      membersWithGrades: individualGrades.length,
      memberPerformance: members.map(m => ({
        userId: m.user_id,
        role: m.role,
        individualGrade: m.individual_grade,
        individualFeedback: m.individual_feedback,
      })),
    };
  }

  async autoCreateWorkgroups(
    courseId: string,
    groupSize: number,
    groupPrefix: string,
    createdBy: string,
  ): Promise<CourseGroup[]> {
    // Get all enrollments for the course
    const enrollments = await this.enrollmentRepository.find({
      where: { courseId: courseId },
    });

    const studentEnrollments = enrollments.filter(
      e => e.role === CourseMemberRole.STUDENT,
    );

    const createdGroups = [];

    // Create groups with the specified size
    for (let i = 0; i < studentEnrollments.length; i += groupSize) {
      const groupNumber = Math.floor(i / groupSize) + 1;
      const groupName = `${groupPrefix} ${groupNumber}`;

      const group = await this.createCourseGroup(
        courseId,
        groupName,
        `Auto-created workgroup ${groupNumber}`,
        'WORKGROUP',
        createdBy,
      );

      // Add members to the group
      const groupMembers = studentEnrollments.slice(i, i + groupSize);
      for (const member of groupMembers) {
        await this.addMemberToGroup(
          group.id,
          member.userId,
          'MEMBER',
          createdBy,
        );
      }

      // Assign the first member as leader
      if (groupMembers.length > 0) {
        await this.updateGroupMembershipRole(
          group.id,
          groupMembers[0].userId,
          'LEADER',
        );
      }

      createdGroups.push(group);
    }

    return createdGroups;
  }

  async getGroupLearningProgress(
    groupId: string,
    courseId: string,
  ): Promise<any> {
    const group = await this.courseGroupRepository.findOne({
      where: { id: groupId },
      relations: ['memberships'],
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const memberProgress = [];

    for (const membership of group.memberships) {
      try {
        const progress = await this.getLearningPathProgress(
          courseId,
          membership.user_id,
        );
        
        memberProgress.push({
          userId: membership.user_id,
          role: membership.role,
          ...progress,
        });
      } catch (error) {
        memberProgress.push({
          userId: membership.user_id,
          role: membership.role,
          error: error.message,
        });
      }
    }

    // Calculate average progress
    const validProgresses = memberProgress.filter(
      p => p.progressPercentage !== undefined,
    );
    const averageProgress =
      validProgresses.length > 0
        ? validProgresses.reduce(
            (sum, p) => sum + p.progressPercentage,
            0,
          ) / validProgresses.length
        : 0;

    return {
      groupId: group.id,
      groupName: group.name,
      averageProgress,
      memberCount: group.memberships.length,
      membersWithProgress: validProgresses.length,
      memberProgress,
    };
  }

  // Calendar Event methods
  async createCalendarEvent(
    courseId: string,
    title: string,
    description: string,
    eventType: string,
    startTime: Date,
    endTime: Date,
    location: string,
    onlineLink: string,
    isAllDay: boolean,
    isRecurring: boolean,
    recurrencePattern: any,
    relatedContentId: string,
    relatedContentType: string,
    createdBy: string,
  ): Promise<CalendarEvent> {
    const event = new CalendarEvent();
    event.title = title;
    event.description = description;
    event.eventType = eventType;
    event.startTime = startTime;
    event.endTime = endTime;
    event.location = location;
    event.onlineLink = onlineLink;
    event.isAllDay = isAllDay;
    event.isRecurring = isRecurring;
    event.recurrencePattern = recurrencePattern;
    event.relatedContentId = relatedContentId;
    event.relatedContentType = relatedContentType;
    event.createdBy = createdBy;
    event.updatedBy = createdBy;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    event.course = course;

    return this.calendarEventRepository.save(event);
  }

  async getCalendarEventsByCourse(
    courseId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CalendarEvent[]> {
    return this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        startTime: LessThanOrEqual(endDate),
        endTime: MoreThanOrEqual(startDate),
      },
      order: { startTime: 'ASC' },
    });
  }

  async getCalendarEventById(id: string): Promise<CalendarEvent> {
    return this.calendarEventRepository.findOne({
      where: { id },
    });
  }

  async updateCalendarEvent(
    id: string,
    title: string,
    description: string,
    eventType: string,
    startTime: Date,
    endTime: Date,
    location: string,
    onlineLink: string,
    isAllDay: boolean,
    isRecurring: boolean,
    recurrencePattern: any,
    relatedContentId: string,
    relatedContentType: string,
    updatedBy: string,
  ): Promise<CalendarEvent> {
    const event = await this.calendarEventRepository.findOne({
      where: { id },
    });

    if (!event) {
      throw new Error('Calendar event not found');
    }

    event.title = title;
    event.description = description;
    event.eventType = eventType;
    event.startTime = startTime;
    event.endTime = endTime;
    event.location = location;
    event.onlineLink = onlineLink;
    event.isAllDay = isAllDay;
    event.isRecurring = isRecurring;
    event.recurrencePattern = recurrencePattern;
    event.relatedContentId = relatedContentId;
    event.relatedContentType = relatedContentType;
    event.updatedBy = updatedBy;

    return this.calendarEventRepository.save(event);
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    await this.calendarEventRepository.delete(id);
  }

  async createAssignmentDueDateEvents(
    courseId: string,
    createdBy: string,
  ): Promise<CalendarEvent[]> {
    const assignments = await this.assignmentRepository.find({
      where: {
        course: { id: courseId },
        dueDate: Not(IsNull()),
      },
    });

    const createdEvents = [];

    for (const assignment of assignments) {
      // Check if event already exists for this assignment
      const existingEvent = await this.calendarEventRepository.findOne({
        where: {
          relatedContentId: assignment.id,
          relatedContentType: 'ASSIGNMENT',
        },
      });

      if (!existingEvent) {
        const event = await this.createCalendarEvent(
          courseId,
          `Due: ${assignment.title}`,
          assignment.description || 'Assignment due date',
          'ASSIGNMENT_DUE',
          assignment.dueDate,
          assignment.dueDate,
          '',
          '',
          false,
          false,
          null,
          assignment.id,
          'ASSIGNMENT',
          createdBy,
        );
        createdEvents.push(event);
      }
    }

    return createdEvents;
  }

  async getUpcomingEvents(
    courseId: string,
    limit: number = 5,
  ): Promise<CalendarEvent[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30); // Next 30 days

    return this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        startTime: MoreThanOrEqual(now),
        endTime: LessThanOrEqual(futureDate),
      },
      order: { startTime: 'ASC' },
      take: limit,
    });
  }

  async getEventsByDateRange(
    courseId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CalendarEvent[]> {
    return this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        startTime: LessThanOrEqual(endDate),
        endTime: MoreThanOrEqual(startDate),
      },
      order: { startTime: 'ASC' },
    });
  }

  async getDailyEvents(
    courseId: string,
    date: Date,
  ): Promise<CalendarEvent[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.calendarEventRepository.find({
      where: [
        {
          course: { id: courseId },
          startTime: LessThanOrEqual(endOfDay),
          endTime: MoreThanOrEqual(startOfDay),
        },
        {
          course: { id: courseId },
          isAllDay: true,
          startTime: LessThanOrEqual(endOfDay),
          endTime: MoreThanOrEqual(startOfDay),
        },
      ],
      order: { startTime: 'ASC' },
    });
  }

  async getMonthlyEvents(
    courseId: string,
    year: number,
    month: number,
  ): Promise<CalendarEvent[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    return this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        startTime: LessThanOrEqual(endDate),
        endTime: MoreThanOrEqual(startDate),
      },
      order: { startTime: 'ASC' },
    });
  }

  async syncAssignmentDueDates(
    courseId: string,
    createdBy: string,
  ): Promise<{ created: CalendarEvent[]; deleted: number }> {
    // Get all assignments with due dates
    const assignments = await this.assignmentRepository.find({
      where: {
        course: { id: courseId },
        dueDate: Not(IsNull()),
      },
    });

    // Get all existing assignment-related events
    const existingEvents = await this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        relatedContentType: 'ASSIGNMENT',
      },
    });

    const assignmentIds = assignments.map(a => a.id);
    const existingEventAssignmentIds = existingEvents.map(e => e.relatedContentId);

    // Find events to delete (assignments that no longer exist or have no due date)
    const eventsToDelete = existingEvents.filter(
      event => !assignmentIds.includes(event.relatedContentId),
    );

    // Delete obsolete events
    const deleteResults = [];
    for (const event of eventsToDelete) {
      try {
        await this.deleteCalendarEvent(event.id);
        deleteResults.push(event.id);
      } catch (error) {
        // Continue with other deletions even if one fails
      }
    }

    // Create events for assignments that don't have events yet
    const createdEvents = [];
    for (const assignment of assignments) {
      const hasEvent = existingEventAssignmentIds.includes(assignment.id);

      if (!hasEvent) {
        try {
          const event = await this.createCalendarEvent(
            courseId,
            `Due: ${assignment.title}`,
            assignment.description || 'Assignment due date',
            'ASSIGNMENT_DUE',
            assignment.dueDate,
            assignment.dueDate,
            '',
            '',
            false,
            false,
            null,
            assignment.id,
            'ASSIGNMENT',
            createdBy,
          );
          createdEvents.push(event);
        } catch (error) {
          // Continue with other creations even if one fails
        }
      }
    }

    return {
      created: createdEvents,
      deleted: deleteResults.length,
    };
  }
}
