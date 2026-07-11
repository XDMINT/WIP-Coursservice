import { HttpStatus } from '@nestjs/common';

import { CoursesService } from './courses.service';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseMemberRole, Enrollment } from './entities/enrollment.entity';
import { Task, TaskUnlockMode } from './entities/task.entity';
import {
  TaskProgress,
  TaskProgressStatus,
  TaskUnlockSource,
} from './entities/task-progress.entity';

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
    userId,
    role,
    enrolledAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as Enrollment;

const createTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 'task-id',
    courseId: 'course-id',
    title: 'Task',
    description: 'Task description',
    type: 'DEMO_TASK',
    order: 1,
    unlockMode: TaskUnlockMode.IMMEDIATE,
    prerequisiteTaskId: undefined,
    completionCriteria: {},
    isPublished: true,
    createdBy: '1',
    updatedBy: '1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as Task;

const isInOperator = (value: unknown): value is { _type: 'in'; _value: unknown[] } =>
  typeof value === 'object' &&
  value !== null &&
  (value as { _type?: string })._type === 'in';

const matchesWhere = (item: any, where: Record<string, any> = {}) =>
  Object.entries(where).every(([key, expected]) => {
    if (isInOperator(expected)) {
      return expected._value.includes(item[key]);
    }

    if (
      expected &&
      typeof expected === 'object' &&
      !Array.isArray(expected) &&
      !isInOperator(expected)
    ) {
      return matchesWhere(item[key] ?? {}, expected);
    }

    return item[key] === expected;
  });

const createRepository = <T extends { id?: string }>(
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
    if (!entity.id) {
      entity.id = `${prefix}-${nextId++}`;
    }

    const existingIndex = items.findIndex((item) => item.id === entity.id);

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
      const index = items.findIndex((item) => item.id === id);

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

const createLearningProcessFixture = () => {
  const course = createCourse();
  const otherCourse = createCourse({
    id: 'other-course-id',
    external_id: 'other-course',
    owner_id: 8,
  });
  const enrollments = [
    createEnrollment('1', CourseMemberRole.TEACHER),
    createEnrollment('3', CourseMemberRole.STUDENT),
    createEnrollment('4', CourseMemberRole.STUDENT),
    createEnrollment('8', CourseMemberRole.TEACHER, {
      courseId: 'other-course-id',
      id: 'other-enrollment-8',
    }),
  ];
  const task1 = createTask({
    id: 'task-1',
    title: 'Grundlagen kennenlernen',
    order: 1,
    unlockMode: TaskUnlockMode.IMMEDIATE,
  });
  const task2 = createTask({
    id: 'task-2',
    title: 'Grundlagen anwenden',
    order: 2,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    prerequisiteTaskId: 'task-1',
  });
  const task3 = createTask({
    id: 'task-3',
    title: 'Abschlussaufgabe bearbeiten',
    order: 3,
    unlockMode: TaskUnlockMode.MANUAL,
    prerequisiteTaskId: 'task-2',
  });
  const otherTask = createTask({
    id: 'other-task',
    courseId: 'other-course-id',
    title: 'Fremde Aufgabe',
  });
  const courseRepository = createRepository<Course>([course, otherCourse], 'course');
  const enrollmentRepository = createRepository<Enrollment>(enrollments, 'enrollment');
  const taskRepository = createRepository<Task>([task1, task2, task3, otherTask], 'task');
  const taskProgressRepository = createRepository<TaskProgress>([], 'progress');
  const service = new CoursesService(
    courseRepository as any,
    createRepository([], 'material') as any,
    createRepository([], 'assignment') as any,
    createRepository([], 'grade') as any,
    createRepository([], 'result') as any,
    enrollmentRepository as any,
    taskRepository as any,
    taskProgressRepository as any,
    createRepository([], 'release') as any,
    createRepository([], 'template') as any,
    createRepository([], 'group') as any,
    createRepository([], 'group-membership') as any,
    createRepository([], 'calendar') as any,
    {
      deleteFile: jest.fn(),
      openFile: jest.fn(),
      saveFile: jest.fn(),
    } as any,
  );

  return {
    service,
    taskProgressRepository,
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

  it('does not unlock task 2 after task 1 fails', async () => {
    const { service } = createLearningProcessFixture();

    await service.startLearningTask('task-1', '3');
    const path = await service.failLearningTask('task-1', '3');

    expect(path.tasks.find((task) => task.id === 'task-2')).toMatchObject({
      status: TaskProgressStatus.LOCKED,
    });
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
      resultPassed: true,
    });

    const reloadedPath = await service.getLearningPathProgress('course-id', '3');

    expect(reloadedPath.tasks.find((task) => task.id === 'task-1')).toMatchObject({
      status: TaskProgressStatus.COMPLETED,
      completionPercentage: 100,
      resultPassed: true,
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

  it('rejects non-enrolled users for learning progress', async () => {
    const { service } = createLearningProcessFixture();

    await expect(service.getLearningPathProgress('course-id', '99')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });
});
