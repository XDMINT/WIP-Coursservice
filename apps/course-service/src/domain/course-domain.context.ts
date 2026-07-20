import { randomUUID } from 'crypto';
import {
  ApiForbiddenError,
  ApiNotFoundError,
  ApiUnauthorizedError,
  ApiValidationError,
} from '../common/api-errors';
import {
  CoursePermission,
  hasCoursePermission,
  normalizeCourseRole as normalizePermissionCourseRole,
} from '../courses.permissions';
import { AuditLogService } from '../audit-log.service';
import { Assignment } from '../entities/assignment.entity';
import { AuditEventType } from '../entities/audit-event.entity';
import { CourseRun } from '../entities/course-run.entity';
import { Course, CourseStatus } from '../entities/course.entity';
import { CourseMemberRole, Enrollment } from '../entities/enrollment.entity';
import { Task, TaskGradingMode } from '../entities/task.entity';
import {
  CourseCatalogItemResponseDto,
  CourseRunResponseDto,
  mapCourseToCatalogItemDto,
} from '../dto/course.dto';
import { CreateLearningTaskDto, UpdateLearningTaskDto } from '../dto/learning-process.dto';
import { CourseRepositories } from '../persistence/course-repositories';
import { LocalMaterialStorage } from '../storage/material-storage';
import { TaskEvaluationClient } from '../task-evaluation.client';
import { TaskServiceClient, TaskServiceTask } from '../task-service.client';

export type CourseDomainFacade = CourseDomainContext & Record<PropertyKey, any>;

export type CourseDomainContextDependencies = {
  repositories: CourseRepositories;
  materialStorage: LocalMaterialStorage;
  auditLogService?: AuditLogService;
  taskServiceClient?: TaskServiceClient;
  taskEvaluationClient?: TaskEvaluationClient;
};

type DomainDelegate = Record<PropertyKey, any> & {
  api?: Record<PropertyKey, any>;
};

const bindIfFunction = (value: unknown, receiver: unknown): unknown =>
  typeof value === 'function' ? (value as Function).bind(receiver) : value;

export class CourseDomainContext implements CourseDomainContextDependencies {
  repositories!: CourseRepositories;
  materialStorage!: LocalMaterialStorage;
  auditLogService?: AuditLogService;
  taskServiceClient?: TaskServiceClient;
  taskEvaluationClient?: TaskEvaluationClient;

  private readonly fallbackTaskServiceClient = new TaskServiceClient();
  private readonly fallbackTaskEvaluationClient = new TaskEvaluationClient(
    this.fallbackTaskServiceClient,
  );
  private domainDelegates: Record<PropertyKey, any>[] = [];
  private readonly domainServiceAliases = new Map<PropertyKey, unknown>();

  constructor(dependencies: CourseDomainContextDependencies) {
    Object.assign(this, dependencies);
  }

  registerDomainServices(...services: DomainDelegate[]): void {
    this.domainServiceAliases.clear();
    this.domainDelegates = services.map((service) => service.api ?? service);

    for (const service of services) {
      const serviceName = service.constructor?.name;

      if (!serviceName) {
        continue;
      }

      const alias = `${serviceName.charAt(0).toLowerCase()}${serviceName.slice(1)}`;
      this.domainServiceAliases.set(alias, service.api ?? service);
    }
  }

  resolveDomainProperty(property: PropertyKey): unknown {
    if (this.domainServiceAliases.has(property)) {
      return this.domainServiceAliases.get(property);
    }

    for (const delegate of this.domainDelegates) {
      if (property in delegate) {
        return delegate[property];
      }
    }

    return undefined;
  }

  callDomainMethod<T>(methodName: string, args: unknown[]): T {
    const method = this.resolveDomainProperty(methodName);

    if (typeof method !== 'function') {
      throw new Error(`Domain method ${methodName} is not available`);
    }

    return method(...args);
  }

  toCourseId(id: string | number): string {
    return String(id);
  }

  getTaskServiceClient(): TaskServiceClient {
    return this.taskServiceClient ?? this.fallbackTaskServiceClient;
  }

  getTaskEvaluationClient(): TaskEvaluationClient | TaskServiceClient {
    return this.taskEvaluationClient
      ?? this.taskServiceClient
      ?? this.fallbackTaskEvaluationClient;
  }

