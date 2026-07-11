import { ConfigService } from '@nestjs/config';

import { CourseDemoSeedService } from './course-demo-seed.service';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseMemberRole, Enrollment } from './entities/enrollment.entity';
import { Task, TaskUnlockMode } from './entities/task.entity';

const matchesWhere = (item: any, where: Record<string, any> = {}) =>
  Object.entries(where).every(([key, expected]) => item[key] === expected);

const createRepository = <T extends { id?: string }>(
  items: T[],
  prefix: string,
) => {
  let nextId = items.length + 1;

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
    findOne: jest.fn(({ where } = {}) =>
      Promise.resolve(items.find((item) => matchesWhere(item, where)) ?? null),
    ),
    save: jest.fn((entity: T) => Promise.resolve(saveOne(entity))),
  };
};

const createDemoCourse = (): Course =>
  ({
    id: 'course-id',
    external_id: 'demo-learning-process',
    title: 'Von Lehrenden umbenannt',
    description: 'Bestehende Beschreibung',
    semester: 'Demo',
    status: CourseStatus.PUBLISHED,
    location: 'Friedberg',
    owner_id: 1,
    created_by: 'teacher',
    updated_by: 'teacher',
  }) as Course;

const createDemoEnrollment = (): Enrollment =>
  ({
    id: 'enrollment-3',
    courseId: 'course-id',
    userId: '3',
    role: CourseMemberRole.STUDENT,
    createdBy: 'teacher',
    updatedBy: 'teacher',
  }) as Enrollment;

const createDemoTask = (): Task =>
  ({
    id: 'task-1',
    courseId: 'course-id',
    demoKey: 'learning-process-basics',
    title: 'Von Lehrenden angepasste Aufgabe',
    description: 'Bestehende Aufgabenbeschreibung',
    type: 'CUSTOM_TASK',
    order: 9,
    unlockMode: TaskUnlockMode.MANUAL,
    isPublished: false,
    createdBy: 'teacher',
    updatedBy: 'teacher',
  }) as Task;

describe('CourseDemoSeedService', () => {
  it('creates missing demo master data without overwriting existing course, enrollment or task data', async () => {
    const course = createDemoCourse();
    const enrollment = createDemoEnrollment();
    const task = createDemoTask();
    const courseRepository = createRepository<Course>([course], 'course');
    const enrollmentRepository = createRepository<Enrollment>([enrollment], 'enrollment');
    const taskRepository = createRepository<Task>([task], 'task');
    const service = new CourseDemoSeedService(
      {
        get: jest.fn((key: string) => (key === 'APP_ENV' ? 'development' : undefined)),
      } as unknown as ConfigService,
      courseRepository as any,
      enrollmentRepository as any,
      taskRepository as any,
    );

    await service.onApplicationBootstrap();

    expect(courseRepository.items).toHaveLength(1);
    expect(courseRepository.items[0]).toMatchObject({
      description: 'Bestehende Beschreibung',
      title: 'Von Lehrenden umbenannt',
      updated_by: 'teacher',
    });
    expect(enrollmentRepository.items.find((item) => item.id === 'enrollment-3')).toMatchObject({
      role: CourseMemberRole.STUDENT,
      updatedBy: 'teacher',
    });
    expect(taskRepository.items.find((item) => item.id === 'task-1')).toMatchObject({
      description: 'Bestehende Aufgabenbeschreibung',
      isPublished: false,
      order: 9,
      title: 'Von Lehrenden angepasste Aufgabe',
      unlockMode: TaskUnlockMode.MANUAL,
      updatedBy: 'teacher',
    });
    expect(taskRepository.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          demoKey: 'learning-process-apply-basics',
        }),
        expect.objectContaining({
          demoKey: 'learning-process-final-task',
        }),
      ]),
    );
  });
});
