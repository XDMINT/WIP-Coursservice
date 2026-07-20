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
import { AssignmentGradeService } from './domain/assignment-grade.service';
import { CalendarEventService } from './domain/calendar-event.service';
import { ContentReleaseTemplateService } from './domain/content-release-template.service';
import { CourseCatalogService } from './domain/course-catalog.service';
import { CourseSearchService } from './domain/course-search.service';
import { LegacyWorkgroupService } from './domain/legacy-workgroup.service';
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
  private readonly courseCatalogService = new CourseCatalogService(this as any).api;
  private readonly assignmentGradeService = new AssignmentGradeService(this as any).api;
  private readonly contentReleaseTemplateService = new ContentReleaseTemplateService(this as any).api;
  private readonly courseSearchService = new CourseSearchService(this as any).api;
  private readonly legacyWorkgroupService = new LegacyWorkgroupService(this as any).api;
  private readonly calendarEventService = new CalendarEventService(this as any).api;

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

  private delegateCourseCatalog(methodName: string, args: unknown[]): any {
    return this.courseCatalogService[methodName](...args);
  }

  private delegateAssignmentGrade(methodName: string, args: unknown[]): any {
    return this.assignmentGradeService[methodName](...args);
  }

  private delegateContentReleaseTemplate(methodName: string, args: unknown[]): any {
    return this.contentReleaseTemplateService[methodName](...args);
  }

  private delegateCourseSearch(methodName: string, args: unknown[]): any {
    return this.courseSearchService[methodName](...args);
  }

  private delegateLegacyWorkgroup(methodName: string, args: unknown[]): any {
    return this.legacyWorkgroupService[methodName](...args);
  }

  private delegateCalendarEvent(methodName: string, args: unknown[]): any {
    return this.calendarEventService[methodName](...args);
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

  async findAll(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('findAll', args);
  }

  async getAvailableCourses(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getAvailableCourses', args);
  }

  async getEnrolledCourses(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getEnrolledCourses', args);
  }

  async findOne(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('findOne', args);
  }

  async getUserRoleInCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getUserRoleInCourse', args);
  }

  async getCourseContext(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getCourseContext', args);
  }

  async getCourseMembers(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getCourseMembers', args);
  }

  async getCourseMembersByRun(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getCourseMembersByRun', args);
  }

  async listAuditEvents(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('listAuditEvents', args);
  }

  async createCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('createCourse', args);
  }

  async joinCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('joinCourse', args);
  }

  async enrollInCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('enrollInCourse', args);
  }

  async leaveCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('leaveCourse', args);
  }

  async updateCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('updateCourse', args);
  }

  async changeUserRole(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('changeUserRole', args);
  }

  async removeCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('removeCourse', args);
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
  async createAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('createAssignment', args);
  }

  async getAssignmentsByCourse(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getAssignmentsByCourse', args);
  }

  async getAssignmentById(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getAssignmentById', args);
  }

  async updateAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('updateAssignment', args);
  }

  async deleteAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('deleteAssignment', args);
  }

  async publishAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('publishAssignment', args);
  }

  async unpublishAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('unpublishAssignment', args);
  }

  // Grade methods
  async createGrade(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('createGrade', args);
  }

  async getGradesByAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getGradesByAssignment', args);
  }

  async getGradesByEnrollment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getGradesByEnrollment', args);
  }

  async getGradeById(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getGradeById', args);
  }

  async updateGrade(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('updateGrade', args);
  }

  async deleteGrade(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('deleteGrade', args);
  }

  async calculateCourseGrade(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('calculateCourseGrade', args);
  }

  async getCoursePerformance(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getCoursePerformance', args);
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
  async createContentRelease(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('createContentRelease', args);
  }

  async getContentReleasesByCourse(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getContentReleasesByCourse', args);
  }

  async getContentReleaseById(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getContentReleaseById', args);
  }

  async updateContentRelease(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('updateContentRelease', args);
  }

  async deleteContentRelease(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('deleteContentRelease', args);
  }

  async releaseContentManually(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('releaseContentManually', args);
  }

  async checkAutomaticReleases(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('checkAutomaticReleases', args);
  }

  async checkProgressBasedReleases(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('checkProgressBasedReleases', args);
  }

  async getReleasedContentForEnrollment(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getReleasedContentForEnrollment', args);
  }

  async getContentReleaseStatus(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getContentReleaseStatus', args);
  }

  // Content Template methods
  async createContentTemplate(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('createContentTemplate', args);
  }

  async getContentTemplatesByCourse(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getContentTemplatesByCourse', args);
  }

  async getGlobalContentTemplates(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getGlobalContentTemplates', args);
  }

  async getContentTemplateById(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getContentTemplateById', args);
  }

  async updateContentTemplate(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('updateContentTemplate', args);
  }

  async deleteContentTemplate(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('deleteContentTemplate', args);
  }

  async applyTemplateToCourse(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('applyTemplateToCourse', args);
  }

  async getAvailableTemplatesForCourse(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getAvailableTemplatesForCourse', args);
  }

  // Search methods
  async searchCourses(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchCourses', args);
  }

  async searchLearningMaterials(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchLearningMaterials', args);
  }

  async searchAssignments(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchAssignments', args);
  }

  async searchTasks(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchTasks', args);
  }

  async searchContentTemplates(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchContentTemplates', args);
  }

  async advancedSearch(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('advancedSearch', args);
  }

  async searchWithinCourse(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchWithinCourse', args);
  }

  // Workgroup methods
  async createCourseGroup(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('createCourseGroup', args);
  }

  async getCourseGroupsByCourse(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getCourseGroupsByCourse', args);
  }

  async getCourseGroupById(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getCourseGroupById', args);
  }

  async updateCourseGroup(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('updateCourseGroup', args);
  }

  async deleteCourseGroup(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('deleteCourseGroup', args);
  }

  async addMemberToGroup(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('addMemberToGroup', args);
  }

  async removeMemberFromGroup(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('removeMemberFromGroup', args);
  }

  async updateGroupMembershipRole(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('updateGroupMembershipRole', args);
  }

  async getGroupMembers(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getGroupMembers', args);
  }

  async getGroupsForUser(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getGroupsForUser', args);
  }

  async getGroupMembership(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getGroupMembership', args);
  }

  async assignGroupGrade(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('assignGroupGrade', args);
  }

  async assignIndividualGrade(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('assignIndividualGrade', args);
  }

  async getGroupPerformance(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getGroupPerformance', args);
  }

  async autoCreateWorkgroups(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('autoCreateWorkgroups', args);
  }

  async getGroupLearningProgress(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getGroupLearningProgress', args);
  }

  // Calendar Event methods
  async createCalendarEvent(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('createCalendarEvent', args);
  }

  async getCalendarEventsByCourse(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getCalendarEventsByCourse', args);
  }

  async getCalendarEventById(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getCalendarEventById', args);
  }

  async updateCalendarEvent(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('updateCalendarEvent', args);
  }

  async deleteCalendarEvent(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('deleteCalendarEvent', args);
  }

  async createAssignmentDueDateEvents(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('createAssignmentDueDateEvents', args);
  }

  async getUpcomingEvents(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getUpcomingEvents', args);
  }

  async getEventsByDateRange(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getEventsByDateRange', args);
  }

  async getDailyEvents(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getDailyEvents', args);
  }

  async getMonthlyEvents(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getMonthlyEvents', args);
  }

  async syncAssignmentDueDates(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('syncAssignmentDueDates', args);
  }
}
