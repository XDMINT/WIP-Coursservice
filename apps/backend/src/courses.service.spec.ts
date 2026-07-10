import { HttpStatus } from '@nestjs/common';

import { CoursesService } from './courses.service';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseMemberRole, Enrollment } from './entities/enrollment.entity';

const emptyRepository = () => ({
  delete: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
});

const createCourse = (overrides: Partial<Course> = {}): Course =>
  ({
    id: 'course-id',
    external_id: 'course-external-id',
    title: 'Database Systems',
    description: 'Relational modeling',
    semester: 'Summer 2026',
    status: CourseStatus.PUBLISHED,
    location: 'Friedberg',
    owner_id: 1,
    created_at: new Date('2026-01-01T10:00:00.000Z'),
    updated_at: new Date('2026-01-02T10:00:00.000Z'),
    ...overrides,
  }) as Course;

const createEnrollment = (
  userId: string,
  role: CourseMemberRole,
): Enrollment =>
  ({
    id: `enrollment-${userId}`,
    courseId: 'course-id',
    userId,
    role,
    enrolledAt: new Date('2026-01-01T11:00:00.000Z'),
    updatedAt: new Date('2026-01-01T11:00:00.000Z'),
  }) as Enrollment;

const createService = (
  course: Course,
  enrollments: Enrollment[],
) => {
  const courseRepository = {
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn().mockResolvedValue([course]),
    findOne: jest.fn(({ where }) => {
      if (where.id !== course.id) {
        return Promise.resolve(null);
      }

      if ('owner_id' in where && where.owner_id !== course.owner_id) {
        return Promise.resolve(null);
      }

      return Promise.resolve(course);
    }),
    save: jest.fn((entity) =>
      Promise.resolve({
        ...course,
        ...entity,
        created_at: course.created_at,
        updated_at: course.updated_at,
      }),
    ),
  };
  const enrollmentRepository = {
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn(({ where }) =>
      Promise.resolve(
        enrollments.filter((entry) => entry.courseId === where.courseId),
      ),
    ),
    findOne: jest.fn(({ where }) =>
      Promise.resolve(
        enrollments.find(
          (entry) =>
            entry.courseId === where.courseId && entry.userId === where.userId,
        ) ?? null,
      ),
    ),
    save: jest.fn((entity) => Promise.resolve(entity)),
  };
  const service = new CoursesService(
    courseRepository as any,
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
    {
      deleteFile: jest.fn(),
      openFile: jest.fn(),
      saveFile: jest.fn(),
    } as any,
  );

  return {
    courseRepository,
    enrollmentRepository,
    service,
  };
};

describe('CoursesService permissions', () => {
  it('allows teachers to update protected course settings', async () => {
    const { courseRepository, service } = createService(createCourse(), [
      createEnrollment('1', CourseMemberRole.TEACHER),
    ]);

    await expect(
      service.updateCourse('course-id', { title: 'Advanced Databases' }, '1'),
    ).resolves.toMatchObject({
      id: 'course-id',
      title: 'Advanced Databases',
    });
    expect(courseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Advanced Databases',
        updated_by: '1',
      }),
    );
  });

  it('rejects students for protected course administration', async () => {
    const { service } = createService(createCourse(), [
      createEnrollment('2', CourseMemberRole.STUDENT),
    ]);

    await expect(
      service.updateCourse('course-id', { title: 'Nope' }, '2'),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.FORBIDDEN,
      code: 'COURSE_ACCESS_DENIED',
    });
  });

  it('rejects non-enrolled users for internal course context', async () => {
    const { service } = createService(createCourse(), []);

    await expect(service.getCourseContext('course-id', '99')).rejects.toMatchObject({
      statusCode: HttpStatus.FORBIDDEN,
      code: 'COURSE_ACCESS_DENIED',
    });
  });

  it('returns member DTOs only to teaching roles', async () => {
    const { service } = createService(createCourse(), [
      createEnrollment('1', CourseMemberRole.TEACHER),
      createEnrollment('2', CourseMemberRole.STUDENT),
    ]);

    await expect(service.getCourseMembers('course-id', '1')).resolves.toEqual([
      expect.objectContaining({
        role: CourseMemberRole.TEACHER,
        userId: '1',
      }),
      expect.objectContaining({
        role: CourseMemberRole.STUDENT,
        userId: '2',
      }),
    ]);
  });
});
