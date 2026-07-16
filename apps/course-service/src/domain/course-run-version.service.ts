import { randomUUID } from 'crypto';
import { In, IsNull, Not } from 'typeorm';
import { CoursePermission, hasCoursePermission } from '../courses.permissions';
import { ApiForbiddenError, ApiNotFoundError, ApiValidationError } from '../common/api-errors';
import {
  CourseRunDeletionResponseDto,
  CourseRunPlanResponseDto,
  CourseRunResponseDto,
  CourseVersionResponseDto,
  CreateCourseRunDto,
  CreateCourseVersionDto,
  UpdateCourseRunPlanTemplateDto,
  mapCourseRunToDto,
  mapCourseVersionToDto,
} from '../dto/course.dto';
import { AuditEventType } from '../entities/audit-event.entity';
import { Course, CourseRunTemplateStrategy, CourseStatus } from '../entities/course.entity';
import {
  CourseRecurrenceType,
  CourseRun,
  CourseRunStatus,
} from '../entities/course-run.entity';
import { CourseVersion, CourseVersionStatus } from '../entities/course-version.entity';
import { CourseMemberRole } from '../entities/enrollment.entity';
import {
  LearningMaterial,
  LearningMaterialPublicationStatus,
  LearningMaterialReleaseMode,
  LearningMaterialType,
} from '../entities/learning-material.entity';
import { Task, TaskGradingMode, TaskUnlockMode, TaskWorkMode } from '../entities/task.entity';

type CourseServiceFacade = any;

