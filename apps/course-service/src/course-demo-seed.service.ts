import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Course, CourseStatus } from './entities/course.entity';
import {
  CourseRecurrenceType,
  CourseRun,
  CourseRunStatus,
} from './entities/course-run.entity';
import { CourseVersion, CourseVersionStatus } from './entities/course-version.entity';
import { CourseMemberRole, Enrollment } from './entities/enrollment.entity';
import {
  LearningMaterial,
  LearningMaterialPublicationStatus,
  LearningMaterialReleaseMode,
  LearningMaterialType,
} from './entities/learning-material.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership, MembershipRole } from './entities/group-membership.entity';
import { Task, TaskGradingMode, TaskUnlockMode, TaskWorkMode } from './entities/task.entity';
import { TaskServiceClient, TaskServiceTask, TaskServiceTaskPayload } from './task-service.client';

const DEMO_COURSE_EXTERNAL_ID = 'demo-learning-process';
const DEMO_ENROLLABLE_COURSE_EXTERNAL_ID = 'demo-enrollable-course';
const DEMO_TEACHER_ID = '1';
const DEMO_STUDENT_ID = '3';
const DEMO_GROUP_STUDENT_ID = '4';
const DEMO_UNGROUPED_STUDENT_ID = '5';
const DEMO_SEED_USER = 'demo-seed';
const DEMO_ACTIVE_SEMESTER_RUN_LABEL = 'Wintersemester 2026/27';
const DEMO_PREVIOUS_SEMESTER_RUN_LABEL = 'Sommersemester 2026';

type DemoTaskSeed = {
  demoKey: string;
  title: string;
  description: string;
  order: number;
  unlockMode: TaskUnlockMode;
  gradingMode: TaskGradingMode;
  workMode?: TaskWorkMode;
  maxPoints?: number;
  passThreshold?: number;
  prerequisiteDemoKey?: string;
};

type DemoRunSeed = {
  label: string;
  startDate?: string;
  endDate?: string;
  status: CourseRunStatus;
  active: boolean;
  sourceLabel?: string;
};

type DemoMaterialSeed = {
  title: string;
  description: string;
  url: string;
  tags: string[];
  sortOrder: number;
  releaseMode?: LearningMaterialReleaseMode;
  releaseAt?: Date;
  releaseAfterDemoKey?: string;
};

const demoTaskSeeds: DemoTaskSeed[] = [
  {
    demoKey: 'learning-process-basics',
    title: 'Grundlagen kennenlernen',
    description: 'Ein kurzer einführender Lernschritt für den Demo-Ablauf.',
    order: 1,
    unlockMode: TaskUnlockMode.IMMEDIATE,
    gradingMode: TaskGradingMode.SELF_CONFIRMATION,
  },
  {
    demoKey: 'learning-process-apply-basics',
    title: 'Grundlagen anwenden',
    description: 'Eine manuell bewertete Demo-Aufgabe mit Abgabe und Lehrendenfeedback.',
    order: 2,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    gradingMode: TaskGradingMode.MANUAL,
    workMode: TaskWorkMode.GROUP,
    maxPoints: 10,
    passThreshold: 50,
    prerequisiteDemoKey: 'learning-process-basics',
  },
  {
    demoKey: 'learning-process-final-task',
    title: 'Automatische Demo-Bewertung auslösen',
    description: 'Eine automatisch bewertete Demo-Aufgabe, die im Mini-Projekt durch einen Mock bewertet wird.',
    order: 3,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    gradingMode: TaskGradingMode.AUTOMATIC_MOCK,
    maxPoints: 10,
    passThreshold: 50,
    prerequisiteDemoKey: 'learning-process-apply-basics',
  },
];

const parseBoolean = (value?: string): boolean =>
  value != null && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