  applyTaskServiceContent(
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

  async enrichTaskReferences<T extends Task>(references: T[]): Promise<T[]> {
    const taskContents = await this.loadTaskContents(references);

    return references.map((reference) =>
      this.applyTaskServiceContent(
        reference,
        taskContents.get(reference.externalTaskId ?? reference.id),
      ) as T,
    );
  }

  async enrichTaskReference<T extends Task>(reference: T): Promise<T> {
    return (await this.enrichTaskReferences([reference]))[0];
  }

  buildTaskServicePayload(
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

  localTaskContent(
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

  async loadTaskContents<T extends Task>(
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

  async createTaskContent(
    payload: TaskServiceTask & { id: string },
  ): Promise<TaskServiceTask> {
    const client = this.taskServiceClient as any;

    if (client && typeof client.createTask === 'function') {
      return client.createTask(payload);
    }

    return this.localTaskContent(payload);
  }

  async updateTaskContent(
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

  async deleteTaskContent(taskId: string): Promise<void> {
    const client = this.taskServiceClient as any;

    if (client && typeof client.deleteTask === 'function') {
      await client.deleteTask(taskId);
    }
  }

  toUserId(userId: string | number): string {
    return String(userId);
  }

  parseAuditLimit(value: unknown): number {
    const numericLimit = Number(value ?? 100);

    if (!Number.isFinite(numericLimit)) {
      return 100;
    }

    return Math.min(Math.max(Math.floor(numericLimit), 1), 100);
  }

  parseAuditDate(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const date = new Date(String(value));

    if (Number.isNaN(date.getTime())) {
      throw new ApiValidationError(`Invalid audit ${fieldName} date`);
    }

    return date;
  }

  async resolveAuditActorRole(
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

  async recordAuditEvent(input: {
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

  toOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  normalizeCourseStatus(status: unknown): CourseStatus | undefined {
    if (status === undefined || status === null || status === '') {
      return undefined;
    }

    const normalizedStatus = String(status).toUpperCase() as CourseStatus;

    if (!Object.values(CourseStatus).includes(normalizedStatus)) {
      throw new ApiValidationError('Invalid course status');
    }

    return normalizedStatus;
  }

  async mapCourseCatalogItemWithCounts(
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

  normalizeCourseRole(role: string): CourseMemberRole {
    try {
      return normalizePermissionCourseRole(role);
    } catch {
      throw new ApiValidationError('Invalid course role');
    }
  }

  createExternalCourseId(): string {
    return `course-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  requireActorUserId(actorUserId?: string | number): string {
    if (actorUserId === undefined || actorUserId === null || actorUserId === '') {
      throw new ApiUnauthorizedError();
    }

    return this.toUserId(actorUserId);
  }

  requireCourseTitle(title: unknown): string {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new ApiValidationError('Course title is required', ['title must not be empty']);
    }

    return title.trim();
  }

  async findCourseOrThrow(courseId: string | number): Promise<Course> {
    const course = await this.repositories.courses.findOne({
      where: { id: this.toCourseId(courseId) },
    });

    if (!course) {
      throw new ApiNotFoundError('Course not found');
    }

    return course;
  }

  async resolveCourseRole(
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

    const ownedCourse = await this.repositories.courses.findOne({
      where: {
        id: normalizedCourseId,
        owner_id: ownerId,
      },
    });

    return ownedCourse ? CourseMemberRole.TEACHER : null;
  }

  async assertCoursePermission(
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

  async findCourseEnrollment(
    courseId: string,
    userId: string | number,
    courseRunId?: string,
  ): Promise<Enrollment | null> {
    const resolvedRunId =
      courseRunId ?? (await this.findCurrentCourseRun(courseId))?.id;

    return this.repositories.enrollments.findOne({
      where: {
        courseId,
        ...(resolvedRunId ? { courseRunId: resolvedRunId } : {}),
        userId: this.toUserId(userId),
      },
    });
  }

  normalizeOptionalText(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const text = String(value).trim();

    return text.length > 0 ? text : null;
  }

  parsePaginationValue(
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

  ensureValidAssignmentMaxPoints(assignment: Assignment): number {
    const maxPoints = Number(assignment.maxPoints);

    if (!Number.isFinite(maxPoints) || maxPoints < 0) {
      throw new ApiValidationError('Assignment max points must be non-negative');
    }

    return maxPoints;
  }

  ensureValidAutomaticGradePoints(
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

  requireTaskTitle(...args: unknown[]): string {
    return this.callDomainMethod<string>('requireTaskTitle', args);
  }

  parseTaskAssessmentNumber(...args: unknown[]): number | null {
    return this.callDomainMethod<number | null>('parseTaskAssessmentNumber', args);
  }

  async mapCourseRunWithCounts(...args: unknown[]): Promise<CourseRunResponseDto> {
    return this.callDomainMethod<Promise<CourseRunResponseDto>>('mapCourseRunWithCounts', args);
  }

  async findCurrentCourseRun(...args: unknown[]): Promise<CourseRun | null> {
    return this.callDomainMethod<Promise<CourseRun | null>>('findCurrentCourseRun', args);
  }
}

export const createCourseDomainFacade = (
  context: CourseDomainContext,
): CourseDomainFacade =>
  new Proxy(context as CourseDomainFacade, {
    get: (target, property, receiver) => {
      if (property in target) {
        return bindIfFunction(Reflect.get(target, property, receiver), receiver);
      }

      return target.resolveDomainProperty(property);
    },
    set: (target, property, value, receiver) => {
      if (property in target) {
        return Reflect.set(target, property, value, receiver);
      }

      target[property] = value;
      return true;
    },
  });
