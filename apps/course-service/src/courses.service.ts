/**
 * Courses Service - Business logic layer for course management
 * 
 * This service provides all the business logic for managing courses, learning materials,
 * assignments, grades, tasks, content releases, templates, groups, and calendar events.
 * It acts as the bridge between the controllers and the database repositories.
 * 
 * @module CoursesService
 */
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, ILike, MoreThanOrEqual, Not, IsNull, In } from 'typeorm';
import { randomUUID } from 'crypto';
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
} from './entities/course-result.entity';
import { Enrollment, CourseMemberRole } from './entities/enrollment.entity';
import { Task, TaskGradingMode, TaskUnlockMode, TaskWorkMode } from './entities/task.entity';
import {
  TaskAssessment,
  TaskAssessmentStatus,
  TaskAssessmentTargetType,
} from './entities/task-assessment.entity';
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
import { GroupMembership, MembershipRole } from './entities/group-membership.entity';
import { GroupTaskProgress } from './entities/group-task-progress.entity';
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
  ManualTaskAssessmentDto,
  MockEvaluateLearningTaskDto,
  StudentLearningTaskResponseDto,
  StudentProgressOverviewDto,
  SubmitLearningTaskDto,
  TaskAssessmentResponseDto,
  UpdateLearningTaskDto,
  UpdateLearningTaskReleaseConfigDto,
  UpdateLearningTaskSortDto,
  mapLearningTaskToDto,
  mapLearningTaskWithProgressToDto,
  mapTaskAssessmentToDto,
  mapTaskProgressToDto,
} from './dto/learning-process.dto';
import {
  AddStudyGroupMemberDto,
  CreateStudyGroupDto,
  ManualGroupTaskAssessmentDto,
  StudyGroupResponseDto,
  UpdateStudyGroupDto,
  mapGroupTaskProgressToDto,
  mapStudyGroupToDto,
} from './dto/study-group.dto';
import { calculateCoursePassStatus } from './course-result.rules';
import { LocalMaterialStorage } from './storage/material-storage';
import {
  TASK_PASS_THRESHOLD_PERCENT,
  calculateTaskAssessmentPassed,
} from './task-assessment.rules';
import { TaskServiceClient, TaskServiceTask } from './task-service.client';
import { CourseResultService } from './domain/course-result.service';
import { AssessmentService } from './domain/assessment.service';
import { LearningTaskService } from './domain/learning-task.service';
import { LearningMaterialService } from './domain/learning-material.service';
import { CourseRunVersionService } from './domain/course-run-version.service';
import { AuditLogService } from './audit-log.service';
import {
  AuditEventListQueryDto,
  AuditEventResponseDto,
  mapAuditEventToDto,
} from './dto/audit-event.dto';
import { AuditEventType } from './entities/audit-event.entity';

export type UploadedLearningMaterialFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

