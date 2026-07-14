import { HttpStatus } from '@nestjs/common';

import { CoursesService } from './courses.service';
import { Assignment } from './entities/assignment.entity';
import { CourseResult } from './entities/course-result.entity';
import { Course, CourseRunTemplateStrategy, CourseStatus } from './entities/course.entity';
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
import { Task, TaskUnlockMode } from './entities/task.entity';
import {
  TaskProgress,
  TaskProgressStatus,
  TaskUnlockSource,
} from './entities/task-progress.entity';

const matchesExpected = (actual: unknown, expected: any): boolean => {
  if (expected && typeof expected === 'object' && '_type' in expected) {
    if (expected._type === 'not') {
      return actual !== expected._value;
    }

    if (expected._type === 'in') {
      return Array.isArray(expected._value) && expected._value.includes(actual);
    }

    if (expected._type === 'isNull') {
      return actual === null || actual === undefined;
    }
  }

  return actual === expected;
};

const matchesWhere = (item: any, where: Record<string, any> = {}) =>
  Object.entries(where).every(([key, expected]) => matchesExpected(item[key], expected));

const createRepository = <T extends { id?: string }>(
  items: T[] = [],
  prefix = 'entity',
) => {
  let nextId = items.length + 1;

  const sortItems = (result: T[], order?: Record<string, 'ASC' | 'DESC'>) => {
    const [field, direction] = Object.entries(order ?? {})[0] ?? [];

    if (!field) {
      return result;
    }

    return [...result].sort((left: any, right: any) => {
      const comparison = String(left[field] ?? '').localeCompare(
        String(right[field] ?? ''),
        undefined,
        { numeric: true },
      );

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
    delete: jest.fn((criteria: string | Record<string, any>) => {
      const deleteIndex =
        typeof criteria === 'string'
          ? items.findIndex((item) => item.id === criteria)
          : items.findIndex((item) => matchesWhere(item, criteria));

      if (deleteIndex >= 0) {
        items.splice(deleteIndex, 1);
      }

      return Promise.resolve({ affected: deleteIndex >= 0 ? 1 : 0 });
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

const createCourse = (overrides: Partial<Course>): Course =>
  ({
    id: 'course-id',
    external_id: 'course-id',
    title: 'Course',
    description: 'Course description',
    semester: 'Demo',
    status: CourseStatus.PUBLISHED,
    owner_id: 1,
    recurrenceType: CourseRecurrenceType.SEMESTER,
    created_at: new Date('2026-01-01T10:00:00.000Z'),
    updated_at: new Date('2026-01-02T10:00:00.000Z'),
    ...overrides,
  }) as Course;

const createEnrollment = (
  courseId: string,
  userId: string,
  role: CourseMemberRole,
  courseRun?: CourseRun,
): Enrollment =>
  ({
    id: `enrollment-${courseId}-${courseRun?.id ?? 'current'}-${userId}`,
    courseId,
    courseRunId: courseRun?.id,
    courseRun,
    userId,
    role,
    enrolledAt: new Date('2026-01-01T11:00:00.000Z'),
    updatedAt: new Date('2026-01-01T11:00:00.000Z'),
  }) as Enrollment;

const createMaterial = (overrides: Partial<LearningMaterial>): LearningMaterial =>
  ({
    id: 'material-id',
    courseId: 'managed-course',
    courseRunId: 'managed-course-run',
    title: 'Material',
    description: 'Material description',
    type: LearningMaterialType.DOCUMENT,
    originalFileName: 'material.pdf',
    storageKey: 'storage-key.pdf',
    mimeType: 'application/pdf',
    fileSize: 12,
    tags: [],
    sortOrder: 0,
    publicationStatus: LearningMaterialPublicationStatus.PUBLISHED,
    isPublished: true,
    createdBy: '1',
    updatedBy: '1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as LearningMaterial;

const createTask = (overrides: Partial<Task>): Task =>
  ({
    id: 'task-id',
    courseId: 'available-course',
    title: 'Start',
    description: 'Immediate starter task',
    type: 'DEMO_TASK',
    order: 1,
    unlockMode: TaskUnlockMode.IMMEDIATE,
    isPublished: true,
    completionCriteria: {},
    createdBy: '1',
    updatedBy: '1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as Task;

const createRun = (course: Course, overrides: Partial<CourseRun> = {}): CourseRun =>
  ({
    id: `${course.id}-run`,
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

const createVersion = (overrides: Partial<CourseVersion>): CourseVersion =>
  ({
    id: 'version-id',
    course_id: 'managed-course',
    version_number: 1,
    content: { course: { title: 'Version' } },
    label: 'Version 1',
    change_summary: 'Version',
    status: CourseVersionStatus.PUBLISHED,
    created_at: new Date('2026-01-01T10:00:00.000Z'),
    created_by: '1',
    is_active: false,
    ...overrides,
  }) as CourseVersion;

const emptyRepository = () => createRepository([]);

const createFixture = () => {
  const managedCourse = createCourse({
    id: 'managed-course',
    external_id: 'managed-course',
    title: 'Managed course',
    owner_id: 1,
  });
  const availableCourse = createCourse({
    id: 'available-course',
    external_id: 'available-course',
    title: 'Available course',
    owner_id: 2,
  });
  const enrolledCourse = createCourse({
    id: 'enrolled-course',
    external_id: 'enrolled-course',
    title: 'Enrolled course',
    owner_id: 2,
  });
  const draftCourse = createCourse({
    id: 'draft-course',
    external_id: 'draft-course',
    status: CourseStatus.DRAFT,
    title: 'Draft course',
  });
  const archivedCourse = createCourse({
    id: 'archived-course',
    external_id: 'archived-course',
    status: CourseStatus.ARCHIVED,
    title: 'Archived course',
  });
  const studentOwnedCourse = createCourse({
    id: 'student-owned-course',
    external_id: 'student-owned-course',
    owner_id: 3,
    title: 'Student owned course',
  });
  const otherCourse = createCourse({
    id: 'other-course',
    external_id: 'other-course',
    owner_id: 5,
    title: 'Other course',
  });
  const managedRun = createRun(managedCourse);
  const managedHistoricalRun = createRun(managedCourse, {
    id: 'managed-course-run-old',
    label: 'Sommersemester 2025',
    isActive: false,
    status: CourseRunStatus.ARCHIVED,
  });
  const managedEmptyRun = createRun(managedCourse, {
    id: 'managed-course-run-empty',
    label: 'Leerer Durchlauf',
    isActive: false,
  });
  const availableRun = createRun(availableCourse);
  const enrolledRun = createRun(enrolledCourse);
  const enrolledHistoricalRun = createRun(enrolledCourse, {
    id: 'enrolled-course-run-old',
    label: 'Sommersemester 2025',
    isActive: false,
    status: CourseRunStatus.ARCHIVED,
  });
  const draftRun = createRun(draftCourse, { status: CourseRunStatus.DRAFT });
  const archivedRun = createRun(archivedCourse, { status: CourseRunStatus.ARCHIVED });
  const studentOwnedRun = createRun(studentOwnedCourse);
  const otherRun = createRun(otherCourse);
  const teacherEnrollment = createEnrollment(
    'managed-course',
    '1',
    CourseMemberRole.TEACHER,
    managedRun,
  );
  teacherEnrollment.course = managedCourse;
  const studentEnrollment = createEnrollment(
    'enrolled-course',
    '3',
    CourseMemberRole.STUDENT,
    enrolledRun,
  );
  studentEnrollment.course = enrolledCourse;
  const historicalStudentEnrollment = createEnrollment(
    'enrolled-course',
    '3',
    CourseMemberRole.STUDENT,
    enrolledHistoricalRun,
  );
  historicalStudentEnrollment.course = enrolledCourse;
  const enrollments = [teacherEnrollment, studentEnrollment, historicalStudentEnrollment];
  const versions = [
    createVersion({
      id: 'managed-v1',
      course_id: 'managed-course',
      course_run_id: managedRun.id,
      courseRun: managedRun,
      version_number: 1,
    }),
    createVersion({
      id: 'managed-v2',
      course_id: 'managed-course',
      course_run_id: managedRun.id,
      courseRun: managedRun,
      version_number: 2,
      is_active: true,
    }),
    createVersion({
      id: 'managed-old-v1',
      course_id: 'managed-course',
      course_run_id: managedHistoricalRun.id,
      courseRun: managedHistoricalRun,
      version_number: 1,
      is_active: false,
    }),
    createVersion({
      id: 'managed-old-v2',
      course_id: 'managed-course',
      course_run_id: managedHistoricalRun.id,
      courseRun: managedHistoricalRun,
      version_number: 2,
      is_active: true,
      change_summary: 'Alte bewährte Aufgabenstruktur',
      content: {
        course: { id: 'managed-course', title: 'Managed course' },
        courseRun: { id: managedHistoricalRun.id, label: managedHistoricalRun.label },
        tasks: [
          {
            id: 'old-task-a',
            title: 'Vorbereitung',
            description: 'Vorbereitende Aufgabe',
            type: 'READING',
            order: 1,
            unlockMode: TaskUnlockMode.IMMEDIATE,
            isPublished: true,
            completionCriteria: { required: true },
          },
          {
            id: 'old-task-b',
            title: 'Abschluss',
            description: 'Hängt von Vorbereitung ab',
            type: 'QUIZ',
            order: 2,
            unlockMode: TaskUnlockMode.AUTOMATIC,
            prerequisiteTaskId: 'old-task-a',
            isPublished: true,
            completionCriteria: { points: 10 },
          },
        ],
        learningMaterials: [
          {
            id: 'old-material-a',
            title: 'Altes Skript',
            description: 'Wird nach Abschluss sichtbar',
            type: LearningMaterialType.DOCUMENT,
            originalFileName: 'skript.pdf',
            storageKey: 'shared-storage-key.pdf',
            mimeType: 'application/pdf',
            fileSize: 42,
            tags: ['skript'],
            sortOrder: 1,
            publicationStatus: LearningMaterialPublicationStatus.PUBLISHED,
            isPublished: true,
            releaseMode: LearningMaterialReleaseMode.AFTER_TASK_COMPLETION,
            releaseAfterTaskId: 'old-task-b',
          },
        ],
      },
    }),
    createVersion({
      id: 'managed-empty-v1',
      course_id: 'managed-course',
      course_run_id: managedEmptyRun.id,
      courseRun: managedEmptyRun,
      version_number: 1,
      is_active: false,
    }),
    createVersion({
      id: 'other-v1',
      course_id: 'other-course',
      course_run_id: otherRun.id,
      courseRun: otherRun,
      version_number: 1,
      is_active: true,
    }),
  ];
  const tasks = [
    createTask({
      id: 'managed-active-task',
      courseId: 'managed-course',
      courseRunId: managedRun.id,
      courseRun: managedRun,
      courseVersionId: 'managed-v2',
      courseVersion: versions.find((version) => version.id === 'managed-v2'),
      title: 'Managed task',
      description: 'Task stored in the active managed course run',
      unlockMode: TaskUnlockMode.IMMEDIATE,
    }),
    createTask({
      id: 'immediate-task',
      courseId: 'available-course',
      courseRunId: availableRun.id,
      courseRun: availableRun,
      unlockMode: TaskUnlockMode.IMMEDIATE,
    }),
    createTask({
      id: 'automatic-task',
      courseId: 'available-course',
      courseRunId: availableRun.id,
      courseRun: availableRun,
      unlockMode: TaskUnlockMode.AUTOMATIC,
    }),
  ];
  const materials = [
    createMaterial({
      id: 'managed-active-material',
      courseId: 'managed-course',
      courseRunId: managedRun.id,
      courseRun: managedRun,
      courseVersionId: 'managed-v2',
      courseVersion: versions.find((version) => version.id === 'managed-v2'),
      title: 'Material C',
      sortOrder: 1,
    }),
    createMaterial({
      id: 'managed-historical-material',
      courseId: 'managed-course',
      courseRunId: managedHistoricalRun.id,
      courseRun: managedHistoricalRun,
      courseVersionId: 'managed-old-v2',
      courseVersion: versions.find((version) => version.id === 'managed-old-v2'),
      title: 'Material A',
      sortOrder: 1,
    }),
    createMaterial({
      id: 'enrolled-active-material',
      courseId: 'enrolled-course',
      courseRunId: enrolledRun.id,
      courseRun: enrolledRun,
      title: 'Student active material',
      sortOrder: 1,
    }),
    createMaterial({
      id: 'enrolled-historical-material',
      courseId: 'enrolled-course',
      courseRunId: enrolledHistoricalRun.id,
      courseRun: enrolledHistoricalRun,
      title: 'Student historical material',
      sortOrder: 1,
    }),
  ];
  const assignments = [
    {
      id: 'old-assignment',
      courseRunId: managedHistoricalRun.id,
      title: 'Historische Abgabe',
    } as Assignment,
  ];
  const results = [
    {
      id: 'old-result',
      courseId: 'managed-course',
      courseRunId: managedHistoricalRun.id,
      studentId: '3',
    } as CourseResult,
  ];
  const courseRepository = createRepository<Course>(
    [
      managedCourse,
      availableCourse,
      enrolledCourse,
      draftCourse,
      archivedCourse,
      studentOwnedCourse,
      otherCourse,
    ],
    'course',
  );
  const courseRunRepository = createRepository<CourseRun>(
    [
      managedRun,
      managedHistoricalRun,
      managedEmptyRun,
      availableRun,
      enrolledRun,
      enrolledHistoricalRun,
      draftRun,
      archivedRun,
      studentOwnedRun,
      otherRun,
    ],
    'run',
  );
  const courseVersionRepository = createRepository<CourseVersion>(versions, 'version');
  const materialRepository = createRepository<LearningMaterial>(materials, 'material');
  const assignmentRepository = createRepository<Assignment>(assignments, 'assignment');
  const courseResultRepository = createRepository<CourseResult>(results, 'result');
  const enrollmentRepository = createRepository<Enrollment>(enrollments, 'enrollment');
  const taskRepository = createRepository<Task>(tasks, 'task');
  const taskAssessmentRepository = createRepository([], 'assessment');
  const taskProgressRepository = createRepository<TaskProgress>([], 'progress');
  const service = new CoursesService(
    courseRepository as any,
    courseRunRepository as any,
    courseVersionRepository as any,
    materialRepository as any,
    assignmentRepository as any,
    emptyRepository() as any,
    courseResultRepository as any,
    enrollmentRepository as any,
    taskRepository as any,
    taskAssessmentRepository as any,
    taskProgressRepository as any,
    emptyRepository() as any,
    emptyRepository() as any,
    emptyRepository() as any,
    emptyRepository() as any,
    emptyRepository() as any,
    {
      deleteFile: jest.fn(),
      openFile: jest.fn(),
      saveFile: jest.fn(),
    } as any,
  );

  return {
    assignmentRepository,
    courseResultRepository,
    courseRepository,
    courseVersionRepository,
    courseRunRepository,
    enrollmentRepository,
    materialRepository,
    service,
    taskRepository,
    taskAssessmentRepository,
    taskProgressRepository,
  };
};

describe('CoursesService course catalog, enrollment and versioning', () => {
  it('separates enrolled courses from published enrollable courses', async () => {
    const { service } = createFixture();

    await expect(service.getEnrolledCourses('3')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'enrolled-course',
          enrolled: true,
          canEnroll: false,
          membershipRole: CourseMemberRole.STUDENT,
        }),
      ]),
    );

    const availableCourses = await service.getAvailableCourses('3');
    const availableCourseIds = availableCourses.map((course) => course.id);

    expect(availableCourseIds).toContain('available-course');
    expect(availableCourseIds).not.toContain('enrolled-course');
    expect(availableCourseIds).not.toContain('draft-course');
    expect(availableCourseIds).not.toContain('archived-course');
    expect(availableCourseIds).not.toContain('student-owned-course');
    expect(availableCourses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enrolled: false,
          canEnroll: true,
        }),
      ]),
    );
  });

  it('enrolls the authenticated user idempotently and initializes immediate task progress', async () => {
    const { enrollmentRepository, service, taskProgressRepository } = createFixture();

    await expect(service.enrollInCourse('available-course', '3')).resolves.toMatchObject({
      courseId: 'available-course',
      role: CourseMemberRole.STUDENT,
      userId: '3',
    });
    await expect(service.enrollInCourse('available-course', '3')).resolves.toMatchObject({
      courseId: 'available-course',
      role: CourseMemberRole.STUDENT,
      userId: '3',
    });

    expect(
      enrollmentRepository.items.filter(
        (enrollment) =>
          enrollment.courseId === 'available-course' && enrollment.userId === '3',
      ),
    ).toHaveLength(1);
    expect(taskProgressRepository.items).toEqual([
      expect.objectContaining({
        enrollmentId: expect.any(String),
        status: TaskProgressStatus.AVAILABLE,
        taskId: 'immediate-task',
        unlockSource: TaskUnlockSource.IMMEDIATE,
      }),
    ]);
    await expect(service.getCourseContext('available-course', '3')).resolves.toMatchObject({
      membership: {
        role: CourseMemberRole.STUDENT,
        userId: '3',
      },
    });
  });

  it('rejects enrollment into drafts, archived courses and teaching roles', async () => {
    const { service } = createFixture();

    await expect(service.enrollInCourse('draft-course', '3')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
    await expect(service.enrollInCourse('archived-course', '3')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
    await expect(service.enrollInCourse('managed-course', '1')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('lists and reads only versions belonging to the requested course', async () => {
    const { courseVersionRepository, enrollmentRepository, service } = createFixture();

    await expect(service.listCourseVersions('managed-course', '1')).resolves.toEqual([
      expect.objectContaining({
        id: 'managed-v2',
        versionNumber: 2,
      }),
      expect.objectContaining({
        id: 'managed-v1',
        versionNumber: 1,
      }),
    ]);
    await expect(service.getCourseVersion('managed-course', 'other-v1', '1')).rejects.toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
    });
    await expect(service.listCourseVersions('managed-course', '99')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });

    enrollmentRepository.items.push(
      createEnrollment(
        'draft-course',
        '3',
        CourseMemberRole.STUDENT,
        { id: 'draft-course-run', isActive: true } as CourseRun,
      ),
    );
    courseVersionRepository.items.push(
      createVersion({
        id: 'draft-v1',
        course_id: 'draft-course',
        course_run_id: 'draft-course-run',
      }),
    );
    await expect(service.listCourseVersions('draft-course', '3')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('lets teachers create and activate course-specific versions only', async () => {
    const { courseVersionRepository, service } = createFixture();

    const createdVersion = await service.createCourseVersion(
      'managed-course',
      {
        activate: true,
        changeSummary: 'Neue Struktur',
      },
      '1',
    );

    expect(createdVersion).toMatchObject({
      changeSummary: 'Neue Struktur',
      courseId: 'managed-course',
      isActive: true,
      versionNumber: 3,
    });
    expect(createdVersion.content).toMatchObject({
      course: expect.objectContaining({
        id: 'managed-course',
        title: 'Managed course',
      }),
      courseRun: expect.objectContaining({
        id: 'managed-course-run',
      }),
      learningMaterials: [
        expect.objectContaining({
          courseVersionId: createdVersion.id,
          title: 'Material C',
        }),
      ],
      tasks: [
        expect.objectContaining({
          courseVersionId: createdVersion.id,
          title: 'Managed task',
        }),
      ],
    });
    expect(
      courseVersionRepository.items.filter(
        (version) =>
          version.course_id === 'managed-course' &&
          version.course_run_id === 'managed-course-run' &&
          version.is_active,
      ),
    ).toHaveLength(1);

    await expect(
      service.createCourseVersion('managed-course', { changeSummary: 'Student' }, '3'),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
    await expect(
      service.activateCourseVersion('other-course', 'other-v1', '1'),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });

    await expect(service.activateCourseVersion('managed-course', 'managed-v1', '1')).resolves.toMatchObject({
      id: 'managed-v1',
      isActive: true,
    });
    expect(courseVersionRepository.items.find((version) => version.id === 'managed-v2')).toMatchObject({
      is_active: false,
    });
    expect(courseVersionRepository.items.find((version) => version.id === 'other-v1')).toMatchObject({
      is_active: true,
    });
  });

  it('lists course version templates from all runs only for teachers', async () => {
    const { service } = createFixture();

    await expect(service.listCourseVersionTemplates('managed-course', '1')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'managed-v2',
          courseRunId: 'managed-course-run',
          courseRunLabel: 'Sommersemester 2026',
        }),
        expect.objectContaining({
          id: 'managed-old-v2',
          courseRunId: 'managed-course-run-old',
          courseRunLabel: 'Sommersemester 2025',
          versionNumber: 2,
        }),
      ]),
    );
    await expect(service.listCourseVersionTemplates('managed-course', '3')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('deletes only inactive unreferenced versions inside a writable course run', async () => {
    const { courseVersionRepository, service } = createFixture();

    await expect(
      service.deleteCourseVersion('managed-course', 'managed-course-run', 'managed-v1', '1'),
    ).resolves.toBeUndefined();
    expect(courseVersionRepository.items.some((version) => version.id === 'managed-v1')).toBe(false);

    await expect(
      service.deleteCourseVersion('managed-course', 'managed-course-run', 'managed-v2', '1'),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: HttpStatus.BAD_REQUEST,
    });
    await expect(
      service.deleteCourseVersion('managed-course', 'managed-course-run-old', 'managed-old-v1', '1'),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: HttpStatus.BAD_REQUEST,
    });
    await expect(
      service.deleteCourseVersion('managed-course', 'managed-course-run-empty', 'managed-empty-v1', '1'),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: HttpStatus.BAD_REQUEST,
    });
    await expect(
      service.deleteCourseVersion('managed-course', 'managed-course-run', 'managed-v1', '3'),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('blocks students from course run history and historical direct URLs', async () => {
    const { service } = createFixture();

    await expect(service.listCourseRuns('enrolled-course', '3')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
    await expect(
      service.getCourseRun('enrolled-course', 'enrolled-course-run-old', '3'),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
    await expect(service.getCurrentCourseRun('enrolled-course', '3')).resolves.toMatchObject({
      id: 'enrolled-course-run',
      isActive: true,
    });
  });

  it('lets teachers inspect run history for their course', async () => {
    const { service } = createFixture();

    await expect(service.listCourseRuns('managed-course', '1')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'managed-course-run',
          isActive: true,
        }),
        expect.objectContaining({
          id: 'managed-course-run-old',
          isActive: false,
        }),
      ]),
    );
    await expect(
      service.getCourseRun('managed-course', 'managed-course-run-old', '1'),
    ).resolves.toMatchObject({
      id: 'managed-course-run-old',
      label: 'Sommersemester 2025',
    });
  });

  it('deletes empty inactive course runs and archives runs with historical data', async () => {
    const { courseRunRepository, service } = createFixture();

    await expect(
      service.deleteOrArchiveCourseRun('managed-course', 'managed-course-run-empty', '1'),
    ).resolves.toMatchObject({
      action: 'DELETED',
    });
    expect(
      courseRunRepository.items.some((run) => run.id === 'managed-course-run-empty'),
    ).toBe(false);

    await expect(
      service.deleteOrArchiveCourseRun('enrolled-course', 'enrolled-course-run-old', '2'),
    ).resolves.toMatchObject({
      action: 'ARCHIVED',
      run: expect.objectContaining({
        id: 'enrolled-course-run-old',
        status: CourseRunStatus.ARCHIVED,
      }),
    });
  });

  it('rejects deleting active runs and student run deletion attempts', async () => {
    const { service } = createFixture();

    await expect(
      service.deleteOrArchiveCourseRun('managed-course', 'managed-course-run', '1'),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: HttpStatus.BAD_REQUEST,
    });
    await expect(
      service.deleteOrArchiveCourseRun('enrolled-course', 'enrolled-course-run-old', '3'),
    ).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('filters teacher materials by selected course run', async () => {
    const { service } = createFixture();

    await expect(
      service.getLearningMaterialsByCourseRun(
        'managed-course',
        'managed-course-run',
        '1',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'managed-active-material',
        title: 'Material C',
      }),
    ]);
    await expect(
      service.getLearningMaterialsByCourseRun(
        'managed-course',
        'managed-course-run-old',
        '1',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'managed-historical-material',
        title: 'Material A',
      }),
    ]);
    await expect(
      service.getLearningMaterialsByCourseRun(
        'managed-course',
        'managed-course-run-empty',
        '1',
      ),
    ).resolves.toEqual([]);
    await expect(
      service.getLearningMaterialsByCourseRun(
        'managed-course',
        'other-course-run',
        '1',
      ),
    ).rejects.toMatchObject({
      code: 'COURSE_RUN_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  it('keeps student material access scoped to the active run', async () => {
    const { service } = createFixture();

    await expect(service.getLearningMaterialsByCourse('enrolled-course', '3')).resolves.toEqual([
      expect.objectContaining({
        id: 'enrolled-active-material',
        title: 'Student active material',
      }),
    ]);
    await expect(service.getLearningMaterialById('enrolled-historical-material', '3')).rejects.toMatchObject({
      code: 'MATERIAL_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('returns the run plan with the next semester run for teachers only', async () => {
    const { service } = createFixture();

    await expect(service.getCourseRunPlan('managed-course', '1')).resolves.toMatchObject({
      currentRun: expect.objectContaining({
        id: 'managed-course-run',
        label: 'Sommersemester 2026',
      }),
      nextRun: {
        label: 'Wintersemester 2026/27',
        startDate: '2026-10-01',
        endDate: '2027-03-31',
      },
      recurrenceType: CourseRecurrenceType.SEMESTER,
      regularPlanningAvailable: true,
      templateStrategy: CourseRunTemplateStrategy.ACTIVE_VERSION_OF_CURRENT_RUN,
      templateVersion: expect.objectContaining({
        id: 'managed-v2',
      }),
    });
    await expect(service.getCourseRunPlan('enrolled-course', '3')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('calculates yearly and continuous run plans from the course rhythm', async () => {
    const { courseRepository, courseRunRepository, courseVersionRepository, enrollmentRepository, service } = createFixture();
    const yearlyCourse = createCourse({
      id: 'yearly-course',
      external_id: 'yearly-course',
      owner_id: 1,
      recurrenceType: CourseRecurrenceType.YEARLY,
      title: 'Yearly course',
    });
    const yearlyRun = createRun(yearlyCourse, {
      id: 'yearly-run',
      label: '2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    const continuousCourse = createCourse({
      id: 'continuous-course',
      external_id: 'continuous-course',
      owner_id: 1,
      recurrenceType: CourseRecurrenceType.CONTINUOUS,
      title: 'Continuous course',
    });
    const continuousRun = createRun(continuousCourse, {
      id: 'continuous-run',
      label: 'Fortlaufend',
      startDate: undefined,
      endDate: undefined,
    });

    courseRepository.items.push(yearlyCourse, continuousCourse);
    courseRunRepository.items.push(yearlyRun, continuousRun);
    enrollmentRepository.items.push(
      createEnrollment('yearly-course', '1', CourseMemberRole.TEACHER, yearlyRun),
      createEnrollment('continuous-course', '1', CourseMemberRole.TEACHER, continuousRun),
    );
    courseVersionRepository.items.push(
      createVersion({
        id: 'yearly-v1',
        course_id: 'yearly-course',
        course_run_id: yearlyRun.id,
        courseRun: yearlyRun,
        is_active: true,
      }),
      createVersion({
        id: 'continuous-v1',
        course_id: 'continuous-course',
        course_run_id: continuousRun.id,
        courseRun: continuousRun,
        is_active: true,
      }),
    );

    await expect(service.getCourseRunPlan('yearly-course', '1')).resolves.toMatchObject({
      nextRun: {
        label: '2027',
        startDate: '2027-01-01',
        endDate: '2027-12-31',
      },
      recurrenceType: CourseRecurrenceType.YEARLY,
      regularPlanningAvailable: true,
    });
    await expect(service.getCourseRunPlan('continuous-course', '1')).resolves.toMatchObject({
      nextRun: null,
      recurrenceType: CourseRecurrenceType.CONTINUOUS,
      regularPlanningAvailable: false,
    });
    await expect(service.createCourseRun('continuous-course', {}, '1')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });

  it('creates the next course run without activating it until requested', async () => {
    const { courseRunRepository, courseVersionRepository, service } = createFixture();

    await expect(
      service.createCourseRun(
        'managed-course',
        {
          endDate: '2027-03-31',
          label: 'Wintersemester 2026/27',
          startDate: '2026-10-01',
        },
        '1',
      ),
    ).resolves.toMatchObject({
      courseId: 'managed-course',
      isActive: false,
      label: 'Wintersemester 2026/27',
      sourceRunId: 'managed-course-run',
    });
    expect(courseRunRepository.items.find((run) => run.id === 'managed-course-run')).toMatchObject({
      isActive: true,
    });

    const createdRun = courseRunRepository.items.find(
      (run) => run.label === 'Wintersemester 2026/27',
    );
    expect(createdRun).toBeDefined();
    expect(courseVersionRepository.items.find((version) => version.course_run_id === createdRun?.id)).toMatchObject({
      sourceVersionId: 'managed-v2',
    });

    await expect(
      service.activateCourseRun('managed-course', createdRun?.id ?? '', '1'),
    ).resolves.toMatchObject({
      id: createdRun?.id,
      isActive: true,
    });
    expect(courseRunRepository.items.find((run) => run.id === 'managed-course-run')).toMatchObject({
      isActive: false,
    });
  });

  it('creates a new course run from a selected old course version and remaps content ids', async () => {
    const {
      assignmentRepository,
      courseResultRepository,
      courseRunRepository,
      courseVersionRepository,
      enrollmentRepository,
      materialRepository,
      service,
      taskRepository,
    } = createFixture();

    const createdRun = await service.createCourseRun(
      'managed-course',
      {
        sourceVersionId: 'managed-old-v2',
      },
      '1',
    );

    expect(createdRun).toMatchObject({
      label: 'Wintersemester 2026/27',
      sourceRunId: 'managed-course-run-old',
    });

    const copiedTasks = taskRepository.items
      .filter((task) => task.courseRunId === createdRun.id)
      .sort((left, right) => left.order - right.order);
    expect(copiedTasks).toHaveLength(2);
    expect(copiedTasks.map((task) => task.id)).not.toContain('old-task-a');
    expect(copiedTasks[1]).toMatchObject({
      prerequisiteTaskId: copiedTasks[0].id,
      title: 'Abschluss',
    });

    const copiedMaterials = materialRepository.items.filter(
      (material) => material.courseRunId === createdRun.id,
    );
    expect(copiedMaterials).toEqual([
      expect.objectContaining({
        id: expect.not.stringMatching(/^old-material-a$/),
        releaseAfterTaskId: copiedTasks[1].id,
        storageKey: 'shared-storage-key.pdf',
        title: 'Altes Skript',
      }),
    ]);

    expect(courseVersionRepository.items.find((version) => version.course_run_id === createdRun.id)).toMatchObject({
      is_active: true,
      sourceVersionId: 'managed-old-v2',
      content: expect.objectContaining({
        learningMaterials: [
          expect.objectContaining({
            releaseAfterTaskId: copiedTasks[1].id,
            title: 'Altes Skript',
          }),
        ],
        tasks: [
          expect.objectContaining({
            id: copiedTasks[0].id,
            title: 'Vorbereitung',
          }),
          expect.objectContaining({
            id: copiedTasks[1].id,
            prerequisiteTaskId: copiedTasks[0].id,
          }),
        ],
      }),
    });
    expect(
      enrollmentRepository.items.filter((enrollment) => enrollment.courseRunId === createdRun.id),
    ).toHaveLength(0);
    expect(
      assignmentRepository.items.filter((assignment) => assignment.courseRunId === createdRun.id),
    ).toHaveLength(0);
    expect(
      courseResultRepository.items.filter((result) => result.courseRunId === createdRun.id),
    ).toHaveLength(0);
    expect(courseRunRepository.items.find((run) => run.id === createdRun.id)).toBeDefined();
  });

  it('rejects course run templates from another course and referenced source version deletion', async () => {
    const { courseVersionRepository, service } = createFixture();

    await expect(
      service.createCourseRun(
        'managed-course',
        {
          label: 'Sommersemester 2027',
          sourceVersionId: 'other-v1',
        },
        '1',
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: HttpStatus.BAD_REQUEST,
    });

    courseVersionRepository.items.push(
      createVersion({
        id: 'derived-v1',
        course_id: 'managed-course',
        course_run_id: 'managed-course-run',
        sourceVersionId: 'managed-v1',
      }),
    );

    await expect(
      service.deleteCourseVersion('managed-course', 'managed-course-run', 'managed-v1', '1'),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });

  it('uses the configured course run template when preparing the next run', async () => {
    const { courseVersionRepository, service } = createFixture();

    await expect(
      service.updateCourseRunPlanTemplate(
        'managed-course',
        {
          strategy: CourseRunTemplateStrategy.SPECIFIC_VERSION,
          sourceVersionId: 'managed-old-v2',
        },
        '1',
      ),
    ).resolves.toMatchObject({
      templateStrategy: CourseRunTemplateStrategy.SPECIFIC_VERSION,
      templateVersion: expect.objectContaining({
        id: 'managed-old-v2',
      }),
    });

    const createdRun = await service.createCourseRun(
      'managed-course',
      {
        status: CourseRunStatus.PUBLISHED,
      },
      '1',
    );

    expect(courseVersionRepository.items.find((version) => version.course_run_id === createdRun.id)).toMatchObject({
      sourceVersionId: 'managed-old-v2',
    });
    await expect(
      service.updateCourseRunPlanTemplate(
        'managed-course',
        {
          strategy: CourseRunTemplateStrategy.SPECIFIC_VERSION,
          sourceVersionId: 'other-v1',
        },
        '1',
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });
});
