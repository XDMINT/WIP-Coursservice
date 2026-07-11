import { HttpStatus } from '@nestjs/common';

import { CoursesService } from './courses.service';
import {
  LearningMaterial,
  LearningMaterialPublicationStatus,
  LearningMaterialType,
} from './entities/learning-material.entity';
import { CourseMemberRole, Enrollment } from './entities/enrollment.entity';
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
): Enrollment =>
  ({
    id: `enrollment-${userId}`,
    courseId: 'course-id',
    userId,
    role,
  }) as Enrollment;

const createMaterial = (
  overrides: Partial<LearningMaterial> = {},
): LearningMaterial =>
  ({
    id: 'material-id',
    courseId: 'course-id',
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
    isPublished: true,
    createdBy: '1',
    updatedBy: '1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as LearningMaterial;

const createService = (options: {
  enrollments?: Enrollment[];
  materials?: LearningMaterial[];
  storage?: Record<string, jest.Mock>;
}) => {
  const enrollments = options.enrollments ?? [];
  const materials = options.materials ?? [];
  const materialRepository = {
    delete: jest.fn(),
    find: jest.fn(({ where }) =>
      Promise.resolve(
        materials.filter((material) => {
          const courseMatches = !where.courseId || material.courseId === where.courseId;
          const statusMatches =
            typeof where.publicationStatus === 'string'
              ? material.publicationStatus === where.publicationStatus
              : true;

          return courseMatches && statusMatches;
        }),
      ),
    ),
    findOne: jest.fn(({ where }) =>
      Promise.resolve(materials.find((material) => material.id === where.id) ?? null),
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
    findOne: jest.fn(({ where }) =>
      Promise.resolve(
        enrollments.find(
          (entry) =>
            entry.courseId === where.courseId && entry.userId === where.userId,
        ) ?? null,
      ),
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
    emptyRepository() as any,
    materialRepository as any,
    emptyRepository() as any,
    emptyRepository() as any,
    emptyRepository() as any,
    enrollmentRepository as any,
    emptyRepository() as any,
    emptyRepository() as any,
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
