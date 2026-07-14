import { ConfigService } from '@nestjs/config';

import { CourseDemoSeedService } from './course-demo-seed.service';
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
} from './entities/learning-material.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { Task, TaskGradingMode, TaskUnlockMode } from './entities/task.entity';

const matchesWhere = (item: any, where: Record<string, any> = {}) =>
  Object.entries(where).every(([key, expected]) => item[key] === expected);

const createRepository = <T extends Record<string, any>>(
  items: T[],
  prefix: string,
) => {
  let nextId = items.length + 1;

  const saveOne = (entity: T): T => {
    if (!(entity as any).id) {
      do {
        (entity as any).id = `${prefix}-${nextId++}`;
      } while (items.some((item) => (item as any).id === (entity as any).id));
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
    findOne: jest.fn(({ where } = {}) =>
      Promise.resolve(items.find((item) => matchesWhere(item, where)) ?? null),
    ),
    find: jest.fn(({ where } = {}) =>
      Promise.resolve(items.filter((item) => matchesWhere(item, where))),
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
  it('creates missing demo master data and refreshes deterministic demo task data without overwriting course or enrollment data', async () => {
    const course = createDemoCourse();
    const enrollment = createDemoEnrollment();
    const task = createDemoTask();
    const courseRepository = createRepository<Course>([course], 'course');
    const courseRunRepository = createRepository<CourseRun>([], 'run');
    const enrollmentRepository = createRepository<Enrollment>([enrollment], 'enrollment');
    const learningMaterialRepository = createRepository<LearningMaterial>([], 'material');
    const taskRepository = createRepository<Task>([task], 'task');
    const courseGroupRepository = createRepository<CourseGroup>([], 'group');
    const groupMembershipRepository = createRepository<GroupMembership>([], 'group-membership');
    const courseVersionRepository = createRepository<CourseVersion>(
      [
        {
          id: 'version-1',
          course_id: course.id,
          version_number: 1,
          change_summary: 'Bestehende Version',
          content: { course: { title: course.title } },
          course,
          status: CourseVersionStatus.PUBLISHED,
          created_at: new Date('2026-01-01T10:00:00.000Z'),
          created_by: 'teacher',
          is_active: true,
        } as CourseVersion,
      ],
      'version',
    );
    const service = new CourseDemoSeedService(
      {
        get: jest.fn((key: string) => (key === 'APP_ENV' ? 'development' : undefined)),
      } as unknown as ConfigService,
      courseRepository as any,
      courseRunRepository as any,
      enrollmentRepository as any,
      learningMaterialRepository as any,
      taskRepository as any,
      courseVersionRepository as any,
      courseGroupRepository as any,
      groupMembershipRepository as any,
    );

    await service.onApplicationBootstrap();

    expect(courseRepository.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          external_id: 'demo-learning-process',
          recurrenceType: CourseRecurrenceType.SEMESTER,
        }),
        expect.objectContaining({
          external_id: 'demo-enrollable-course',
          recurrenceType: CourseRecurrenceType.CONTINUOUS,
          status: CourseStatus.PUBLISHED,
        }),
      ]),
    );
    expect(courseRepository.items[0]).toMatchObject({
      description: 'Bestehende Beschreibung',
      title: 'Von Lehrenden umbenannt',
      updated_by: 'teacher',
    });
    expect(enrollmentRepository.items.find((item) => item.id === 'enrollment-3')).toMatchObject({
      role: CourseMemberRole.STUDENT,
      updatedBy: 'teacher',
    });
    expect(courseRunRepository.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          courseId: 'course-id',
          label: 'Sommersemester 2026',
          status: CourseRunStatus.ARCHIVED,
          isActive: false,
        }),
        expect.objectContaining({
          courseId: 'course-id',
          label: 'Wintersemester 2026/27',
          status: CourseRunStatus.PUBLISHED,
          isActive: true,
        }),
        expect.objectContaining({
          label: 'Fortlaufend',
          status: CourseRunStatus.PUBLISHED,
          isActive: true,
        }),
      ]),
    );
    const activeLearningRun = courseRunRepository.items.find(
      (item) => item.courseId === 'course-id' && item.isActive,
    );
    expect(activeLearningRun).toMatchObject({
      label: 'Wintersemester 2026/27',
    });
    expect(enrollmentRepository.items.find((item) => item.id === 'enrollment-3')).toMatchObject({
      courseRunId: activeLearningRun?.id,
      role: CourseMemberRole.STUDENT,
      updatedBy: 'teacher',
    });
    const previousLearningRun = courseRunRepository.items.find(
      (item) => item.courseId === 'course-id' && item.label === 'Sommersemester 2026',
    );
    expect(taskRepository.items.find((item) => item.id === 'task-1')).toMatchObject({
      courseRunId: previousLearningRun?.id,
      description: 'Ein kurzer einführender Lernschritt für den Demo-Ablauf.',
      gradingMode: TaskGradingMode.SELF_CONFIRMATION,
      isPublished: true,
      order: 1,
      title: 'Grundlagen kennenlernen',
      unlockMode: TaskUnlockMode.IMMEDIATE,
      updatedBy: 'demo-seed',
    });
    expect(
      taskRepository.items.find(
        (item) =>
          item.courseRunId === activeLearningRun?.id &&
          item.demoKey === 'learning-process-basics',
      ),
    ).toMatchObject({
      gradingMode: TaskGradingMode.SELF_CONFIRMATION,
      isPublished: true,
      title: 'Grundlagen kennenlernen',
      unlockMode: TaskUnlockMode.IMMEDIATE,
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
    expect(learningMaterialRepository.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          courseId: 'course-id',
          courseRunId: previousLearningRun?.id,
          isPublished: true,
          publicationStatus: LearningMaterialPublicationStatus.PUBLISHED,
          title: 'Material A',
        }),
        expect.objectContaining({
          courseId: 'course-id',
          courseRunId: previousLearningRun?.id,
          isPublished: true,
          publicationStatus: LearningMaterialPublicationStatus.PUBLISHED,
          title: 'Material B',
        }),
        expect.objectContaining({
          courseId: 'course-id',
          courseRunId: activeLearningRun?.id,
          isPublished: true,
          publicationStatus: LearningMaterialPublicationStatus.PUBLISHED,
          title: 'Material C',
        }),
      ]),
    );
    expect(courseVersionRepository.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          course_id: 'course-id',
          change_summary: 'Bestehende Version',
          course_run_id: activeLearningRun?.id,
          is_active: true,
          version_number: 1,
        }),
        expect.objectContaining({
          change_summary: 'Veröffentlichter Einschreibedemo-Kurs',
          is_active: true,
          version_number: 1,
        }),
      ]),
    );
    expect(
      courseVersionRepository.items.find(
        (item) => item.course_id === 'course-id' && item.version_number === 2,
      )?.content,
    ).toMatchObject({
      learningMaterials: expect.arrayContaining([
        expect.objectContaining({
          title: 'Material C',
        }),
        expect.objectContaining({
          title: 'Material D',
        }),
        expect.objectContaining({
          title: 'Material E',
        }),
      ]),
      tasks: expect.arrayContaining([
        expect.objectContaining({
          gradingMode: TaskGradingMode.SELF_CONFIRMATION,
          title: 'Grundlagen kennenlernen',
        }),
        expect.objectContaining({
          demoKey: 'learning-process-apply-basics',
          gradingMode: TaskGradingMode.MANUAL,
        }),
        expect.objectContaining({
          demoKey: 'learning-process-final-task',
          gradingMode: TaskGradingMode.AUTOMATIC_MOCK,
        }),
      ]),
    });
  });
});
