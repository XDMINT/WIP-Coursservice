import { HttpStatus } from '@nestjs/common';

import { CoursesService } from './courses.service';
import {
  LearningMaterial,
  LearningMaterialPublicationStatus,
  LearningMaterialReleaseMode,
  LearningMaterialType,
} from './entities/learning-material.entity';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseRun, CourseRunStatus } from './entities/course-run.entity';
import { CourseVersion, CourseVersionStatus } from './entities/course-version.entity';
import { CourseMemberRole, Enrollment } from './entities/enrollment.entity';
import { Task } from './entities/task.entity';
import { TaskProgress, TaskProgressStatus } from './entities/task-progress.entity';
import { LocalMaterialStorage } from './storage/material-storage';

const emptyRepository = () => ({
  delete: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
});

const createEnrollment = (
  userId: string,
  role: CourseMemberRole,
  courseRun?: CourseRun,
): Enrollment =>
  ({
    id: `enrollment-${userId}`,
    courseId: 'course-id',
    courseRunId: courseRun?.id,
    courseRun,
    userId,
    role,
  }) as Enrollment;

const createCourse = (): Course =>
  ({
    id: 'course-id',
    external_id: 'course-id',
    title: 'Course',
    status: CourseStatus.PUBLISHED,
    owner_id: 1,
  }) as Course;

const createCourseRun = (course: Course): CourseRun =>
  ({
    id: 'course-run-id',
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
  }) as CourseRun;