type CourseVersionSnapshotTask = {
  id?: string;
  externalTaskId?: string;
  title?: string;
  description?: string;
  type?: string;
  content?: Record<string, unknown>;
  order?: number;
  unlockMode?: TaskUnlockMode | string;
  prerequisiteTaskId?: string | null;
  completionCriteria?: unknown;
  isPublished?: boolean;
  demoKey?: string | null;
  gradingMode?: TaskGradingMode | string;
  workMode?: TaskWorkMode | string;
  maxPoints?: number | string | null;
  passThreshold?: number | string | null;
  feedbackRequired?: boolean;
  allowRetries?: boolean;
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

export class CourseRunVersionService {
  [key: string]: any;

  readonly api: any;

  constructor(private readonly courseService: CourseServiceFacade) {
    this.api = new Proxy(this, {
      get: (target, property, receiver) => {
        if (property in target) {
          const value = Reflect.get(target, property, receiver);

          return typeof value === 'function' ? (value as Function).bind(receiver) : value;
        }

        const value = target.courseService?.[property as keyof CourseServiceFacade];

        return typeof value === 'function'
          ? (value as Function).bind(target.courseService)
          : value;
      },
      set: (target, property, value, receiver) => {
        if (property in target) {
          return Reflect.set(target, property, value, receiver);
        }

        target.courseService[property as keyof CourseServiceFacade] = value;

        return true;
      },
    });
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
    const [materials, taskReferences] = await Promise.all([
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
    const tasks = await this.enrichTaskReferences(taskReferences);

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
        externalTaskId: task.externalTaskId,
        courseVersionId: task.courseVersionId,
        title: task.title,
        description: task.description,
        type: task.type,
        content: task.content ?? {},
        order: task.order,
        unlockMode: task.unlockMode,
        prerequisiteTaskId: task.prerequisiteTaskId,
        demoKey: task.demoKey,
        isPublished: task.isPublished,
        gradingMode: task.gradingMode ?? TaskGradingMode.NOT_GRADED,
        workMode: task.workMode ?? TaskWorkMode.INDIVIDUAL,
        maxPoints: task.maxPoints,
        passThreshold: task.passThreshold,
        feedbackRequired: task.feedbackRequired === true,
        allowRetries: task.allowRetries === true,
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
    const sourceTaskReferences = await this.taskRepository.find({
      where: {
        courseRunId: sourceRunId,
        ...(sourceVersionId ? { courseVersionId: sourceVersionId } : {}),
      },
      order: {
        order: 'ASC',
      },
    });
    const sourceTasks = await this.enrichTaskReferences(sourceTaskReferences);
    const taskIdMap = new Map<string, string>();

    for (const source of sourceTasks) {
      const taskServiceTask = await this.createTaskContent({
        id: randomUUID(),
        ...this.buildTaskServicePayload({}, source),
      });
      const task = new Task();
      task.externalTaskId = taskServiceTask.id;
      task.courseId = targetRun.courseId;
      task.courseRunId = targetRun.id;
      task.courseRun = targetRun;
      task.courseVersionId = targetVersion?.id;
      task.courseVersion = targetVersion;
      task.order = source.order;
      task.unlockMode = source.unlockMode;
      task.prerequisiteTaskId = undefined;
      task.isPublished = source.isPublished;
      task.gradingMode = source.gradingMode ?? TaskGradingMode.NOT_GRADED;
      task.workMode = source.workMode ?? TaskWorkMode.INDIVIDUAL;
      task.maxPoints = source.maxPoints;
      task.passThreshold = source.passThreshold;
      task.feedbackRequired = source.feedbackRequired === true;
      task.allowRetries = source.allowRetries === true;
      task.createdBy = actorId;
      task.updatedBy = actorId;
      this.applyTaskServiceContent(task, taskServiceTask);
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

  private normalizeSnapshotTaskGradingMode(value: unknown): TaskGradingMode {
    const normalizedValue = String(value ?? TaskGradingMode.NOT_GRADED).toUpperCase() as TaskGradingMode;

    return Object.values(TaskGradingMode).includes(normalizedValue)
      ? normalizedValue
      : TaskGradingMode.NOT_GRADED;
  }

  private normalizeSnapshotTaskWorkMode(value: unknown): TaskWorkMode {
    const normalizedValue = String(value ?? TaskWorkMode.INDIVIDUAL).toUpperCase() as TaskWorkMode;

    return Object.values(TaskWorkMode).includes(normalizedValue)
      ? normalizedValue
      : TaskWorkMode.INDIVIDUAL;
  }

  private parseSnapshotTaskNumber(value?: number | string | null): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) && parsedValue >= 0
      ? parsedValue
      : null;
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
      const maxPoints = this.parseSnapshotTaskNumber(source.maxPoints);
      const passThreshold = this.parseSnapshotTaskNumber(source.passThreshold);
      const gradingMode = this.normalizeSnapshotTaskGradingMode(source.gradingMode);
      const taskServiceTask = await this.createTaskContent({
        id: randomUUID(),
        title: String(source.title ?? 'Unbenannte Aufgabe'),
        description: String(source.description ?? ''),
        type: String(source.type ?? 'TASK'),
        content: this.cloneJsonValue(
          source.content ?? source.completionCriteria ?? {},
        ) as Record<string, unknown>,
        defaultMaxScore: maxPoints,
        defaultPassThreshold: passThreshold,
        mockEvaluationMode: gradingMode,
      });
      const task = new Task();
      task.externalTaskId = taskServiceTask.id;
      task.courseId = targetRun.courseId;
      task.courseRunId = targetRun.id;
      task.courseRun = targetRun;
      task.courseVersionId = targetVersion.id;
      task.courseVersion = targetVersion;
      task.order = Number.isInteger(Number(source.order)) ? Number(source.order) : 0;
      task.unlockMode = this.normalizeSnapshotTaskUnlockMode(source.unlockMode);
      task.prerequisiteTaskId = undefined;
      task.isPublished = source.isPublished === true;
      task.gradingMode = gradingMode;
      task.workMode = this.normalizeSnapshotTaskWorkMode(source.workMode);
      task.maxPoints = maxPoints;
      task.passThreshold = passThreshold;
      task.feedbackRequired = source.feedbackRequired === true;
      task.allowRetries = source.allowRetries === true;
      task.createdBy = actorId;
      task.updatedBy = actorId;
      this.applyTaskServiceContent(task, taskServiceTask);
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
    await this.recordAuditEvent({
      eventType: AuditEventType.CONTENT_VERSION_CREATED,
      actorUserId: actorId,
      courseId: course.id,
      courseRunId: run.id,
      courseVersionId: savedVersion.id,
      entityType: 'course_version',
      entityId: savedVersion.id,
      summary: `Inhaltsversion erstellt: ${savedVersion.label}`,
      metadataJson: {
        versionNumber: savedVersion.version_number,
        active: savedVersion.is_active,
        copyMode,
        sourceVersionId: sourceVersion?.id ?? null,
      },
    });

    if (savedVersion.is_active) {
      await this.recordAuditEvent({
        eventType: AuditEventType.CONTENT_VERSION_ACTIVATED,
        actorUserId: actorId,
        courseId: course.id,
        courseRunId: run.id,
        courseVersionId: savedVersion.id,
        entityType: 'course_version',
        entityId: savedVersion.id,
        summary: `Inhaltsversion aktiviert: ${savedVersion.label}`,
        metadataJson: {
          versionNumber: savedVersion.version_number,
        },
      });
    }

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

    const savedVersion = await this.setActiveCourseVersion(
      this.toCourseId(courseId),
      versionId,
    );
    await this.recordAuditEvent({
      eventType: AuditEventType.CONTENT_VERSION_ACTIVATED,
      actorUserId: actorId,
      courseId,
      courseRunId: savedVersion.course_run_id,
      courseVersionId: savedVersion.id,
      entityType: 'course_version',
      entityId: savedVersion.id,
      summary: `Inhaltsversion aktiviert: ${savedVersion.label}`,
      metadataJson: {
        versionNumber: savedVersion.version_number,
      },
    });

    return this.mapCourseVersionWithTemplateInfo(savedVersion);
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
    await this.recordAuditEvent({
      eventType: AuditEventType.CONTENT_VERSION_DELETED,
      actorUserId: actorId,
      courseId,
      courseRunId: run.id,
      courseVersionId: version.id,
      entityType: 'course_version',
      entityId: version.id,
      summary: `Inhaltsversion gelöscht: ${version.label}`,
      metadataJson: {
        versionNumber: version.version_number,
      },
    });
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
    await this.recordAuditEvent({
      eventType: AuditEventType.COURSE_RUN_CREATED,
      actorUserId: actorId,
      courseId: course.id,
      courseRunId: savedRun.id,
      entityType: 'course_run',
      entityId: savedRun.id,
      summary: `Kursdurchlauf erstellt: ${savedRun.label}`,
      metadataJson: {
        status: savedRun.status,
        active: activate,
        sourceRunId,
        sourceVersionId: sourceVersion?.id ?? null,
      },
    });
    await this.recordAuditEvent({
      eventType: AuditEventType.CONTENT_VERSION_CREATED,
      actorUserId: actorId,
      courseId: course.id,
      courseRunId: savedRun.id,
      courseVersionId: targetVersion.id,
      entityType: 'course_version',
      entityId: targetVersion.id,
      summary: `Initiale Inhaltsversion erstellt: ${targetVersion.label}`,
      metadataJson: {
        versionNumber: targetVersion.version_number,
        active: targetVersion.is_active,
        sourceVersionId: sourceVersion?.id ?? null,
      },
    });

    if (activate) {
      await this.recordAuditEvent({
        eventType: AuditEventType.COURSE_RUN_ACTIVATED,
        actorUserId: actorId,
        courseId: course.id,
        courseRunId: savedRun.id,
        entityType: 'course_run',
        entityId: savedRun.id,
        summary: `Kursdurchlauf aktiviert: ${savedRun.label}`,
      });
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

    const savedRun = await this.setActiveCourseRun(this.toCourseId(courseId), runId);
    await this.recordAuditEvent({
      eventType: AuditEventType.COURSE_RUN_ACTIVATED,
      actorUserId: actorId,
      courseId,
      courseRunId: savedRun.id,
      entityType: 'course_run',
      entityId: savedRun.id,
      summary: `Kursdurchlauf aktiviert: ${savedRun.label}`,
    });

    return this.mapCourseRunWithCounts(savedRun);
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
}