@Injectable()
export class CourseDemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CourseDemoSeedService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseRun)
    private readonly courseRunRepository: Repository<CourseRun>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(LearningMaterial)
    private readonly learningMaterialRepository: Repository<LearningMaterial>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(CourseVersion)
    private readonly courseVersionRepository: Repository<CourseVersion>,
    @InjectRepository(CourseGroup)
    private readonly courseGroupRepository: Repository<CourseGroup>,
    @InjectRepository(GroupMembership)
    private readonly groupMembershipRepository: Repository<GroupMembership>,
    private readonly taskServiceClient?: TaskServiceClient,
  ) {}

  private localTaskContent(payload: TaskServiceTaskPayload & { id: string }): TaskServiceTask {
    return {
      id: payload.id,
      title: payload.title,
      description: payload.description ?? '',
      type: payload.type ?? 'DEMO_TASK',
      content: payload.content ?? {},
      defaultMaxScore: payload.defaultMaxScore ?? null,
      defaultPassThreshold: payload.defaultPassThreshold ?? null,
      mockEvaluationMode: payload.mockEvaluationMode ?? null,
    };
  }

  private async upsertTaskContent(
    payload: TaskServiceTaskPayload & { id: string },
  ): Promise<TaskServiceTask> {
    if (this.taskServiceClient) {
      return this.taskServiceClient.createTask(payload);
    }

    return this.localTaskContent(payload);
  }

  private async loadTaskContents(tasks: Task[]): Promise<Map<string, TaskServiceTask>> {
    if (this.taskServiceClient) {
      return this.taskServiceClient.getTasks(tasks.map((task) => task.externalTaskId));
    }

    return new Map(tasks.map((task) => {
      const id = task.externalTaskId ?? task.id;

      return [id, this.localTaskContent({
        id,
        title: task.title ?? 'Aufgabe',
        description: task.description ?? '',
        type: task.type ?? 'DEMO_TASK',
        content: task.content ?? task.completionCriteria ?? {},
        defaultMaxScore: task.maxPoints ?? null,
        defaultPassThreshold: task.passThreshold ?? null,
        mockEvaluationMode: task.gradingMode ?? null,
      })];
    }));
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.shouldSeedDemoData()) {
      this.logger.log(
        JSON.stringify({
          level: 'info',
          event: 'demo_seed_skipped',
          reason: 'disabled_or_non_demo_environment',
        }),
      );
      return;
    }

    this.logger.log(
      JSON.stringify({
        level: 'info',
        event: 'demo_seed_started',
      }),
    );

    try {
      await this.seedLearningProcessDemo();
      this.logger.log(
        JSON.stringify({
          level: 'info',
          event: 'demo_seed_completed',
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          event: 'demo_seed_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }),
      );
      throw error;
    }
  }

  private shouldSeedDemoData(): boolean {
    if (parseBoolean(this.configService.get<string>('COURSE_DEMO_SEED_DISABLED'))) {
      return false;
    }

    const appEnv = (
      this.configService.get<string>('APP_ENV') ??
      process.env.NODE_ENV ??
      'development'
    ).toLowerCase();

    return ['development', 'demo', 'test'].includes(appEnv);
  }

  private async seedLearningProcessDemo(): Promise<void> {
    const course = await this.upsertDemoCourse();
    const enrollableCourse = await this.upsertDemoEnrollableCourse();
    const learningRuns = await this.upsertDemoRuns(course, [
      {
        label: DEMO_PREVIOUS_SEMESTER_RUN_LABEL,
        startDate: '2026-04-01',
        endDate: '2026-09-30',
        status: CourseRunStatus.ARCHIVED,
        active: false,
      },
      {
        label: DEMO_ACTIVE_SEMESTER_RUN_LABEL,
        startDate: '2026-10-01',
        endDate: '2027-03-31',
        status: CourseRunStatus.PUBLISHED,
        active: true,
        sourceLabel: DEMO_PREVIOUS_SEMESTER_RUN_LABEL,
      },
    ]);
    const enrollableRuns = await this.upsertDemoRuns(enrollableCourse, [
      {
        label: 'Fortlaufend',
        status: CourseRunStatus.PUBLISHED,
        active: true,
      },
    ]);
    const activeLearningRun =
      learningRuns.get(DEMO_ACTIVE_SEMESTER_RUN_LABEL) ??
      Array.from(learningRuns.values())[0];
    const previousLearningRun = learningRuns.get(DEMO_PREVIOUS_SEMESTER_RUN_LABEL);
    const activeEnrollableRun =
      enrollableRuns.get('Fortlaufend') ??
      Array.from(enrollableRuns.values())[0];

    if (!activeLearningRun || !activeEnrollableRun) {
      return;
    }

    await this.upsertDemoEnrollment(
      course,
      activeLearningRun,
      DEMO_TEACHER_ID,
      CourseMemberRole.TEACHER,
    );
    await this.upsertDemoEnrollment(
      course,
      activeLearningRun,
      DEMO_STUDENT_ID,
      CourseMemberRole.STUDENT,
    );
    await this.upsertDemoEnrollment(
      course,
      activeLearningRun,
      DEMO_GROUP_STUDENT_ID,
      CourseMemberRole.STUDENT,
    );
    await this.upsertDemoEnrollment(
      course,
      activeLearningRun,
      DEMO_UNGROUPED_STUDENT_ID,
      CourseMemberRole.STUDENT,
    );
    await this.upsertDemoEnrollment(
      enrollableCourse,
      activeEnrollableRun,
      DEMO_TEACHER_ID,
      CourseMemberRole.TEACHER,
    );
    if (previousLearningRun) {
      await this.upsertDemoTasks(course, previousLearningRun, [demoTaskSeeds[0]]);
      await this.upsertDemoMaterials(course, previousLearningRun, [
        {
          title: 'Material A',
          description: 'Historisches Demo-Material aus dem Sommersemester 2026.',
          url: 'https://example.com/demo/material-a',
          tags: ['demo', 'sommersemester'],
          sortOrder: 1,
        },
        {
          title: 'Material B',
          description: 'Weiteres historisches Demo-Material aus dem Sommersemester 2026.',
          url: 'https://example.com/demo/material-b',
          tags: ['demo', 'sommersemester'],
          sortOrder: 2,
        },
      ]);
    }
    await this.upsertDemoTasks(course, activeLearningRun);
    await this.upsertDemoGroups(course, activeLearningRun);
    await this.upsertDemoMaterials(course, activeLearningRun, [
      {
        title: 'Material C',
        description: 'Aktives Demo-Material aus dem Wintersemester 2026/27.',
        url: 'https://example.com/demo/material-c',
        tags: ['demo', 'wintersemester'],
        sortOrder: 1,
      },
      {
        title: 'Material D',
        description: 'Wird nach erfolgreichem Abschluss der Grundlagen sichtbar.',
        url: 'https://example.com/demo/material-d',
        tags: ['demo', 'freischaltung'],
        sortOrder: 2,
        releaseMode: LearningMaterialReleaseMode.AFTER_TASK_COMPLETION,
        releaseAfterDemoKey: 'learning-process-basics',
      },
      {
        title: 'Material E',
        description: 'Geplantes Demo-Material mit fester Freischaltung.',
        url: 'https://example.com/demo/material-e',
        tags: ['demo', 'geplant'],
        sortOrder: 3,
        releaseMode: LearningMaterialReleaseMode.SCHEDULED,
        releaseAt: new Date('2026-10-01T08:00:00.000Z'),
      },
    ]);
    await this.upsertDemoVersions(course, activeLearningRun, [
      {
        versionNumber: 1,
        changeSummary: 'Initiale Demo-Version',
        active: false,
        content: {
          course: {
            title: 'Demo-Kurs Lernprozess',
            description: 'Erste Version des Demo-Lernprozesses.',
          },
        },
      },
      {
        versionNumber: 2,
        changeSummary: 'Lernprozess mit Freischaltlogik ergänzt',
        active: true,
        content: {
          course: {
            title: 'Demo-Kurs Lernprozess',
            description: 'Aktive Version mit Aufgabenfreischaltung.',
          },
        },
      },
    ]);
    await this.upsertDemoVersions(enrollableCourse, activeEnrollableRun, [
      {
        versionNumber: 1,
        changeSummary: 'Veröffentlichter Einschreibedemo-Kurs',
        active: true,
        content: {
          course: {
            title: 'Demo-Kurs Einschreibung',
            description: 'Veröffentlichter Kurs für die Einschreibe-Demo.',
          },
        },
      },
    ]);
  }

  private async upsertDemoCourse(): Promise<Course> {
    const existingCourse = await this.courseRepository.findOne({
      where: { external_id: DEMO_COURSE_EXTERNAL_ID },
    });

    if (existingCourse) {
      await this.ensureCourseRecurrence(
        existingCourse,
        CourseRecurrenceType.SEMESTER,
      );
      return existingCourse;
    }

    const course = new Course();
    course.external_id = DEMO_COURSE_EXTERNAL_ID;
    course.created_by = DEMO_SEED_USER;
    course.title = 'Demo-Kurs Lernprozess';
    course.description = 'Deterministischer Demo-Kurs für Aufgaben, Fortschritt und Freischaltlogik.';
    course.semester = 'Demo';
    course.status = CourseStatus.PUBLISHED;
    course.location = 'Demo';
    course.owner_id = Number(DEMO_TEACHER_ID);
    course.recurrenceType = CourseRecurrenceType.SEMESTER;
    course.updated_by = DEMO_SEED_USER;

    return this.courseRepository.save(course);
  }

  private async upsertDemoEnrollableCourse(): Promise<Course> {
    const existingCourse = await this.courseRepository.findOne({
      where: { external_id: DEMO_ENROLLABLE_COURSE_EXTERNAL_ID },
    });

    if (existingCourse) {
      await this.ensureCourseRecurrence(
        existingCourse,
        CourseRecurrenceType.CONTINUOUS,
      );
      return existingCourse;
    }

    const course = new Course();
    course.external_id = DEMO_ENROLLABLE_COURSE_EXTERNAL_ID;
    course.created_by = DEMO_SEED_USER;
    course.title = 'Demo-Kurs Einschreibung';
    course.description = 'Veröffentlichter Demo-Kurs, in den sich Studierende einschreiben können.';
    course.semester = 'Demo';
    course.status = CourseStatus.PUBLISHED;
    course.location = 'Friedberg';
    course.owner_id = Number(DEMO_TEACHER_ID);
    course.recurrenceType = CourseRecurrenceType.CONTINUOUS;
    course.updated_by = DEMO_SEED_USER;

    return this.courseRepository.save(course);
  }

  private async ensureCourseRecurrence(
    course: Course,
    recurrenceType: CourseRecurrenceType,
  ): Promise<void> {
    if (course.recurrenceType === recurrenceType) {
      return;
    }

    course.recurrenceType = recurrenceType;
    await this.courseRepository.save(course);
  }

  private async upsertDemoRuns(
    course: Course,
    seeds: DemoRunSeed[],
  ): Promise<Map<string, CourseRun>> {
    let runs = await this.courseRunRepository.find({
      where: {
        courseId: course.id,
      },
    });
    const runByLabel = new Map(runs.map((run) => [run.label, run]));

    for (const seed of seeds) {
      let run = runByLabel.get(seed.label);

      if (!run) {
        run = new CourseRun();
        run.courseId = course.id;
        run.course = course;
        run.label = seed.label;
        run.startDate = seed.startDate;
        run.endDate = seed.endDate;
        run.status = seed.status;
        run.isActive = false;
        run.createdBy = DEMO_SEED_USER;

        run = await this.courseRunRepository.save(run);
        runByLabel.set(seed.label, run);
        runs.push(run);
      }

      if (seed.sourceLabel && !run.sourceRunId) {
        const sourceRun = runByLabel.get(seed.sourceLabel);

        if (sourceRun) {
          run.sourceRunId = sourceRun.id;
          run.sourceRun = sourceRun;
          await this.courseRunRepository.save(run);
        }
      }
    }

    const activeSeed = seeds.find((seed) => seed.active);
    const activeRun = activeSeed ? runByLabel.get(activeSeed.label) : undefined;

    if (activeRun) {
      const runsToDeactivate = runs.filter(
        (run) => run.id !== activeRun.id && run.isActive,
      );

      if (runsToDeactivate.length > 0) {
        runsToDeactivate.forEach((run) => {
          run.isActive = false;
        });
        await this.courseRunRepository.save(runsToDeactivate);
      }

      if (!activeRun.isActive) {
        activeRun.isActive = true;
        await this.courseRunRepository.save(activeRun);
      }
    }

    return runByLabel;
  }

  private async upsertDemoEnrollment(
    course: Course,
    courseRun: CourseRun,
    userId: string,
    role: CourseMemberRole,
  ): Promise<Enrollment> {
    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: {
        courseId: course.id,
        courseRunId: courseRun.id,
        userId,
      },
    });

    if (existingEnrollment) {
      return existingEnrollment;
    }

    const legacyEnrollment = await this.enrollmentRepository.findOne({
      where: {
        courseId: course.id,
        userId,
      },
    });

    if (legacyEnrollment && !legacyEnrollment.courseRunId) {
      legacyEnrollment.courseRunId = courseRun.id;
      legacyEnrollment.courseRun = courseRun;
      return this.enrollmentRepository.save(legacyEnrollment);
    }

    const enrollment = new Enrollment();
    enrollment.courseId = course.id;
    enrollment.course = course;
    enrollment.courseRunId = courseRun.id;
    enrollment.courseRun = courseRun;
    enrollment.userId = userId;
    enrollment.createdBy = DEMO_SEED_USER;
    enrollment.role = role;
    enrollment.updatedBy = DEMO_SEED_USER;

    return this.enrollmentRepository.save(enrollment);
  }

  private async upsertDemoVersions(
    course: Course,
    courseRun: CourseRun,
    versions: Array<{
      versionNumber: number;
      changeSummary: string;
      active: boolean;
      content: Record<string, unknown>;
    }>,
  ): Promise<void> {
    const existingVersions = await this.courseVersionRepository.find({
      where: {
        course_id: course.id,
      },
    });
    for (const version of existingVersions) {
      if (!version.course_run_id) {
        version.course_run_id = courseRun.id;
        version.courseRun = courseRun;
        await this.courseVersionRepository.save(version);
      }
    }
    const versionsForRun = existingVersions.filter(
      (version) => version.course_run_id === courseRun.id,
    );
    const existingVersionsByNumber = new Map(
      versionsForRun.map((version) => [version.version_number, version]),
    );
    let hasActiveVersion = versionsForRun.some((version) => version.is_active);

    for (const seed of versions) {
      const existingVersion = existingVersionsByNumber.get(seed.versionNumber);

      if (existingVersion) {
        if (existingVersion.created_by === DEMO_SEED_USER) {
          existingVersion.content = await this.buildDemoVersionContent(
            course,
            courseRun,
            seed.content,
          );
          await this.courseVersionRepository.save(existingVersion);
        }
        continue;
      }

      const version = new CourseVersion();
      version.course_id = course.id;
      version.course = course;
      version.course_run_id = courseRun.id;
      version.courseRun = courseRun;
      version.version_number = seed.versionNumber;
      version.label = `Version ${seed.versionNumber}`;
      version.change_summary = seed.changeSummary;
      version.status = CourseVersionStatus.PUBLISHED;
      version.content = await this.buildDemoVersionContent(
        course,
        courseRun,
        seed.content,
      );
      version.created_by = DEMO_SEED_USER;
      version.is_active = seed.active && !hasActiveVersion;

      await this.courseVersionRepository.save(version);
      hasActiveVersion = hasActiveVersion || version.is_active;
      existingVersionsByNumber.set(seed.versionNumber, version);
    }
  }

  private async buildDemoVersionContent(
    course: Course,
    courseRun: CourseRun,
    content: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const [materials, taskReferences] = await Promise.all([
      this.learningMaterialRepository.find({
        where: {
          courseId: course.id,
          courseRunId: courseRun.id,
        },
      }),
      this.taskRepository.find({
        where: {
          courseId: course.id,
          courseRunId: courseRun.id,
        },
      }),
    ]);
    const taskContents = await this.loadTaskContents(taskReferences);
    const tasks = taskReferences.map((task) => ({
      reference: task,
      content: taskContents.get(task.externalTaskId),
    }));
    const courseOverride =
      content.course && typeof content.course === 'object'
        ? (content.course as Record<string, unknown>)
        : {};

    return {
      ...content,
      course: {
        id: course.id,
        externalId: course.external_id,
        title: course.title,
        description: course.description,
        semester: course.semester,
        status: course.status,
        location: course.location,
        ownerId: course.owner_id,
        ...courseOverride,
      },
      courseRun: {
        id: courseRun.id,
        label: courseRun.label,
        startDate: courseRun.startDate,
        endDate: courseRun.endDate,
        status: courseRun.status,
        isActive: courseRun.isActive,
      },
      learningMaterials: materials
        .filter(
          (material) =>
            material.publicationStatus !== LearningMaterialPublicationStatus.ARCHIVED,
        )
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((material) => ({
          id: material.id,
          title: material.title,
          description: material.description,
          type: material.type,
          url: material.url,
          originalFileName: material.originalFileName,
          mimeType: material.mimeType,
          fileSize: material.fileSize,
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
        })),
      tasks: tasks
        .sort((left, right) => left.reference.order - right.reference.order)
        .map(({ reference, content }) => ({
          id: reference.id,
          externalTaskId: reference.externalTaskId,
          title: content?.title ?? 'Aufgabe',
          description: content?.description ?? '',
          type: content?.type ?? 'DEMO_TASK',
          content: content?.content ?? {},
          order: reference.order,
          unlockMode: reference.unlockMode,
          prerequisiteTaskId: reference.prerequisiteTaskId,
          demoKey: reference.demoKey,
          gradingMode: reference.gradingMode ?? TaskGradingMode.NOT_GRADED,
          workMode: reference.workMode ?? TaskWorkMode.INDIVIDUAL,
          maxPoints: reference.maxPoints ?? content?.defaultMaxScore ?? null,
          passThreshold: reference.passThreshold ?? content?.defaultPassThreshold ?? null,
          feedbackRequired: reference.feedbackRequired === true,
          allowRetries: reference.allowRetries === true,
          isPublished: reference.isPublished,
        })),
    };
  }

  private async upsertDemoTasks(
    course: Course,
    courseRun: CourseRun,
    seeds: DemoTaskSeed[] = demoTaskSeeds,
  ): Promise<void> {
    const tasksByDemoKey = new Map<string, Task>();

    for (const seed of seeds) {
      const taskServiceTask = await this.upsertTaskContent({
        id: seed.demoKey,
        title: seed.title,
        description: seed.description,
        type: 'DEMO_TASK',
        content: {
          demo: true,
          assessmentInterface: seed.gradingMode,
        },
        defaultMaxScore: seed.maxPoints ?? null,
        defaultPassThreshold: seed.passThreshold ?? null,
        mockEvaluationMode: seed.gradingMode,
      });
      let task = await this.taskRepository.findOne({
        where: {
          courseId: course.id,
          courseRunId: courseRun.id,
          externalTaskId: seed.demoKey,
        },
      });
      if (!task) {
        const existingRunTasks = await this.taskRepository.find({
          where: {
            courseId: course.id,
            courseRunId: courseRun.id,
          },
        });
        task = existingRunTasks.find((candidate) =>
          candidate.externalTaskId === seed.demoKey || candidate.demoKey === seed.demoKey,
        ) ?? null;
      }

      if (!task) {
        const legacyTasks = await this.taskRepository.find({
          where: {
            courseId: course.id,
          },
        });
        const legacyTask = legacyTasks.find((candidate) =>
          !candidate.courseRunId &&
          (candidate.externalTaskId === seed.demoKey || candidate.demoKey === seed.demoKey),
        ) ?? null;

        if (legacyTask && !legacyTask.courseRunId) {
          legacyTask.courseRunId = courseRun.id;
          legacyTask.courseRun = courseRun;
          task = await this.taskRepository.save(legacyTask);
        }
      }

      if (!task) {
        task = new Task();
        task.courseId = course.id;
        task.course = course;
        task.courseRunId = courseRun.id;
        task.courseRun = courseRun;
        task.externalTaskId = taskServiceTask.id;
        task.createdBy = DEMO_SEED_USER;
      }

      task.externalTaskId = taskServiceTask.id;
      task.title = taskServiceTask.title;
      task.description = taskServiceTask.description;
      task.type = taskServiceTask.type;
      task.content = taskServiceTask.content;
      task.completionCriteria = taskServiceTask.content;
      task.demoKey = seed.demoKey;
      task.order = seed.order;
      task.unlockMode = seed.unlockMode;
      task.prerequisiteTaskId = seed.prerequisiteDemoKey
        ? tasksByDemoKey.get(seed.prerequisiteDemoKey)?.id
        : undefined;
      task.gradingMode = seed.gradingMode;
      task.workMode = seed.workMode ?? TaskWorkMode.INDIVIDUAL;
      task.maxPoints = seed.maxPoints ?? null;
      task.passThreshold = seed.passThreshold ?? null;
      task.feedbackRequired = seed.gradingMode === TaskGradingMode.MANUAL;
      task.allowRetries = false;
      task.isPublished = true;
      task.updatedBy = DEMO_SEED_USER;

      const savedTask = await this.taskRepository.save(task);
      tasksByDemoKey.set(seed.demoKey, savedTask);
    }
  }

  private async upsertDemoGroups(
    course: Course,
    courseRun: CourseRun,
  ): Promise<void> {
    let group = await this.courseGroupRepository.findOne({
      where: {
        course_id: course.id,
        course_run_id: courseRun.id,
        name: 'Gruppe A',
      },
      relations: ['memberships'],
    });

    if (!group) {
      group = new CourseGroup();
      group.course_id = course.id;
      group.course = course;
      group.course_run_id = courseRun.id;
      group.courseRun = courseRun;
      group.name = 'Gruppe A';
      group.description = 'Demo-Gruppe fuer die gemeinsame manuelle Bewertung.';
      group.group_type = 'WORKGROUP' as any;
      group.is_active = true;
      group.created_by = DEMO_SEED_USER;
      group.updated_by = DEMO_SEED_USER;
      group = await this.courseGroupRepository.save(group);
      group.memberships = [];
    }

    for (const studentId of [DEMO_STUDENT_ID, DEMO_GROUP_STUDENT_ID]) {
      const existingMembership = (group.memberships ?? []).find(
        (membership) => membership.user_id === studentId,
      ) ?? await this.groupMembershipRepository.findOne({
        where: {
          group_id: group.id,
          user_id: studentId,
        },
      });

      if (existingMembership) {
        continue;
      }

      const membership = new GroupMembership();
      membership.group_id = group.id;
      membership.group = group;
      membership.user_id = studentId;
      membership.role = MembershipRole.MEMBER;
      membership.joined_at = new Date();
      membership.added_by = DEMO_SEED_USER;
      await this.groupMembershipRepository.save(membership);
    }
  }

  private async upsertDemoMaterials(
    course: Course,
    courseRun: CourseRun,
    seeds: DemoMaterialSeed[],
  ): Promise<void> {
    const tasks = await this.taskRepository.find({
      where: {
        courseId: course.id,
        courseRunId: courseRun.id,
      },
    });
    const tasksByDemoKey = new Map(tasks.map((task) => [task.externalTaskId, task]));

    for (const seed of seeds) {
      const existingMaterial = await this.learningMaterialRepository.findOne({
        where: {
          courseId: course.id,
          courseRunId: courseRun.id,
          title: seed.title,
        },
      });

      if (existingMaterial) {
        continue;
      }

      const material = new LearningMaterial();
      material.courseId = course.id;
      material.course = course;
      material.courseRunId = courseRun.id;
      material.courseRun = courseRun;
      material.title = seed.title;
      material.description = seed.description;
      material.type = LearningMaterialType.EXTERNAL_LINK;
      material.url = seed.url;
      material.tags = seed.tags;
      material.sortOrder = seed.sortOrder;
      material.publicationStatus = LearningMaterialPublicationStatus.PUBLISHED;
      material.isPublished = true;
      material.publishedAt = new Date();
      material.releaseMode = seed.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE;
      material.releaseAt = seed.releaseAt;
      material.releaseAfterTaskId = seed.releaseAfterDemoKey
        ? tasksByDemoKey.get(seed.releaseAfterDemoKey)?.id
        : null;
      material.createdBy = DEMO_SEED_USER;
      material.updatedBy = DEMO_SEED_USER;

      await this.learningMaterialRepository.save(material);
    }
  }
}