const createMaterial = (
  overrides: Partial<LearningMaterial> = {},
): LearningMaterial =>
  ({
    id: 'material-id',
    courseId: 'course-id',
    courseRunId: 'course-run-id',
    title: 'Slides',
    description: 'Week 1',
    type: LearningMaterialType.DOCUMENT,
    originalFileName: 'slides.pdf',
    storageKey: 'storage-key.pdf',
    mimeType: 'application/pdf',
    fileSize: 12,
    tags: ['intro'],
    sortOrder: 0,
    publicationStatus: LearningMaterialPublicationStatus.PUBLISHED,
    releaseMode: LearningMaterialReleaseMode.IMMEDIATE,
    isPublished: true,
    createdBy: '1',
    updatedBy: '1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as LearningMaterial;

const matchesExpected = (actual: unknown, expected: any): boolean => {
  if (expected && typeof expected === 'object' && '_type' in expected) {
    if (expected._type === 'not') {
      return actual !== expected._value;
    }

    if (expected._type === 'isNull') {
      return actual === null || actual === undefined;
    }

    if (expected._type === 'in') {
      return Array.isArray(expected._value) && expected._value.includes(actual);
    }
  }

  return actual === expected;
};

const matchesWhere = (item: any, where: Record<string, any> = {}) =>
  Object.entries(where).every(([key, expected]) => matchesExpected(item[key], expected));

const createCourseVersion = (course: Course, courseRun: CourseRun): CourseVersion =>
  ({
    id: 'course-version-id',
    course_id: course.id,
    course,
    course_run_id: courseRun.id,
    courseRun,
    version_number: 1,
    label: 'Version 1',
    content: {},
    change_summary: 'Initial',
    status: CourseVersionStatus.PUBLISHED,
    created_at: new Date('2026-01-01T10:00:00.000Z'),
    created_by: '1',
    is_active: true,
  }) as CourseVersion;

const createService = (options: {
  enrollments?: Enrollment[];
  materials?: LearningMaterial[];
  progress?: TaskProgress[];
  storage?: Record<string, jest.Mock>;
  tasks?: Task[];
}) => {
  const course = createCourse();
  const currentRun = createCourseRun(course);
  const currentVersion = createCourseVersion(course, currentRun);
  const enrollments = options.enrollments ?? [];
  enrollments.forEach((enrollment) => {
    if (enrollment.courseId === course.id && !enrollment.courseRunId) {
      enrollment.courseRunId = currentRun.id;
      enrollment.courseRun = currentRun;
    }
  });
  const materials = options.materials ?? [];
  materials.forEach((material) => {
    if (material.courseId === course.id && !material.courseRunId) {
      material.courseRunId = currentRun.id;
      material.courseRun = currentRun;
    }
    if (material.courseRunId === currentRun.id && !material.courseVersionId) {
      material.courseVersionId = currentVersion.id;
      material.courseVersion = currentVersion;
    }
  });
  const tasks = options.tasks ?? [];
  tasks.forEach((task) => {
    if (task.courseRunId === currentRun.id && !task.courseVersionId) {
      task.courseVersionId = currentVersion.id;
      task.courseVersion = currentVersion;
    }
  });
  const progress = options.progress ?? [];
  const courseRepository = {
    ...emptyRepository(),
    findOne: jest.fn(({ where } = {}) =>
      Promise.resolve(matchesWhere(course, where) ? course : null),
    ),
  };
  const courseRunRepository = {
    ...emptyRepository(),
    find: jest.fn(({ where } = {}) =>
      Promise.resolve([currentRun].filter((run) => matchesWhere(run, where))),
    ),
    findOne: jest.fn(({ where } = {}) =>
      Promise.resolve(matchesWhere(currentRun, where) ? currentRun : null),
    ),
    save: jest.fn((entity) => Promise.resolve(entity)),
  };
  const courseVersionRepository = {
    ...emptyRepository(),
    find: jest.fn(({ where } = {}) =>
      Promise.resolve([currentVersion].filter((version) => matchesWhere(version, where))),
    ),
    findOne: jest.fn(({ where } = {}) =>
      Promise.resolve(matchesWhere(currentVersion, where) ? currentVersion : null),
    ),
    save: jest.fn((entity) => Promise.resolve(entity)),
  };
  const materialRepository = {
    delete: jest.fn(),
    find: jest.fn(({ where }) =>
      Promise.resolve(materials.filter((material) => matchesWhere(material, where))),
    ),
    findOne: jest.fn(({ where }) =>
      Promise.resolve(materials.find((material) => matchesWhere(material, where)) ?? null),
    ),
    save: jest.fn((entity) =>
      Promise.resolve(
        Array.isArray(entity)
          ? entity
          : {
              id: entity.id ?? 'material-id',
              createdAt: new Date('2026-01-01T10:00:00.000Z'),
              updatedAt: new Date('2026-01-01T10:00:00.000Z'),
              ...entity,
            },
      ),
    ),
  };
  const enrollmentRepository = {
    ...emptyRepository(),
    find: jest.fn(({ where } = {}) =>
      Promise.resolve(enrollments.filter((entry) => matchesWhere(entry, where))),
    ),
    findOne: jest.fn(({ where }) =>
      Promise.resolve(
        enrollments.find((entry) => matchesWhere(entry, where)) ?? null,
      ),
    ),
  };
  const taskRepository = {
    ...emptyRepository(),
    find: jest.fn(({ where } = {}) =>
      Promise.resolve(tasks.filter((task) => matchesWhere(task, where))),
    ),
    findOne: jest.fn(({ where } = {}) =>
      Promise.resolve(tasks.find((task) => matchesWhere(task, where)) ?? null),
    ),
  };
  const taskProgressRepository = {
    ...emptyRepository(),
    findOne: jest.fn(({ where } = {}) =>
      Promise.resolve(progress.find((entry) => matchesWhere(entry, where)) ?? null),
    ),
  };
  const storage = {
    deleteFile: jest.fn(),
    openFile: jest.fn(() => ({
      stream: {
        on: jest.fn(),
        pipe: jest.fn(),
      },
    })),
    saveFile: jest.fn().mockResolvedValue({
      safeFileName: 'slides.pdf',
      storageKey: 'server-generated.pdf',
    }),
    ...options.storage,
  };
  const service = new CoursesService(
    courseRepository as any,
    courseRunRepository as any,
    courseVersionRepository as any,
    materialRepository as any,
    emptyRepository() as any,
    emptyRepository() as any,
    emptyRepository() as any,
    enrollmentRepository as any,
    taskRepository as any,
    taskProgressRepository as any,
    emptyRepository() as any,
    emptyRepository() as any,
    emptyRepository() as any,
    emptyRepository() as any,
    emptyRepository() as any,
    storage as any,
  );

  return {
    materialRepository,
    service,
    storage,
  };
};

describe('Learning materials', () => {
  it('allows teachers to upload files', async () => {
    const { service, storage } = createService({
      enrollments: [createEnrollment('1', CourseMemberRole.TEACHER)],
    });

    await expect(
      service.createLearningMaterialFile(
        'course-id',
        {
          tags: 'intro,slides',
          title: 'Slides',
          type: LearningMaterialType.DOCUMENT,
        },
        {
          buffer: Buffer.from('pdf'),
          mimetype: 'application/pdf',
          originalname: '../slides.pdf',
          size: 3,
        },
        '1',
      ),
    ).resolves.toMatchObject({
      originalFileName: 'slides.pdf',
      publicationStatus: LearningMaterialPublicationStatus.DRAFT,
      tags: ['intro', 'slides'],
      title: 'Slides',
    });
    expect(storage.saveFile).toHaveBeenCalledWith(
      'course-id',
      '../slides.pdf',
      expect.any(Buffer),
    );
  });

  it('allows students to download published files', async () => {
    const { service, storage } = createService({
      enrollments: [createEnrollment('2', CourseMemberRole.STUDENT)],
      materials: [createMaterial()],
    });

    await expect(service.downloadLearningMaterial('material-id', '2')).resolves.toMatchObject({
      fileName: 'slides.pdf',
      mimeType: 'application/pdf',
    });
    expect(storage.openFile).toHaveBeenCalledWith('course-id', 'storage-key.pdf');
  });

  it('marks task-gated material as locked before successful task completion', async () => {
    const enrollment = createEnrollment('2', CourseMemberRole.STUDENT, createCourseRun(createCourse()));
    const task = {
      id: 'task-id',
      courseId: 'course-id',
      courseRunId: 'course-run-id',
      title: 'Grundlagen',
    } as Task;
    const { service } = createService({
      enrollments: [enrollment],
      materials: [
        createMaterial({
          releaseMode: LearningMaterialReleaseMode.AFTER_TASK_COMPLETION,
          releaseAfterTaskId: task.id,
        }),
      ],
      tasks: [task],
    });

    await expect(service.getLearningMaterialsByCourse('course-id', '2')).resolves.toEqual([
      expect.objectContaining({
        id: 'material-id',
        locked: true,
        lockedReason: expect.stringContaining('Grundlagen'),
        url: undefined,
        visibleForStudents: false,
      }),
    ]);
    await expect(service.downloadLearningMaterial('material-id', '2')).rejects.toMatchObject({
      code: 'MATERIAL_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('unlocks task-gated material after successful task completion', async () => {
    const enrollment = createEnrollment('2', CourseMemberRole.STUDENT, createCourseRun(createCourse()));
    const task = {
      id: 'task-id',
      courseId: 'course-id',
      courseRunId: 'course-run-id',
      title: 'Grundlagen',
    } as Task;
    const { service } = createService({
      enrollments: [enrollment],
      materials: [
        createMaterial({
          releaseMode: LearningMaterialReleaseMode.AFTER_TASK_COMPLETION,
          releaseAfterTaskId: task.id,
        }),
      ],
      progress: [
        {
          enrollmentId: enrollment.id,
          taskId: task.id,
          status: TaskProgressStatus.COMPLETED,
          resultPassed: true,
        } as TaskProgress,
      ],
      tasks: [task],
    });

    await expect(service.getLearningMaterialsByCourse('course-id', '2')).resolves.toEqual([
      expect.objectContaining({
        locked: false,
        visibleForStudents: true,
      }),
    ]);
  });

  it('rejects release tasks from another course run', async () => {
    const { service } = createService({
      enrollments: [createEnrollment('1', CourseMemberRole.TEACHER)],
      tasks: [
        {
          id: 'foreign-task',
          courseId: 'course-id',
          courseRunId: 'other-run',
          title: 'Other run task',
        } as Task,
      ],
    });

    await expect(
      service.createExternalLearningMaterial(
        'course-id',
        {
          releaseAfterTaskId: 'foreign-task',
          releaseMode: LearningMaterialReleaseMode.AFTER_TASK_COMPLETION,
          title: 'Locked link',
          url: 'https://example.com/locked',
        },
        '1',
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('blocks students from unpublished files', async () => {
    const { service } = createService({
      enrollments: [createEnrollment('2', CourseMemberRole.STUDENT)],
      materials: [
        createMaterial({
          isPublished: false,
          publicationStatus: LearningMaterialPublicationStatus.DRAFT,
        }),
      ],
    });

    await expect(service.downloadLearningMaterial('material-id', '2')).rejects.toMatchObject({
      code: 'MATERIAL_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('validates external links', async () => {
    const { service } = createService({
      enrollments: [createEnrollment('1', CourseMemberRole.TEACHER)],
    });

    await expect(
      service.createExternalLearningMaterial(
        'course-id',
        {
          title: 'Bad link',
          url: 'javascript:alert(1)',
        },
        '1',
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('rejects disallowed file types and oversized uploads', async () => {
    const { service } = createService({
      enrollments: [createEnrollment('1', CourseMemberRole.TEACHER)],
    });

    await expect(
      service.createLearningMaterialFile(
        'course-id',
        { title: 'Executable' },
        {
          buffer: Buffer.from('exe'),
          mimetype: 'application/x-msdownload',
          originalname: 'tool.exe',
          size: 3,
        },
        '1',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    await expect(
      service.createLearningMaterialFile(
        'course-id',
        { title: 'Huge file' },
        {
          buffer: Buffer.from('pdf'),
          mimetype: 'application/pdf',
          originalname: 'huge.pdf',
          size: 50 * 1024 * 1024 + 1,
        },
        '1',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('sanitizes file names to prevent path traversal', () => {
    const storage = new LocalMaterialStorage();

    expect(storage.sanitizeFileName('../secret/../slides.pdf')).toBe('slides.pdf');
  });

  it('blocks non-enrolled users from course materials', async () => {
    const { service } = createService({
      enrollments: [],
      materials: [createMaterial()],
    });

    await expect(service.getLearningMaterialsByCourse('course-id', '99')).rejects.toMatchObject({
      code: 'COURSE_ACCESS_DENIED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });
});
