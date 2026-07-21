import { HttpStatus } from '@nestjs/common';

import { CoursesService } from './courses.service';
import { CourseRepositories } from './persistence/course-repositories';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseRun, CourseRunStatus } from './entities/course-run.entity';
import { CourseVersion, CourseVersionStatus } from './entities/course-version.entity';
import { CourseMemberRole, Enrollment } from './entities/enrollment.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership, MembershipRole } from './entities/group-membership.entity';
import { GroupTaskProgress } from './entities/group-task-progress.entity';
import {
  Task,
  TaskGradingMode,
  TaskLearningPathType,
  TaskUnlockMode,
  TaskWorkMode,
} from './entities/task.entity';
import {
  TaskAssessmentStatus,
  TaskAssessmentTargetType,
} from './entities/task-assessment.entity';
import {
  TaskDependency,
  TaskDependencyCondition,
  TaskDependencyOperator,
} from './entities/task-dependency.entity';
import {
  TaskProgress,
  TaskProgressStatus,
  TaskUnlockSource,
} from './entities/task-progress.entity';
import { AuditEventType } from './entities/audit-event.entity';

const createCourse = (overrides: Partial<Course> = {}): Course =>
  ({
    id: 'course-id',
    external_id: 'demo-learning-process',
    title: 'Demo-Kurs Lernprozess',
    description: 'Demo',
    semester: 'Demo',
    status: CourseStatus.PUBLISHED,
    owner_id: 1,
    created_at: new Date('2026-01-01T10:00:00.000Z'),
    updated_at: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as Course;

const createEnrollment = (
  userId: string,
  role: CourseMemberRole,
  overrides: Partial<Enrollment> = {},
): Enrollment =>
  ({
    id: `enrollment-${userId}`,
    courseId: 'course-id',
    courseRunId: 'course-run-id',
    userId,
    role,
    enrolledAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as Enrollment;

const createCourseRun = (course: Course, overrides: Partial<CourseRun> = {}): CourseRun =>
  ({
    id: `${course.id === 'course-id' ? 'course' : course.id}-run-id`,
    courseId: course.id,
    course,
    label: 'Sommersemester 2026',
    startDate: '2026-04-01',
    endDate: '2026-09-30',
    status: CourseRunStatus.PUBLISHED,
    isActive: true,
    createdBy: '1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as CourseRun;

const createTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 'task-id',
    courseId: 'course-id',
    courseRunId: 'course-run-id',
    title: 'Task',
    description: 'Task description',
    type: 'DEMO_TASK',
    order: 1,
    unlockMode: TaskUnlockMode.IMMEDIATE,
    prerequisiteTaskId: undefined,
    completionCriteria: {},
    gradingMode: TaskGradingMode.NOT_GRADED,
    maxPoints: null,
    passThreshold: null,
    learningPathType: TaskLearningPathType.STANDARD,
    feedbackRequired: false,
    allowRetries: false,
    isPublished: true,
    createdBy: '1',
    updatedBy: '1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as Task;

const createVersion = (
  course: Course,
  run: CourseRun,
  overrides: Partial<CourseVersion> = {},
): CourseVersion =>
  ({
    id: `${run.id}-version-1`,
    course_id: course.id,
    course,
    course_run_id: run.id,
    courseRun: run,
    version_number: 1,
    label: 'Version 1',
    content: {},
    change_summary: 'Initial',
    status: CourseVersionStatus.PUBLISHED,
    created_at: new Date('2026-01-01T10:00:00.000Z'),
    created_by: '1',
    is_active: true,
    ...overrides,
  }) as CourseVersion;

const isFindOperator = (
  value: unknown,
): value is { _type: string; _value?: unknown } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { _type?: string })._type === 'string';

const matchesWhere = (item: any, where: Record<string, any> = {}) =>
  Object.entries(where).every(([key, expected]) => {
    if (isFindOperator(expected)) {
      if (expected._type === 'in') {
        return Array.isArray(expected._value) && expected._value.includes(item[key]);
      }

      if (expected._type === 'not') {
        return item[key] !== expected._value;
      }

      if (expected._type === 'isNull') {
        return item[key] === null || item[key] === undefined;
      }
    }

    if (
      expected &&
      typeof expected === 'object' &&
      !Array.isArray(expected) &&
      !isFindOperator(expected)
    ) {
      return matchesWhere(item[key] ?? {}, expected);
    }

    return item[key] === expected;
  });

const createRepository = <T extends Record<string, any>>(
  items: T[],
  prefix: string,
) => {
  let nextId = items.length + 1;

  const sortItems = (result: T[], order?: Record<string, 'ASC' | 'DESC'>) => {
    if (!order) {
      return result;
    }

    const [field, direction] = Object.entries(order)[0] ?? [];

    if (!field) {
      return result;
    }

    return [...result].sort((a: any, b: any) => {
      const comparison = String(a[field] ?? '').localeCompare(String(b[field] ?? ''), undefined, {
        numeric: true,
      });

      return direction === 'DESC' ? -comparison : comparison;
    });
  };

  const saveOne = (entity: T): T => {
    if (!(entity as any).id) {
      (entity as any).id = `${prefix}-${nextId++}`;
    }

    const existingIndex = items.findIndex((item) => (item as any).id === (entity as any).id);

    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...items[existingIndex],
        ...entity,
      };
      return items[existingIndex];
    }

    items.push(entity);
    return entity;
  };

  return {
    items,
    delete: jest.fn((criteria: any) => {
      const id = typeof criteria === 'string' ? criteria : criteria?.id;
      const index = id
        ? items.findIndex((item) => item.id === id)
        : items.findIndex((item) => matchesWhere(item, criteria));

      if (index >= 0) {
        items.splice(index, 1);
      }

      return Promise.resolve({ affected: index >= 0 ? 1 : 0 });
    }),
    find: jest.fn(({ where, order } = {}) =>
      Promise.resolve(sortItems(items.filter((item) => matchesWhere(item, where)), order)),
    ),
    findOne: jest.fn(({ where } = {}) =>
      Promise.resolve(items.find((item) => matchesWhere(item, where)) ?? null),
    ),
    save: jest.fn((entityOrEntities: T | T[]) =>
      Promise.resolve(
        Array.isArray(entityOrEntities)
          ? entityOrEntities.map(saveOne)
          : saveOne(entityOrEntities),
      ),
    ),
  };
};

const createLearningProcessFixture = (
  auditLogService?: { recordEvent: jest.Mock; listEvents?: jest.Mock },
) => {
  const course = createCourse();
  const otherCourse = createCourse({
    id: 'other-course-id',
    external_id: 'other-course',
    owner_id: 8,
  });
  const currentRun = createCourseRun(course, { id: 'course-run-id' });
  const otherRun = createCourseRun(otherCourse, { id: 'other-course-run-id' });
  const currentVersion = createVersion(course, currentRun, { id: 'course-version-id' });
  const otherVersion = createVersion(otherCourse, otherRun, { id: 'other-version-id' });
  const enrollments = [
    createEnrollment('1', CourseMemberRole.TEACHER, {
      courseRun: currentRun,
    }),
    createEnrollment('3', CourseMemberRole.STUDENT, {
      courseRun: currentRun,
    }),
    createEnrollment('4', CourseMemberRole.STUDENT, {
      courseRun: currentRun,
    }),
    createEnrollment('8', CourseMemberRole.TEACHER, {
      courseId: 'other-course-id',
      courseRunId: otherRun.id,
      courseRun: otherRun,
      id: 'other-enrollment-8',
    }),
  ];
  const task1 = createTask({
    id: 'task-1',
    courseVersionId: currentVersion.id,
    courseVersion: currentVersion,
    title: 'Grundlagen kennenlernen',
    order: 1,
    unlockMode: TaskUnlockMode.IMMEDIATE,
  });
  const task2 = createTask({
    id: 'task-2',
    courseVersionId: currentVersion.id,
    courseVersion: currentVersion,
    title: 'Grundlagen anwenden',
    order: 2,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    gradingMode: TaskGradingMode.SELF_CONFIRMATION,
    prerequisiteTaskId: 'task-1',
  });
  const task3 = createTask({
    id: 'task-3',
    courseVersionId: currentVersion.id,
    courseVersion: currentVersion,
    title: 'Abschlussaufgabe bearbeiten',
    order: 3,
    unlockMode: TaskUnlockMode.MANUAL,
    gradingMode: TaskGradingMode.MANUAL,
    maxPoints: 10,
    passThreshold: 50,
    prerequisiteTaskId: 'task-2',
  });
  const otherTask = createTask({
    id: 'other-task',
    courseId: 'other-course-id',
    courseRunId: otherRun.id,
    courseRun: otherRun,
    courseVersionId: otherVersion.id,
    courseVersion: otherVersion,
    title: 'Fremde Aufgabe',
  });
  const courseRepository = createRepository<Course>([course, otherCourse], 'course');
  const courseRunRepository = createRepository<CourseRun>([currentRun, otherRun], 'run');
  const courseVersionRepository = createRepository<CourseVersion>(
    [currentVersion, otherVersion],
    'version',
  );
  const enrollmentRepository = createRepository<Enrollment>(enrollments, 'enrollment');
  const taskRepository = createRepository<Task>([task1, task2, task3, otherTask], 'task');
  const taskAssessmentRepository = createRepository([], 'assessment');
  const taskDependencyRepository = createRepository<TaskDependency>([], 'dependency');
  const taskProgressRepository = createRepository<TaskProgress>([], 'progress');
  const courseGroupRepository = createRepository<CourseGroup>([], 'group');
  const groupMembershipRepository = createRepository<GroupMembership>([], 'group-membership');
  const groupTaskProgressRepository = createRepository<GroupTaskProgress>([], 'group-progress');
  const materialStorage = {
    deleteFile: jest.fn(),
    openFile: jest.fn(),
    saveFile: jest.fn(),
  };
  const taskEvaluationClient = {
    evaluateSubmission: jest.fn(async ({ task, submissionData }: any) => {
      const maxPoints = Number(task.maxPoints ?? 10);
      const normalizedMaxPoints = Number.isFinite(maxPoints) && maxPoints > 0
        ? maxPoints
        : 10;
      const shouldPass = submissionData?.passed === false ? false : true;

      return {
        feedback: shouldPass
          ? 'Demo-Bewertung erfolgreich.'
          : 'Demo-Bewertung nicht erfolgreich.',
        maxPoints: normalizedMaxPoints,
        passed: shouldPass,
        points: shouldPass
          ? Math.ceil(normalizedMaxPoints / 2)
          : Math.max(0, Math.floor(normalizedMaxPoints / 2) - 1),
      };
    }),
  };
  const service = new CoursesService(
    new CourseRepositories({
      assignments: createRepository([], 'assignment') as any,
      calendarEvents: createRepository([], 'calendar') as any,
      contentReleases: createRepository([], 'release') as any,
      contentTemplates: createRepository([], 'template') as any,
      courseGroups: courseGroupRepository as any,
      courseResults: createRepository([], 'result') as any,
      courseRuns: courseRunRepository as any,
      courses: courseRepository as any,
      courseVersions: courseVersionRepository as any,
      enrollments: enrollmentRepository as any,
      grades: createRepository([], 'grade') as any,
      groupMemberships: groupMembershipRepository as any,
      groupTaskProgress: groupTaskProgressRepository as any,
      learningMaterials: createRepository([], 'material') as any,
      taskDependencies: taskDependencyRepository as any,
      taskAssessments: taskAssessmentRepository as any,
      taskProgress: taskProgressRepository as any,
      tasks: taskRepository as any,
    }),
    materialStorage as any,
    auditLogService as any,
    undefined,
    taskEvaluationClient as any,
  );

  return {
    courseGroupRepository,
    courseVersionRepository,
    enrollmentRepository,
    groupMembershipRepository,
    groupTaskProgressRepository,
    materialStorage,
    service,
    taskAssessmentRepository,
    taskDependencyRepository,
    taskEvaluationClient,
    taskProgressRepository,
    taskRepository,
  };
};

describe('CoursesService learning process', () => {
  it('shows the first demo task as available and the following tasks as locked', async () => {
    const { service } = createLearningProcessFixture();

    const path = await service.getLearningPathProgress('course-id', '3');

    expect(path.tasks).toEqual([
      expect.objectContaining({
        id: 'task-1',
        status: TaskProgressStatus.AVAILABLE,
      }),
      expect.objectContaining({
        id: 'task-2',
        lockedReason: expect.stringContaining('Grundlagen kennenlernen'),
        status: TaskProgressStatus.LOCKED,
      }),
      expect.objectContaining({
        id: 'task-3',
        lockedReason: 'Diese Aufgabe muss durch eine Lehrperson freigeschaltet werden.',
        status: TaskProgressStatus.LOCKED,
      }),
    ]);
  });

  it('rejects starting or completing a locked task', async () => {
    const { service } = createLearningProcessFixture();

    await expect(service.startLearningTask('task-2', '3')).rejects.toMatchObject({
      code: 'TASK_LOCKED',
      statusCode: HttpStatus.FORBIDDEN,
    });
    await expect(service.completeLearningTask('task-2', '3')).rejects.toMatchObject({
      code: 'TASK_LOCKED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('unlocks task 2 after task 1 is completed successfully', async () => {
    const { service, taskProgressRepository } = createLearningProcessFixture();

    await service.startLearningTask('task-1', '3');
    const path = await service.completeLearningTask('task-1', '3');

    expect(path.tasks.find((task) => task.id === 'task-2')).toMatchObject({
      status: TaskProgressStatus.AVAILABLE,
    });
    expect(
      taskProgressRepository.items.find((progress) => progress.taskId === 'task-2'),
    ).toMatchObject({
      enrollmentId: 'enrollment-3',
      status: TaskProgressStatus.AVAILABLE,
      unlockSource: TaskUnlockSource.AUTOMATIC,
    });

    const reloadedPath = await service.getLearningPathProgress('course-id', '3');

    expect(reloadedPath.tasks.find((task) => task.id === 'task-2')).toMatchObject({
      status: TaskProgressStatus.AVAILABLE,
      unlockSource: TaskUnlockSource.AUTOMATIC,
    });
  });

  it('supports flexible task dependencies that require multiple passed prerequisites', async () => {
    const {
      service,
      taskDependencyRepository,
      taskRepository,
    } = createLearningProcessFixture();
    const flexibleTask = createTask({
      id: 'task-flex',
      courseVersionId: 'course-version-id',
      title: 'Vertiefung freischalten',
      order: 4,
      unlockMode: TaskUnlockMode.AUTOMATIC,
      prerequisiteTaskId: 'task-1',
    });
    taskRepository.items.push(flexibleTask);
    taskDependencyRepository.items.push(
      {
        id: 'dependency-1',
        taskId: 'task-flex',
        task: flexibleTask,
        prerequisiteTaskId: 'task-1',
        condition: TaskDependencyCondition.PASSED,
        operator: TaskDependencyOperator.ALL_OF,
      } as TaskDependency,
      {
        id: 'dependency-2',
        taskId: 'task-flex',
        task: flexibleTask,
        prerequisiteTaskId: 'task-2',
        condition: TaskDependencyCondition.PASSED,
        operator: TaskDependencyOperator.ALL_OF,
      } as TaskDependency,
    );

    let path = await service.completeLearningTask('task-1', '3');

    expect(path.tasks.find((task) => task.id === 'task-flex')).toMatchObject({
      status: TaskProgressStatus.LOCKED,
      dependencies: expect.arrayContaining([
        expect.objectContaining({
          prerequisiteTaskId: 'task-1',
          condition: TaskDependencyCondition.PASSED,
        }),
        expect.objectContaining({
          prerequisiteTaskId: 'task-2',
          condition: TaskDependencyCondition.PASSED,
        }),
      ]),
    });
    expect(path.tasks.find((task) => task.id === 'task-flex')?.lockedReason)
      .toContain('Grundlagen anwenden');

    path = await service.completeLearningTask('task-2', '3');

    expect(path.tasks.find((task) => task.id === 'task-flex')).toMatchObject({
      status: TaskProgressStatus.AVAILABLE,
      unlockSource: TaskUnlockSource.AUTOMATIC,
    });
  });

  it('does not let students mark a task as failed directly', async () => {
    const { service } = createLearningProcessFixture();

    await service.startLearningTask('task-1', '3');
    await expect(service.failLearningTask('task-1', '3')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('submits manual tasks without marking them as passed', async () => {
    const {
      service,
      taskAssessmentRepository,
      taskEvaluationClient,
      taskProgressRepository,
    } = createLearningProcessFixture();

    await service.completeLearningTask('task-1', '3');
    await service.completeLearningTask('task-2', '3');
    await service.manuallyUnlockLearningTask('task-3', { studentId: '3' }, '1');
    await service.startLearningTask('task-3', '3');
    const path = await service.submitLearningTask('task-3', {
      submissionData: {
        link: 'https://example.com/abgabe',
        text: 'Meine Lösung',
      },
    }, '3');

    expect(path.tasks.find((task) => task.id === 'task-3')).toMatchObject({
      status: TaskProgressStatus.SUBMITTED,
      assessment: expect.objectContaining({
        submissionData: {
          link: 'https://example.com/abgabe',
          text: 'Meine Lösung',
        },
        status: TaskAssessmentStatus.PENDING_REVIEW,
        passed: null,
      }),
    });
    expect(taskProgressRepository.items.find((progress) => progress.taskId === 'task-3')).toMatchObject({
      status: TaskProgressStatus.SUBMITTED,
      resultPassed: undefined,
    });
    expect(taskAssessmentRepository.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskId: 'task-3',
        studentId: '3',
        submissionData: {
          link: 'https://example.com/abgabe',
          text: 'Meine Lösung',
        },
        status: TaskAssessmentStatus.PENDING_REVIEW,
      }),
    ]));
    expect(taskEvaluationClient.evaluateSubmission).not.toHaveBeenCalled();
  });

  it('stores uploaded task submission files without exposing storage keys', async () => {
    const {
      materialStorage,
      service,
      taskAssessmentRepository,
    } = createLearningProcessFixture();
    materialStorage.saveFile.mockResolvedValueOnce({
      safeFileName: 'loesung.pdf',
      storageKey: 'server-generated.pdf',
    });

    await service.completeLearningTask('task-1', '3');
    await service.completeLearningTask('task-2', '3');
    await service.manuallyUnlockLearningTask('task-3', { studentId: '3' }, '1');
    await service.startLearningTask('task-3', '3');
    const path = await service.submitLearningTaskWithUpload(
      'task-3',
      {
        text: 'Datei anbei',
      },
      {
        buffer: Buffer.from('demo'),
        mimetype: 'application/pdf',
        originalname: '../loesung.pdf',
        size: 4,
      },
      '3',
    );

    const responseAssessment = path.tasks.find((task) => task.id === 'task-3')?.assessment;

    expect(materialStorage.saveFile).toHaveBeenCalledWith(
      'course-id',
      '../loesung.pdf',
      Buffer.from('demo'),
    );
    expect(responseAssessment?.submissionData).toMatchObject({
      file: {
        fileSize: 4,
        mimeType: 'application/pdf',
        originalFileName: 'loesung.pdf',
      },
      text: 'Datei anbei',
    });
    expect((responseAssessment?.submissionData?.file as any).storageKey).toBeUndefined();
    expect(taskAssessmentRepository.items.find((assessment) => assessment.taskId === 'task-3')).toMatchObject({
      submissionData: expect.objectContaining({
        file: expect.objectContaining({
          storageKey: 'server-generated.pdf',
        }),
      }),
    });
  });

  it('lets teachers assess and reset manual submissions while keeping failed prerequisites locked', async () => {
    const { service, taskProgressRepository } = createLearningProcessFixture();

    await service.completeLearningTask('task-1', '3');
    await service.completeLearningTask('task-2', '3');
    await service.manuallyUnlockLearningTask('task-3', { studentId: '3' }, '1');
    await service.startLearningTask('task-3', '3');
    await service.submitLearningTask('task-3', {}, '3');
    const assessment = await service.setManualTaskAssessment(
      'course-id',
      'course-run-id',
      'task-3',
      '3',
      {
        feedback: 'Bitte wiederholen.',
        maxPoints: 10,
        points: 4,
      },
      '1',
    );

    expect(assessment).toMatchObject({
      passed: false,
      status: TaskAssessmentStatus.FAILED,
    });
    expect(taskProgressRepository.items.find((progress) => progress.taskId === 'task-3')).toMatchObject({
      resultPassed: false,
      status: TaskProgressStatus.FAILED,
    });

    const resetAssessment = await service.resetTaskAssessment(
      'course-id',
      'course-run-id',
      'task-3',
      '3',
      '1',
    );

    expect(resetAssessment).toMatchObject({
      passed: null,
      status: TaskAssessmentStatus.PENDING_REVIEW,
    });
    expect(taskProgressRepository.items.find((progress) => progress.taskId === 'task-3')).toMatchObject({
      resultPassed: undefined,
      status: TaskProgressStatus.SUBMITTED,
    });

    const passedAtThreshold = await service.setManualTaskAssessment(
      'course-id',
      'course-run-id',
      'task-3',
      '3',
      {
        maxPoints: 10,
        points: 5,
      },
      '1',
    );

    expect(passedAtThreshold).toMatchObject({
      passed: true,
      status: TaskAssessmentStatus.PASSED,
    });
    await expect(
      service.setManualTaskAssessment(
        'course-id',
        'course-run-id',
        'task-3',
        '3',
        {
          maxPoints: 10,
          points: 8,
        },
        '3',
      ),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('unlocks automatic follow-up tasks only after the prerequisite was passed', async () => {
    const { service } = createLearningProcessFixture();
    const followUpTask = await service.createLearningTask(
      'course-id',
      {
        gradingMode: TaskGradingMode.NOT_GRADED,
        isPublished: true,
        order: 4,
        prerequisiteTaskId: 'task-3',
        title: 'Folgeaufgabe nach Bewertung',
        unlockMode: TaskUnlockMode.AUTOMATIC,
      },
      '1',
    );

    await service.completeLearningTask('task-1', '3');
    await service.completeLearningTask('task-2', '3');
    await service.manuallyUnlockLearningTask('task-3', { studentId: '3' }, '1');
    await service.startLearningTask('task-3', '3');
    await service.submitLearningTask('task-3', {}, '3');
    let path = await service.setManualTaskAssessment(
      'course-id',
      'course-run-id',
      'task-3',
      '3',
      {
        maxPoints: 10,
        points: 4,
      },
      '1',
    ).then(() => service.getLearningPathProgress('course-id', '3'));

    expect(path.tasks.find((task) => task.id === followUpTask.id)).toMatchObject({
      locked: true,
      status: TaskProgressStatus.LOCKED,
    });

    path = await service.setManualTaskAssessment(
      'course-id',
      'course-run-id',
      'task-3',
      '3',
      {
        maxPoints: 10,
        points: 8,
      },
      '1',
    ).then(() => service.getLearningPathProgress('course-id', '3'));

    expect(path.tasks.find((task) => task.id === followUpTask.id)).toMatchObject({
      locked: false,
      status: TaskProgressStatus.AVAILABLE,
      unlockSource: TaskUnlockSource.AUTOMATIC,
    });
  });

  it('unlocks remedial follow-up tasks automatically after the prerequisite was failed', async () => {
    const {
      service,
      taskDependencyRepository,
    } = createLearningProcessFixture();
    const remedialTask = await service.createLearningTask(
      'course-id',
      {
        dependencies: [
          {
            prerequisiteTaskId: 'task-3',
            condition: TaskDependencyCondition.FAILED,
          },
        ],
        dependencyOperator: TaskDependencyOperator.ALL_OF,
        gradingMode: TaskGradingMode.SELF_CONFIRMATION,
        isPublished: true,
        learningPathType: TaskLearningPathType.REMEDIAL,
        order: 4,
        title: 'Grundlagen wiederholen',
        unlockMode: TaskUnlockMode.AUTOMATIC,
      },
      '1',
    );

    await service.completeLearningTask('task-1', '3');
    await service.completeLearningTask('task-2', '3');
    await service.manuallyUnlockLearningTask('task-3', { studentId: '3' }, '1');
    await service.startLearningTask('task-3', '3');
    await service.submitLearningTask('task-3', {}, '3');
    await service.setManualTaskAssessment(
      'course-id',
      'course-run-id',
      'task-3',
      '3',
      {
        feedback: 'Bitte Wiederholung bearbeiten.',
        maxPoints: 10,
        points: 4,
      },
      '1',
    );

    const path = await service.getLearningPathProgress('course-id', '3');

    expect(taskDependencyRepository.items.find((dependency) => dependency.taskId === remedialTask.id))
      .toMatchObject({
        condition: TaskDependencyCondition.FAILED,
        prerequisiteTaskId: 'task-3',
      });
    expect(path.tasks.find((task) => task.id === remedialTask.id)).toMatchObject({
      learningPathType: TaskLearningPathType.REMEDIAL,
      locked: false,
      status: TaskProgressStatus.AVAILABLE,
      unlockSource: TaskUnlockSource.AUTOMATIC,
    });
  });

  it('creates an automatic mock assessment and updates progress', async () => {
    const {
      service,
      taskAssessmentRepository,
      taskEvaluationClient,
    } = createLearningProcessFixture();
    const task = await service.createLearningTask(
      'course-id',
      {
        gradingMode: TaskGradingMode.AUTOMATIC_MOCK,
        isPublished: true,
        maxPoints: 10,
        order: 4,
        passThreshold: 50,
        title: 'Automatische Demo-Aufgabe',
        unlockMode: TaskUnlockMode.IMMEDIATE,
      },
      '1',
    );

    await service.startLearningTask(task.id, '3');
    const path = await service.mockEvaluateLearningTask(task.id, { passed: true }, '3');

    expect(path.tasks.find((entry) => entry.id === task.id)).toMatchObject({
      status: TaskProgressStatus.COMPLETED,
      assessment: expect.objectContaining({
        passed: true,
        points: 5,
        status: TaskAssessmentStatus.AUTO_EVALUATED,
      }),
    });
    expect(taskAssessmentRepository.items).toEqual([
      expect.objectContaining({
        assessedBy: 'task-service',
        passed: true,
        taskId: task.id,
      }),
    ]);
    expect(taskEvaluationClient.evaluateSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: '3',
        submissionData: {
          passed: true,
        },
        task: expect.objectContaining({
          id: task.id,
          gradingMode: TaskGradingMode.AUTOMATIC_MOCK,
        }),
      }),
    );
  });

  it('does not save an automatic assessment when the task service fails', async () => {
    const {
      service,
      taskAssessmentRepository,
      taskEvaluationClient,
    } = createLearningProcessFixture();
    const task = await service.createLearningTask(
      'course-id',
      {
        gradingMode: TaskGradingMode.AUTOMATIC_MOCK,
        isPublished: true,
        maxPoints: 10,
        order: 4,
        passThreshold: 50,
        title: 'Automatische Demo-Aufgabe',
        unlockMode: TaskUnlockMode.IMMEDIATE,
      },
      '1',
    );
    taskEvaluationClient.evaluateSubmission.mockRejectedValueOnce(
      new Error('Task Service nicht erreichbar'),
    );

    await service.startLearningTask(task.id, '3');
    const saveCallsBeforeEvaluation = taskAssessmentRepository.save.mock.calls.length;

    await expect(
      service.mockEvaluateLearningTask(task.id, { passed: true }, '3'),
    ).rejects.toThrow('Task Service nicht erreichbar');

    expect(taskAssessmentRepository.save).toHaveBeenCalledTimes(saveCallsBeforeEvaluation);
    expect(taskAssessmentRepository.items).toEqual([]);
  });

  it('does not unlock the manual final task automatically', async () => {
    const { service } = createLearningProcessFixture();

    await service.startLearningTask('task-1', '3');
    await service.completeLearningTask('task-1', '3');
    await service.startLearningTask('task-2', '3');
    const path = await service.completeLearningTask('task-2', '3');

    expect(path.tasks.find((task) => task.id === 'task-3')).toMatchObject({
      status: TaskProgressStatus.LOCKED,
    });
  });

  it('allows teachers but not students to unlock a manual task', async () => {
    const { service, taskProgressRepository } = createLearningProcessFixture();

    await expect(
      service.manuallyUnlockLearningTask('task-3', { studentId: '3' }, '3'),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });

    const overview = await service.manuallyUnlockLearningTask(
      'task-3',
      { studentId: '3' },
      '1',
    );

    expect(overview.tasks.find((task) => task.taskId === 'task-3')).toMatchObject({
      status: TaskProgressStatus.AVAILABLE,
    });
    expect(
      taskProgressRepository.items.find((progress) => progress.taskId === 'task-3'),
    ).toMatchObject({
      enrollmentId: 'enrollment-3',
      status: TaskProgressStatus.AVAILABLE,
      unlockSource: TaskUnlockSource.MANUAL,
    });

    const reloadedOverview = await service.getLearningTaskProgressForStudent(
      'course-id',
      '3',
      '1',
    );

    expect(reloadedOverview.tasks.find((task) => task.taskId === 'task-3')).toMatchObject({
      status: TaskProgressStatus.AVAILABLE,
      unlockSource: TaskUnlockSource.MANUAL,
    });
  });

  it('keeps repeated manual unlock idempotent without duplicate progress rows', async () => {
    const { service, taskProgressRepository } = createLearningProcessFixture();

    await service.manuallyUnlockLearningTask('task-3', { studentId: '3' }, '1');
    const firstProgress = taskProgressRepository.items.find(
      (progress) => progress.taskId === 'task-3',
    );
    const firstUnlockedAt = firstProgress?.unlockedAt;
    const saveCallsAfterFirstUnlock = taskProgressRepository.save.mock.calls.length;

    await service.manuallyUnlockLearningTask('task-3', { studentId: '3' }, '1');

    expect(
      taskProgressRepository.items.filter(
        (progress) =>
          progress.taskId === 'task-3' &&
          progress.enrollmentId === 'enrollment-3',
      ),
    ).toHaveLength(1);
    expect(firstProgress?.unlockedAt).toBe(firstUnlockedAt);
    expect(taskProgressRepository.save).toHaveBeenCalledTimes(saveCallsAfterFirstUnlock);
  });

  it('writes audit events for course creation', async () => {
    const auditLogService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };
    const { service } = createLearningProcessFixture(auditLogService);

    await service.createCourse({ title: 'Neuer Kurs', ownerId: 1 }, '1');

    expect(auditLogService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.COURSE_CREATED,
        actorUserId: '1',
        courseId: expect.any(String),
        entityType: 'course',
      }),
    );
  });

  it('writes an audit event when a student enrolls', async () => {
    const auditLogService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };
    const { service } = createLearningProcessFixture(auditLogService);

    await service.enrollInCourse('course-id', '5');

    expect(auditLogService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.STUDENT_ENROLLED,
        actorUserId: '5',
        actorRole: CourseMemberRole.STUDENT,
        courseId: 'course-id',
        courseRunId: 'course-run-id',
        metadataJson: {
          studentId: '5',
        },
      }),
    );
  });

  it('writes an audit event when a content version is created', async () => {
    const auditLogService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };
    const { service } = createLearningProcessFixture(auditLogService);

    await service.createCourseVersionForRun(
      'course-id',
      'course-run-id',
      { changeSummary: 'Neue Inhalte', copyMode: 'EMPTY' },
      '1',
    );

    expect(auditLogService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.CONTENT_VERSION_CREATED,
        actorUserId: '1',
        courseId: 'course-id',
        courseRunId: 'course-run-id',
        entityType: 'course_version',
      }),
    );
  });

  it('writes an audit event when a manual assessment is stored', async () => {
    const auditLogService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };
    const { service } = createLearningProcessFixture(auditLogService);

    await service.completeLearningTask('task-1', '3');
    await service.completeLearningTask('task-2', '3');
    await service.manuallyUnlockLearningTask('task-3', { studentId: '3' }, '1');
    await service.submitLearningTask('task-3', {}, '3');
    await service.setManualTaskAssessment(
      'course-id',
      'course-run-id',
      'task-3',
      '3',
      {
        maxPoints: 10,
        points: 8,
      },
      '1',
    );

    expect(auditLogService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.ASSESSMENT_MANUALLY_GRADED,
        actorUserId: '1',
        courseId: 'course-id',
        courseRunId: 'course-run-id',
        entityType: 'task_assessment',
        metadataJson: expect.objectContaining({
          passed: true,
          studentId: '3',
          taskId: 'task-3',
        }),
      }),
    );
  });

  it('does not write audit events for failed domain actions', async () => {
    const auditLogService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };
    const { service } = createLearningProcessFixture(auditLogService);

    await expect(service.startLearningTask('task-2', '3')).rejects.toMatchObject({
      code: 'TASK_LOCKED',
    });

    expect(auditLogService.recordEvent).not.toHaveBeenCalled();
  });

  it('protects audit events from students and lets teachers read their own course', async () => {
    const auditLogService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
      listEvents: jest.fn().mockResolvedValue([
        {
          id: 'audit-1',
          eventType: AuditEventType.COURSE_CREATED,
          actorUserId: '1',
          actorRole: CourseMemberRole.TEACHER,
          courseId: 'course-id',
          summary: 'Kurs erstellt',
          createdAt: new Date('2026-07-14T12:00:00.000Z'),
        },
      ]),
    };
    const { service } = createLearningProcessFixture(auditLogService);

    await expect(
      service.listAuditEvents('course-id', {}, '3'),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });

    await expect(
      service.listAuditEvents('course-id', { limit: 500 }, '1'),
    ).resolves.toEqual([
      expect.objectContaining({
        eventType: AuditEventType.COURSE_CREATED,
        createdAt: '2026-07-14T12:00:00.000Z',
      }),
    ]);
    expect(auditLogService.listEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: 'course-id',
        limit: 100,
      }),
    );
  });

  it('keeps repeated successful completion idempotent', async () => {
    const { service, taskProgressRepository } = createLearningProcessFixture();

    await service.startLearningTask('task-1', '3');
    await service.completeLearningTask('task-1', '3');
    const firstProgress = taskProgressRepository.items.find(
      (progress) => progress.taskId === 'task-1',
    );
    const firstCompletedAt = firstProgress?.completedAt;

    await service.completeLearningTask('task-1', '3');

    expect(
      taskProgressRepository.items.filter((progress) => progress.taskId === 'task-1'),
    ).toHaveLength(1);
    expect(
      taskProgressRepository.items.filter((progress) => progress.taskId === 'task-2'),
    ).toHaveLength(1);
    expect(firstProgress?.completedAt).toBe(firstCompletedAt);
  });

  it('keeps a successful completion after a fresh repository-backed reload', async () => {
    const { service, taskProgressRepository } = createLearningProcessFixture();

    await service.startLearningTask('task-1', '3');
    await service.completeLearningTask('task-1', '3');

    expect(
      taskProgressRepository.items.find(
        (progress) =>
          progress.taskId === 'task-1' &&
          progress.enrollmentId === 'enrollment-3',
      ),
    ).toMatchObject({
      status: TaskProgressStatus.COMPLETED,
      completionPercentage: 100,
    });

    const reloadedPath = await service.getLearningPathProgress('course-id', '3');

    expect(reloadedPath.tasks.find((task) => task.id === 'task-1')).toMatchObject({
      status: TaskProgressStatus.COMPLETED,
      completionPercentage: 100,
    });
  });

  it('keeps progress records for different students separate', async () => {
    const { service, taskProgressRepository } = createLearningProcessFixture();

    await service.startLearningTask('task-1', '3');
    await service.completeLearningTask('task-1', '3');

    const otherStudentPath = await service.getLearningPathProgress('course-id', '4');

    expect(otherStudentPath.tasks.find((task) => task.id === 'task-1')).toMatchObject({
      status: TaskProgressStatus.AVAILABLE,
    });
    expect(
      taskProgressRepository.items.filter((progress) => progress.taskId === 'task-1'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enrollmentId: 'enrollment-3',
          status: TaskProgressStatus.COMPLETED,
        }),
        expect.objectContaining({
          enrollmentId: 'enrollment-4',
          status: TaskProgressStatus.AVAILABLE,
        }),
      ]),
    );
  });

  it('rejects cyclic and self-referencing prerequisites', async () => {
    const { service } = createLearningProcessFixture();

    await expect(
      service.updateLearningTask(
        'task-1',
        {
          unlockMode: TaskUnlockMode.AUTOMATIC,
          prerequisiteTaskId: 'task-1',
        },
        '1',
      ),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
    });

    await expect(
      service.updateLearningTask(
        'task-1',
        {
          unlockMode: TaskUnlockMode.AUTOMATIC,
          prerequisiteTaskId: 'task-2',
        },
        '1',
      ),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });

  it('rejects prerequisites from another course', async () => {
    const { service } = createLearningProcessFixture();

    await expect(
      service.updateLearningTask(
        'task-1',
        {
          unlockMode: TaskUnlockMode.AUTOMATIC,
          prerequisiteTaskId: 'other-task',
        },
        '1',
      ),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });

  it('prevents students from changing another student progress', async () => {
    const { service } = createLearningProcessFixture();

    await expect(
      service.recordTaskResult('4', 'task-1', true, '3'),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('allows teachers to create run-scoped groups and rejects student group management', async () => {
    const { service } = createLearningProcessFixture();

    await expect(
      service.createStudyGroup(
        'course-id',
        'course-run-id',
        { name: 'Gruppe A' },
        '1',
      ),
    ).resolves.toMatchObject({
      courseRunId: 'course-run-id',
      name: 'Gruppe A',
      memberCount: 0,
    });

    await expect(
      service.createStudyGroup(
        'course-id',
        'course-run-id',
        { name: 'Gruppe B' },
        '3',
      ),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('requires group members to be enrolled in the same run and unique per run', async () => {
    const { service } = createLearningProcessFixture();
    const groupA = await service.createStudyGroup(
      'course-id',
      'course-run-id',
      { name: 'Gruppe A' },
      '1',
    );
    const groupB = await service.createStudyGroup(
      'course-id',
      'course-run-id',
      { name: 'Gruppe B' },
      '1',
    );

    await expect(
      service.addStudyGroupMember(
        'course-id',
        'course-run-id',
        groupA.id,
        { studentId: '99' },
        '1',
      ),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });

    await service.addStudyGroupMember(
      'course-id',
      'course-run-id',
      groupA.id,
      { studentId: '3' },
      '1',
    );

    await expect(
      service.addStudyGroupMember(
        'course-id',
        'course-run-id',
        groupB.id,
        { studentId: '3' },
        '1',
      ),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });

  it('starts and submits group tasks only for students with a group', async () => {
    const { groupTaskProgressRepository, service } = createLearningProcessFixture();
    const group = await service.createStudyGroup(
      'course-id',
      'course-run-id',
      { name: 'Gruppe A' },
      '1',
    );
    await service.addStudyGroupMember(
      'course-id',
      'course-run-id',
      group.id,
      { studentId: '3' },
      '1',
    );
    const groupTask = await service.createLearningTask(
      'course-id',
      {
        title: 'Gemeinsame Abgabe',
        description: 'Gruppenarbeit',
        order: 4,
        unlockMode: TaskUnlockMode.IMMEDIATE,
        gradingMode: TaskGradingMode.MANUAL,
        workMode: TaskWorkMode.GROUP,
        maxPoints: 10,
        passThreshold: 50,
        isPublished: true,
      },
      '1',
    );

    await expect(service.startGroupLearningTask(groupTask.id, '4')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });

    await service.startGroupLearningTask(groupTask.id, '3');
    await service.submitGroupLearningTask(groupTask.id, {}, '3');

    expect(groupTaskProgressRepository.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: groupTask.id,
          groupId: group.id,
          status: TaskProgressStatus.SUBMITTED,
        }),
      ]),
    );
  });

  it('stores group assessment in the existing assessment table and updates all group members', async () => {
    const {
      groupTaskProgressRepository,
      service,
      taskAssessmentRepository,
      taskProgressRepository,
    } = createLearningProcessFixture();
    const group = await service.createStudyGroup(
      'course-id',
      'course-run-id',
      { name: 'Gruppe A' },
      '1',
    );
    await service.addStudyGroupMember(
      'course-id',
      'course-run-id',
      group.id,
      { studentId: '3' },
      '1',
    );
    await service.addStudyGroupMember(
      'course-id',
      'course-run-id',
      group.id,
      { studentId: '4' },
      '1',
    );
    const groupTask = await service.createLearningTask(
      'course-id',
      {
        title: 'Gruppenaufgabe',
        description: 'Gemeinsam bearbeiten',
        order: 4,
        unlockMode: TaskUnlockMode.IMMEDIATE,
        gradingMode: TaskGradingMode.MANUAL,
        workMode: TaskWorkMode.GROUP,
        maxPoints: 10,
        passThreshold: 50,
        isPublished: true,
      },
      '1',
    );
    const dependentTask = await service.createLearningTask(
      'course-id',
      {
        title: 'Folgeinhalt',
        description: 'Wird nach Gruppenaufgabe freigeschaltet',
        order: 5,
        unlockMode: TaskUnlockMode.AUTOMATIC,
        prerequisiteTaskId: groupTask.id,
        gradingMode: TaskGradingMode.NOT_GRADED,
        isPublished: true,
      },
      '1',
    );

    await service.startGroupLearningTask(groupTask.id, '3');
    await service.submitGroupLearningTask(groupTask.id, {}, '3');
    const assessment = await service.setManualGroupTaskAssessment(
      'course-id',
      'course-run-id',
      groupTask.id,
      group.id,
      {
        points: 8,
        maxPoints: 10,
        feedback: 'Gute Teamarbeit',
      },
      '1',
    );

    expect(assessment).toMatchObject({
      assessmentTargetType: TaskAssessmentTargetType.GROUP,
      groupId: group.id,
      studentId: null,
      passed: true,
    });
    expect(taskAssessmentRepository.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assessmentTargetType: TaskAssessmentTargetType.GROUP,
          groupId: group.id,
          studentId: null,
        }),
      ]),
    );
    expect(groupTaskProgressRepository.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: groupTask.id,
          groupId: group.id,
          status: TaskProgressStatus.COMPLETED,
        }),
      ]),
    );
    expect(taskProgressRepository.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: groupTask.id,
          enrollmentId: 'enrollment-3',
          status: TaskProgressStatus.COMPLETED,
        }),
        expect.objectContaining({
          taskId: groupTask.id,
          enrollmentId: 'enrollment-4',
          status: TaskProgressStatus.COMPLETED,
        }),
        expect.objectContaining({
          taskId: dependentTask.id,
          enrollmentId: 'enrollment-3',
          status: TaskProgressStatus.AVAILABLE,
        }),
        expect.objectContaining({
          taskId: dependentTask.id,
          enrollmentId: 'enrollment-4',
          status: TaskProgressStatus.AVAILABLE,
        }),
      ]),
    );
  });

  it('rejects hard deletion of groups with progress', async () => {
    const { service } = createLearningProcessFixture();
    const group = await service.createStudyGroup(
      'course-id',
      'course-run-id',
      { name: 'Gruppe A' },
      '1',
    );
    await service.addStudyGroupMember(
      'course-id',
      'course-run-id',
      group.id,
      { studentId: '3' },
      '1',
    );
    const groupTask = await service.createLearningTask(
      'course-id',
      {
        title: 'Gruppenaufgabe',
        description: 'Gemeinsam bearbeiten',
        order: 4,
        unlockMode: TaskUnlockMode.IMMEDIATE,
        gradingMode: TaskGradingMode.MANUAL,
        workMode: TaskWorkMode.GROUP,
        maxPoints: 10,
        passThreshold: 50,
        isPublished: true,
      },
      '1',
    );
    await service.startGroupLearningTask(groupTask.id, '3');

    await expect(
      service.deleteStudyGroup('course-id', 'course-run-id', group.id, '1'),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });

  it('rejects non-enrolled users for learning progress', async () => {
    const { service } = createLearningProcessFixture();

    await expect(service.getLearningPathProgress('course-id', '99')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });
});