type LearningMaterialVisibility = {
  visible: boolean;
  locked: boolean;
  lockedReason?: string;
  releaseAfterTaskTitle?: string;
  visibleForStudents: boolean;
};

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
    @InjectRepository(TaskAssessment)
    private taskAssessmentRepository: Repository<TaskAssessment>,
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
    @Optional()
    private readonly auditLogService?: AuditLogService,
    @Optional()
    @InjectRepository(GroupTaskProgress)
    private readonly groupTaskProgressRepository?: Repository<GroupTaskProgress>,
    @Optional()
    private readonly taskServiceClient?: TaskServiceClient,
  ) {}

  private readonly fallbackTaskServiceClient = new TaskServiceClient();
  private readonly courseResultService = new CourseResultService(this as any);
  private readonly assessmentService = new AssessmentService(this as any);
  private readonly learningMaterialService = new LearningMaterialService(this as any).api;
  private readonly courseRunVersionService = new CourseRunVersionService(this as any).api;

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

  private getTaskServiceClient(): TaskServiceClient {
    return this.taskServiceClient ?? this.fallbackTaskServiceClient;
  }

  private applyTaskServiceContent(
    reference: Task,
    taskContent?: TaskServiceTask | null,
  ): Task {
    reference.title = taskContent?.title ?? reference.title ?? 'Aufgabe';
    reference.description = taskContent?.description ?? reference.description ?? '';
    reference.type = taskContent?.type ?? reference.type ?? 'MOCK';
    reference.content = taskContent?.content ?? reference.content ?? {};

    if (
      (reference.maxPoints === undefined || reference.maxPoints === null) &&
      taskContent?.defaultMaxScore !== undefined &&
      taskContent.defaultMaxScore !== null
    ) {
      reference.maxPoints = Number(taskContent.defaultMaxScore);
    }

    if (
      (reference.passThreshold === undefined || reference.passThreshold === null) &&
      taskContent?.defaultPassThreshold !== undefined &&
      taskContent.defaultPassThreshold !== null
    ) {
      reference.passThreshold = Number(taskContent.defaultPassThreshold);
    }

    return reference;
  }

  private async enrichTaskReferences<T extends Task>(references: T[]): Promise<T[]> {
    const taskContents = await this.loadTaskContents(references);

    return references.map((reference) =>
      this.applyTaskServiceContent(
        reference,
        taskContents.get(reference.externalTaskId ?? reference.id),
      ) as T,
    );
  }

  private async enrichTaskReference<T extends Task>(reference: T): Promise<T> {
    return (await this.enrichTaskReferences([reference]))[0];
  }

  private buildTaskServicePayload(
    body: CreateLearningTaskDto | UpdateLearningTaskDto,
    fallback?: Task,
  ): Omit<TaskServiceTask, 'id'> {
    return {
      title: body.title !== undefined
        ? this.requireTaskTitle(body.title)
        : fallback?.title ?? 'Aufgabe',
      description: body.description !== undefined
        ? String(body.description ?? '').trim()
        : fallback?.description ?? '',
      type: body.type !== undefined
        ? String(body.type ?? '').trim() || fallback?.type || 'DEMO_TASK'
        : fallback?.type ?? 'DEMO_TASK',
      content: body.content !== undefined
        ? body.content ?? {}
        : body.completionCriteria !== undefined
          ? body.completionCriteria ?? {}
          : fallback?.content ?? fallback?.completionCriteria ?? {},
      defaultMaxScore: body.maxPoints !== undefined
        ? this.parseTaskAssessmentNumber(body.maxPoints, 'maxPoints')
        : fallback?.maxPoints ?? null,
      defaultPassThreshold: body.passThreshold !== undefined
        ? this.parseTaskAssessmentNumber(body.passThreshold, 'passThreshold', { max: 100 })
        : fallback?.passThreshold ?? null,
      mockEvaluationMode: body.gradingMode !== undefined
        ? String(body.gradingMode)
        : fallback?.gradingMode ?? TaskGradingMode.NOT_GRADED,
    };
  }

  private localTaskContent(
    payload: Partial<TaskServiceTask> & { id?: string },
    fallback?: Task,
  ): TaskServiceTask {
    const id = payload.id ?? fallback?.externalTaskId ?? fallback?.id ?? randomUUID();

    return {
      id,
      title: payload.title ?? fallback?.title ?? 'Aufgabe',
      description: payload.description ?? fallback?.description ?? '',
      type: payload.type ?? fallback?.type ?? 'DEMO_TASK',
      content: payload.content ?? fallback?.content ?? fallback?.completionCriteria ?? {},
      defaultMaxScore: payload.defaultMaxScore ?? fallback?.maxPoints ?? null,
      defaultPassThreshold: payload.defaultPassThreshold ?? fallback?.passThreshold ?? null,
      mockEvaluationMode: payload.mockEvaluationMode ?? fallback?.gradingMode ?? null,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };
  }

  private async loadTaskContents<T extends Task>(
    references: T[],
  ): Promise<Map<string, TaskServiceTask>> {
    const client = this.taskServiceClient as any;

    if (client && typeof client.getTasks === 'function') {
      return client.getTasks(
        references.map((reference) => reference.externalTaskId ?? reference.id),
      );
    }

    return new Map(references.map((reference) => {
      const id = reference.externalTaskId ?? reference.id;
      const content = this.localTaskContent({
        id,
        title: reference.title,
        description: reference.description,
        type: reference.type,
        content: reference.content ?? reference.completionCriteria ?? {},
        defaultMaxScore: reference.maxPoints ?? null,
        defaultPassThreshold: reference.passThreshold ?? null,
        mockEvaluationMode: reference.gradingMode ?? null,
      }, reference);

      return [id, content];
    }));
  }

  private async createTaskContent(
    payload: TaskServiceTask & { id: string },
  ): Promise<TaskServiceTask> {
    const client = this.taskServiceClient as any;

    if (client && typeof client.createTask === 'function') {
      return client.createTask(payload);
    }

    return this.localTaskContent(payload);
  }

  private async updateTaskContent(
    taskId: string,
    payload: Omit<TaskServiceTask, 'id'>,
    fallback: Task,
  ): Promise<TaskServiceTask> {
    const client = this.taskServiceClient as any;

    if (client && typeof client.updateTask === 'function') {
      return client.updateTask(taskId, payload);
    }

    return this.localTaskContent({ ...payload, id: taskId }, fallback);
  }

  private async deleteTaskContent(taskId: string): Promise<void> {
    const client = this.taskServiceClient as any;

    if (client && typeof client.deleteTask === 'function') {
      await client.deleteTask(taskId);
    }
  }

  private toUserId(userId: string | number): string {
    return String(userId);
  }

  private parseAuditLimit(value: unknown): number {
    const numericLimit = Number(value ?? 100);

    if (!Number.isFinite(numericLimit)) {
      return 100;
    }

    return Math.min(Math.max(Math.floor(numericLimit), 1), 100);
  }

  private parseAuditDate(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const date = new Date(String(value));

    if (Number.isNaN(date.getTime())) {
      throw new ApiValidationError(`Invalid audit ${fieldName} date`);
    }

    return date;
  }

  private async resolveAuditActorRole(
    courseId?: string | number | null,
    actorUserId?: string | number | null,
  ): Promise<string | undefined> {
    if (!courseId || actorUserId === undefined || actorUserId === null) {
      return undefined;
    }

    try {
      return (await this.resolveCourseRole(courseId, actorUserId)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private async recordAuditEvent(input: {
    eventType: AuditEventType;
    actorUserId?: string | number | null;
    actorRole?: string | null;
    courseId?: string | number | null;
    courseRunId?: string | null;
    courseVersionId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    summary: string;
    metadataJson?: Record<string, unknown> | null;
  }): Promise<void> {
    if (!this.auditLogService) {
      return;
    }

    const actorUserId =
      input.actorUserId === undefined || input.actorUserId === null
        ? undefined
        : this.toUserId(input.actorUserId);
    const courseId = input.courseId ? this.toCourseId(input.courseId) : undefined;
    const actorRole =
      input.actorRole ?? (await this.resolveAuditActorRole(courseId, actorUserId));

    await this.auditLogService.recordEvent({
      eventType: input.eventType,
      actorUserId,
      actorRole,
      courseId,
      courseRunId: input.courseRunId,
      courseVersionId: input.courseVersionId,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadataJson: input.metadataJson,
    });
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

  private async mapCourseCatalogItemWithCounts(
    course: Course,
    enrollment?: Enrollment | null,
    currentRun?: CourseRun | null,
  ): Promise<CourseCatalogItemResponseDto> {
    return {
      ...mapCourseToCatalogItemDto(course, enrollment, null),
      currentRun: currentRun
        ? await this.mapCourseRunWithCounts(currentRun)
        : undefined,
    };
  }

  // Course run and content version methods are implemented in the domain service.
  private delegateCourseRunVersion(methodName: string, args: unknown[]): any {
    return this.courseRunVersionService[methodName](...args);
  }

  private normalizeCourseRunStatus(...args: any[]): CourseRunStatus | undefined {
    return this.delegateCourseRunVersion('normalizeCourseRunStatus', args);
  }

  private normalizeRecurrenceType(...args: any[]): CourseRecurrenceType {
    return this.delegateCourseRunVersion('normalizeRecurrenceType', args);
  }

  private toDateOnly(...args: any[]): string {
    return this.delegateCourseRunVersion('toDateOnly', args);
  }

  private parseDateOnly(...args: any[]): string | undefined {
    return this.delegateCourseRunVersion('parseDateOnly', args);
  }

  private dateFromDateOnly(...args: any[]): Date {
    return this.delegateCourseRunVersion('dateFromDateOnly', args);
  }

  private courseStatusToRunStatus(...args: any[]): CourseRunStatus {
    return this.delegateCourseRunVersion('courseStatusToRunStatus', args);
  }

  private calculateInitialRunFields(...args: any[]): any {
    return this.delegateCourseRunVersion('calculateInitialRunFields', args);
  }

  private calculateNextRunFields(...args: any[]): any {
    return this.delegateCourseRunVersion('calculateNextRunFields', args);
  }

  private calculatePlannedNextRunFields(...args: any[]): any {
    return this.delegateCourseRunVersion('calculatePlannedNextRunFields', args);
  }

  private calculateSpecialRunFields(...args: any[]): any {
    return this.delegateCourseRunVersion('calculateSpecialRunFields', args);
  }

  private normalizeCourseRunTemplateStrategy(...args: any[]): CourseRunTemplateStrategy {
    return this.delegateCourseRunVersion('normalizeCourseRunTemplateStrategy', args);
  }

  private async findCurrentCourseRun(...args: any[]): Promise<CourseRun | null> {
    return this.delegateCourseRunVersion('findCurrentCourseRun', args);
  }

  private async createInitialCourseRun(...args: any[]): Promise<CourseRun> {
    return this.delegateCourseRunVersion('createInitialCourseRun', args);
  }

  private async getCurrentCourseRunOrCreate(...args: any[]): Promise<CourseRun> {
    return this.delegateCourseRunVersion('getCurrentCourseRunOrCreate', args);
  }

  private normalizeChangeSummary(...args: any[]): string | undefined {
    return this.delegateCourseRunVersion('normalizeChangeSummary', args);
  }

  private async buildCourseVersionContent(...args: any[]): Promise<Record<string, unknown>> {
    return this.delegateCourseRunVersion('buildCourseVersionContent', args);
  }

  private async getNextCourseVersionNumber(...args: any[]): Promise<number> {
    return this.delegateCourseRunVersion('getNextCourseVersionNumber', args);
  }

  private async findActiveOrLatestCourseVersionForRun(...args: any[]): Promise<CourseVersion | null> {
    return this.delegateCourseRunVersion('findActiveOrLatestCourseVersionForRun', args);
  }

  private async attachLegacyRunContentToVersion(...args: any[]): Promise<void> {
    return this.delegateCourseRunVersion('attachLegacyRunContentToVersion', args);
  }

  private async getActiveCourseVersionForRunOrThrow(...args: any[]): Promise<CourseVersion> {
    return this.delegateCourseRunVersion('getActiveCourseVersionForRunOrThrow', args);
  }

  private async getActiveCourseVersionForCurrentRunOrThrow(...args: any[]): Promise<{ run: CourseRun; version: CourseVersion }> {
    return this.delegateCourseRunVersion('getActiveCourseVersionForCurrentRunOrThrow', args);
  }

  private async findCourseVersionInRunOrThrow(...args: any[]): Promise<CourseVersion> {
    return this.delegateCourseRunVersion('findCourseVersionInRunOrThrow', args);
  }

  private async refreshCourseVersionContent(...args: any[]): Promise<void> {
    return this.delegateCourseRunVersion('refreshCourseVersionContent', args);
  }

  private async findCourseVersionTemplateOrThrow(...args: any[]): Promise<CourseVersion> {
    return this.delegateCourseRunVersion('findCourseVersionTemplateOrThrow', args);
  }

  private async resolveCourseRunTemplateVersion(...args: any[]): Promise<CourseVersion | null> {
    return this.delegateCourseRunVersion('resolveCourseRunTemplateVersion', args);
  }

  private async assertPlannedRunDoesNotExist(...args: any[]): Promise<void> {
    return this.delegateCourseRunVersion('assertPlannedRunDoesNotExist', args);
  }

  private async hydrateCourseVersionTemplateInfo(...args: any[]): Promise<CourseVersion> {
    return this.delegateCourseRunVersion('hydrateCourseVersionTemplateInfo', args);
  }

  private async mapCourseVersionWithTemplateInfo(...args: any[]): Promise<CourseVersionResponseDto> {
    return this.delegateCourseRunVersion('mapCourseVersionWithTemplateInfo', args);
  }

  private getSnapshotTasks(...args: any[]): any[] {
    return this.delegateCourseRunVersion('getSnapshotTasks', args);
  }

  private getSnapshotMaterials(...args: any[]): any[] {
    return this.delegateCourseRunVersion('getSnapshotMaterials', args);
  }

  private hasCourseVersionContentSnapshot(...args: any[]): boolean {
    return this.delegateCourseRunVersion('hasCourseVersionContentSnapshot', args);
  }

  private async assertCourseVersionReadable(...args: any[]): Promise<void> {
    return this.delegateCourseRunVersion('assertCourseVersionReadable', args);
  }

  private async setActiveCourseVersion(...args: any[]): Promise<CourseVersion> {
    return this.delegateCourseRunVersion('setActiveCourseVersion', args);
  }

  private async mapCourseRunWithCounts(...args: any[]): Promise<CourseRunResponseDto> {
    return this.delegateCourseRunVersion('mapCourseRunWithCounts', args);
  }

  private async assertCourseRunReadable(...args: any[]): Promise<CourseMemberRole | null> {
    return this.delegateCourseRunVersion('assertCourseRunReadable', args);
  }

  private async assertCourseRunManageable(...args: any[]): Promise<CourseRun> {
    return this.delegateCourseRunVersion('assertCourseRunManageable', args);
  }

  private async setActiveCourseRun(...args: any[]): Promise<CourseRun> {
    return this.delegateCourseRunVersion('setActiveCourseRun', args);
  }

  private async copyLearningMaterialsToRun(...args: any[]): Promise<void> {
    return this.delegateCourseRunVersion('copyLearningMaterialsToRun', args);
  }

  private async copyTasksToRun(...args: any[]): Promise<Map<string, string>> {
    return this.delegateCourseRunVersion('copyTasksToRun', args);
  }

  private cloneJsonValue<T>(...args: any[]): T {
    return this.delegateCourseRunVersion('cloneJsonValue', args);
  }

  private async copyCourseVersionContentToRun(...args: any[]): Promise<void> {
    return this.delegateCourseRunVersion('copyCourseVersionContentToRun', args);
  }

  private async createInitialContentVersionForRun(...args: any[]): Promise<CourseVersion> {
    return this.delegateCourseRunVersion('createInitialContentVersionForRun', args);
  }

  private async deleteUnreferencedMaterialFilesForRun(...args: any[]): Promise<void> {
    return this.delegateCourseRunVersion('deleteUnreferencedMaterialFilesForRun', args);
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

  // Learning material methods are implemented in the domain service.
  private delegateLearningMaterial(methodName: string, args: unknown[]): any {
    return this.learningMaterialService[methodName](...args);
  }

  private normalizeMaterialType(...args: any[]): LearningMaterialType {
    return this.delegateLearningMaterial('normalizeMaterialType', args);
  }

  private parseTags(...args: any[]): string[] {
    return this.delegateLearningMaterial('parseTags', args);
  }

  private parsePreviewMetadata(...args: any[]): Record<string, unknown> | undefined {
    return this.delegateLearningMaterial('parsePreviewMetadata', args);
  }

  private parseSortOrder(...args: any[]): number {
    return this.delegateLearningMaterial('parseSortOrder', args);
  }

  private requireMaterialTitle(...args: any[]): string {
    return this.delegateLearningMaterial('requireMaterialTitle', args);
  }

  private validateExternalUrl(...args: any[]): string {
    return this.delegateLearningMaterial('validateExternalUrl', args);
  }

  private validateUploadedMaterialFile(file?: UploadedLearningMaterialFile): asserts file is UploadedLearningMaterialFile & {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  } {
    this.delegateLearningMaterial('validateUploadedMaterialFile', [file]);
  }

  private normalizeMaterialReleaseMode(...args: any[]): LearningMaterialReleaseMode {
    return this.delegateLearningMaterial('normalizeMaterialReleaseMode', args);
  }

  private hasProvidedValue(...args: any[]): boolean {
    return this.delegateLearningMaterial('hasProvidedValue', args);
  }

  private hasOwnInputField(...args: any[]): boolean {
    return this.delegateLearningMaterial('hasOwnInputField', args);
  }

  private parseReleaseDate(...args: any[]): Date | null {
    return this.delegateLearningMaterial('parseReleaseDate', args);
  }

  private async applyLearningMaterialReleaseConfiguration(...args: any[]): Promise<void> {
    return this.delegateLearningMaterial('applyLearningMaterialReleaseConfiguration', args);
  }

  private async buildLearningMaterialVisibility(...args: any[]): Promise<LearningMaterialVisibility> {
    return this.delegateLearningMaterial('buildLearningMaterialVisibility', args);
  }

  private async mapLearningMaterialForActor(...args: any[]): Promise<LearningMaterialResponseDto> {
    return this.delegateLearningMaterial('mapLearningMaterialForActor', args);
  }

  private formatGermanDateTime(...args: any[]): string {
    return this.delegateLearningMaterial('formatGermanDateTime', args);
  }

  private async findLearningMaterialOrThrow(...args: any[]): Promise<LearningMaterial> {
    return this.delegateLearningMaterial('findLearningMaterialOrThrow', args);
  }

  private async assertLearningMaterialReadable(...args: any[]): Promise<CourseMemberRole> {
    return this.delegateLearningMaterial('assertLearningMaterialReadable', args);
  }

  private async assertLearningMaterialManageable(...args: any[]): Promise<void> {
    return this.delegateLearningMaterial('assertLearningMaterialManageable', args);
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

  private normalizeOptionalText(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const text = String(value).trim();

    return text.length > 0 ? text : null;
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

      result.push(await this.mapCourseCatalogItemWithCounts(course, null, currentRun));
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

    const activeEnrollments = enrollments
      .filter((enrollment) => Boolean(enrollment.course))
      .filter((enrollment) => enrollment.courseRun?.isActive === true);

    for (const enrollment of activeEnrollments) {
      coursesById.set(
        enrollment.course.id,
        await this.mapCourseCatalogItemWithCounts(
          enrollment.course,
          enrollment,
          enrollment.courseRun,
        ),
      );
    }

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
            await this.mapCourseCatalogItemWithCounts(course, teacherEnrollment, currentRun),
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

  async listAuditEvents(
    courseId: string | number,
    query: AuditEventListQueryDto = {},
    actorUserId?: string | number,
  ): Promise<AuditEventResponseDto[]> {
    if (!this.auditLogService) {
      return [];
    }

    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorId,
      CoursePermission.ManageCourse,
    );

    if (query.courseRunId) {
      await this.assertCourseRunManageable(
        normalizedCourseId,
        query.courseRunId,
        actorId,
      );
    }

    const events = await this.auditLogService.listEvents({
      courseId: normalizedCourseId,
      courseRunId: query.courseRunId,
      eventType: query.eventType,
      from: this.parseAuditDate(query.from, 'from'),
      to: this.parseAuditDate(query.to, 'to'),
      limit: this.parseAuditLimit(query.limit),
    });

    return events.map(mapAuditEventToDto);
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
    const initialVersion = await this.createInitialContentVersionForRun(
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

    await this.recordAuditEvent({
      eventType: AuditEventType.COURSE_CREATED,
      actorUserId: actorId ?? ownerId?.toString(),
      actorRole: CourseMemberRole.TEACHER,
      courseId: savedCourse.id,
      entityType: 'course',
      entityId: savedCourse.id,
      summary: `Kurs erstellt: ${savedCourse.title}`,
      metadataJson: {
        status: savedCourse.status,
        recurrenceType: savedCourse.recurrenceType,
      },
    });
    await this.recordAuditEvent({
      eventType: AuditEventType.COURSE_RUN_CREATED,
      actorUserId: actorId ?? ownerId?.toString(),
      actorRole: CourseMemberRole.TEACHER,
      courseId: savedCourse.id,
      courseRunId: initialRun.id,
      entityType: 'course_run',
      entityId: initialRun.id,
      summary: `Initialer Kursdurchlauf erstellt: ${initialRun.label}`,
      metadataJson: {
        status: initialRun.status,
        active: initialRun.isActive,
      },
    });
    await this.recordAuditEvent({
      eventType: AuditEventType.CONTENT_VERSION_CREATED,
      actorUserId: actorId ?? ownerId?.toString(),
      actorRole: CourseMemberRole.TEACHER,
      courseId: savedCourse.id,
      courseRunId: initialRun.id,
      courseVersionId: initialVersion.id,
      entityType: 'course_version',
      entityId: initialVersion.id,
      summary: `Initiale Inhaltsversion erstellt: ${initialVersion.label}`,
      metadataJson: {
        versionNumber: initialVersion.version_number,
        active: initialVersion.is_active,
      },
    });

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
    await this.recordAuditEvent({
      eventType: AuditEventType.STUDENT_ENROLLED,
      actorUserId: actorId,
      actorRole: CourseMemberRole.STUDENT,
      courseId: normalizedCourseId,
      courseRunId: currentRun.id,
      entityType: 'enrollment',
      entityId: savedEnrollment.id,
      summary: `Student eingeschrieben: ${actorId}`,
      metadataJson: {
        studentId: actorId,
      },
    });

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

    const result = await this.enrollmentRepository.delete({
      courseId: this.toCourseId(courseId),
      courseRunId: (await this.getCurrentCourseRunOrCreate(courseId)).id,
      userId: normalizedUserId,
    });

    if ((result.affected ?? 0) > 0) {
      await this.recordAuditEvent({
        eventType: AuditEventType.STUDENT_REMOVED,
        actorUserId: actorId,
        courseId,
        entityType: 'enrollment',
        entityId: normalizedUserId,
        summary: `Student aus Kurs entfernt: ${normalizedUserId}`,
        metadataJson: {
          studentId: normalizedUserId,
        },
      });
    }
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

    const savedCourse = await this.coursesRepository.save(course);
    await this.recordAuditEvent({
      eventType: AuditEventType.COURSE_UPDATED,
      actorUserId: actorId,
      courseId: savedCourse.id,
      entityType: 'course',
      entityId: savedCourse.id,
      summary: `Kurs aktualisiert: ${savedCourse.title}`,
      metadataJson: {
        status: savedCourse.status,
        recurrenceType: savedCourse.recurrenceType,
      },
    });

    return mapCourseToDto(savedCourse);
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

  async createLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('createLearningMaterial', args);
  }

  async createLearningMaterialFile(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('createLearningMaterialFile', args);
  }

  async createExternalLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('createExternalLearningMaterial', args);
  }

  async getLearningMaterialsByCourse(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('getLearningMaterialsByCourse', args);
  }

  async getLearningMaterialsByCourseRun(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('getLearningMaterialsByCourseRun', args);
  }

  async getLearningMaterialsByCourseVersion(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('getLearningMaterialsByCourseVersion', args);
  }

  async getLearningMaterialById(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('getLearningMaterialById', args);
  }

  async updateLearningMaterialMetadata(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('updateLearningMaterialMetadata', args);
  }

  async updateLearningMaterialSortOrder(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('updateLearningMaterialSortOrder', args);
  }

  async deleteLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('deleteLearningMaterial', args);
  }

  async publishLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('publishLearningMaterial', args);
  }

  async unpublishLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('unpublishLearningMaterial', args);
  }

  async downloadLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('downloadLearningMaterial', args);
  }

  async getMyCourseResult(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    return this.courseResultService.getMyCourseResult(courseId, actorUserId);
  }

  async getCourseResults(
    courseId: string,
    query: CourseResultListQueryDto = {},
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    return this.courseResultService.getCourseResults(courseId, query, actorUserId);
  }

  async getCourseResultsByRun(
    courseId: string,
    runId: string,
    query: CourseResultListQueryDto = {},
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    return this.courseResultService.getCourseResultsByRun(courseId, runId, query, actorUserId);
  }

  async setManualCourseResult(
    courseId: string,
    studentId: string,
    body: ManualCourseResultDto,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    return this.courseResultService.setManualCourseResult(courseId, studentId, body, actorUserId);
  }

  async recalculateCourseResult(
    courseId: string,
    studentId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    return this.courseResultService.recalculateCourseResult(courseId, studentId, actorUserId);
  }

  async recalculateAllCourseResults(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    return this.courseResultService.recalculateAllCourseResults(courseId, actorUserId);
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

  async listCourseVersions(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('listCourseVersions', args);
  }

  async listCourseVersionsByRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('listCourseVersionsByRun', args);
  }

  async listCourseVersionTemplates(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('listCourseVersionTemplates', args);
  }

  async getCourseVersion(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('getCourseVersion', args);
  }

  async createCourseVersion(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('createCourseVersion', args);
  }

  async createCourseVersionForRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('createCourseVersionForRun', args);
  }

  async activateCourseVersion(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('activateCourseVersion', args);
  }

  async activateCourseVersionForRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('activateCourseVersionForRun', args);
  }

  async deleteCourseVersion(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('deleteCourseVersion', args);
  }

  async listCourseRuns(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('listCourseRuns', args);
  }

  async getCurrentCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('getCurrentCourseRun', args);
  }

  async getCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('getCourseRun', args);
  }

  async getCourseRunPlan(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('getCourseRunPlan', args);
  }

  async updateCourseRunPlanTemplate(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('updateCourseRunPlanTemplate', args);
  }

  async createCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('createCourseRun', args);
  }

  async createSpecialCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('createSpecialCourseRun', args);
  }

  async activateCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('activateCourseRun', args);
  }

  async deleteOrArchiveCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('deleteOrArchiveCourseRun', args);
  }

  // Learning task and progress methods are implemented in the domain service.
  private readonly learningTaskService = new LearningTaskService(this as any).api;

  private delegateLearningTask(methodName: string, args: unknown[]): any {
    return this.learningTaskService[methodName](...args);
  }

  private requireTaskTitle(...args: any[]): string {
    return this.delegateLearningTask('requireTaskTitle', args);
  }

  private parseTaskAssessmentNumber(...args: any[]): number | null {
    return this.delegateLearningTask('parseTaskAssessmentNumber', args);
  }

  private async initializeImmediateTaskProgressForEnrollment(...args: any[]): Promise<void> {
    return this.delegateLearningTask('initializeImmediateTaskProgressForEnrollment', args);
  }

  private async findLearningTaskOrThrow(...args: any[]): Promise<Task> {
    return this.delegateLearningTask('findLearningTaskOrThrow', args);
  }

  private async assertTaskReadable(...args: any[]): Promise<CourseMemberRole> {
    return this.delegateLearningTask('assertTaskReadable', args);
  }

  private async findStudentEnrollmentOrThrow(...args: any[]): Promise<Enrollment> {
    return this.delegateLearningTask('findStudentEnrollmentOrThrow', args);
  }

  private async assertCurrentStudentEnrollment(...args: any[]): Promise<Enrollment> {
    return this.delegateLearningTask('assertCurrentStudentEnrollment', args);
  }

  private async ensureTaskProgress(...args: any[]): Promise<TaskProgress> {
    return this.delegateLearningTask('ensureTaskProgress', args);
  }

  private async ensureTaskAssessment(...args: any[]): Promise<TaskAssessment> {
    return this.delegateLearningTask('ensureTaskAssessment', args);
  }

  private async saveTaskAssessment(...args: any[]): Promise<TaskAssessment> {
    return this.delegateLearningTask('saveTaskAssessment', args);
  }

  private async applyAssessmentToProgress(...args: any[]): Promise<void> {
    return this.delegateLearningTask('applyAssessmentToProgress', args);
  }

  private async buildLearningPathForEnrollment(...args: any[]): Promise<LearningPathResponseDto> {
    return this.delegateLearningTask('buildLearningPathForEnrollment', args);
  }

  private isTaskCompletionSuccessful(...args: any[]): boolean {
    return this.delegateLearningTask('isTaskCompletionSuccessful', args);
  }

  async createLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('createLearningTask', args);
  }

  async getTasksByCourse(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getTasksByCourse', args);
  }

  async getTasksByCourseRun(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getTasksByCourseRun', args);
  }

  async getTasksByCourseVersion(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getTasksByCourseVersion', args);
  }

  async getTaskById(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getTaskById', args);
  }

  async updateLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('updateLearningTask', args);
  }

  async updateLearningTaskReleaseConfig(...args: any[]): Promise<any> {
    return this.delegateLearningTask('updateLearningTaskReleaseConfig', args);
  }

  async updateLearningTaskSortOrder(...args: any[]): Promise<any> {
    return this.delegateLearningTask('updateLearningTaskSortOrder', args);
  }

  async deleteTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('deleteTask', args);
  }

  async publishTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('publishTask', args);
  }

  async unpublishTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('unpublishTask', args);
  }

  async getLearningPathProgress(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getLearningPathProgress', args);
  }

  async startLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('startLearningTask', args);
  }

  async recordTaskResult(...args: any[]): Promise<any> {
    return this.delegateLearningTask('recordTaskResult', args);
  }

  async selfConfirmLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('selfConfirmLearningTask', args);
  }

  async submitLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('submitLearningTask', args);
  }

  async submitLearningTaskWithUpload(...args: any[]): Promise<any> {
    return this.delegateLearningTask('submitLearningTaskWithUpload', args);
  }

  async downloadTaskSubmissionFile(...args: any[]): Promise<any> {
    return this.delegateLearningTask('downloadTaskSubmissionFile', args);
  }

  async mockEvaluateLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('mockEvaluateLearningTask', args);
  }

  async completeLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('completeLearningTask', args);
  }

  async failLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('failLearningTask', args);
  }

  async setManualTaskAssessment(...args: any[]): Promise<any> {
    return this.delegateLearningTask('setManualTaskAssessment', args);
  }

  async resetTaskAssessment(...args: any[]): Promise<any> {
    return this.delegateLearningTask('resetTaskAssessment', args);
  }

  async listTaskAssessmentsByRun(...args: any[]): Promise<any> {
    return this.delegateLearningTask('listTaskAssessmentsByRun', args);
  }

  async listTaskAssessmentsByTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('listTaskAssessmentsByTask', args);
  }

  async manuallyUnlockLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('manuallyUnlockLearningTask', args);
  }

  async getLearningTaskProgressForStudent(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getLearningTaskProgressForStudent', args);
  }

  async getLearningTaskProgressOverview(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getLearningTaskProgressOverview', args);
  }

  async getLearningTaskProgressOverviewByRun(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getLearningTaskProgressOverviewByRun', args);
  }

  async createStudyGroup(...args: any[]): Promise<any> {
    return this.delegateLearningTask('createStudyGroup', args);
  }

  async listStudyGroups(...args: any[]): Promise<any> {
    return this.delegateLearningTask('listStudyGroups', args);
  }

  async getMyStudyGroup(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getMyStudyGroup', args);
  }

  async updateStudyGroup(...args: any[]): Promise<any> {
    return this.delegateLearningTask('updateStudyGroup', args);
  }

  async deleteStudyGroup(...args: any[]): Promise<any> {
    return this.delegateLearningTask('deleteStudyGroup', args);
  }

  async addStudyGroupMember(...args: any[]): Promise<any> {
    return this.delegateLearningTask('addStudyGroupMember', args);
  }

  async removeStudyGroupMember(...args: any[]): Promise<any> {
    return this.delegateLearningTask('removeStudyGroupMember', args);
  }

  async startGroupLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('startGroupLearningTask', args);
  }

  async submitGroupLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('submitGroupLearningTask', args);
  }

  async setManualGroupTaskAssessment(...args: any[]): Promise<any> {
    return this.delegateLearningTask('setManualGroupTaskAssessment', args);
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
