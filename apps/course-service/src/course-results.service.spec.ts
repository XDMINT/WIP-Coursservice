import { HttpStatus } from '@nestjs/common';

import { COURSE_PASSING_THRESHOLD_PERCENT } from './course-result.rules';
import { CoursesService } from './courses.service';
import { CourseRepositories } from './persistence/course-repositories';
import { Assignment } from './entities/assignment.entity';
import {
  CoursePassStatus,
  CourseResult,
  CourseResultMode,
  CourseResultSource,
} from './entities/course-result.entity';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseRun, CourseRunStatus } from './entities/course-run.entity';
import { CourseMemberRole, Enrollment } from './entities/enrollment.entity';
import { Grade } from './entities/grade.entity';

const createCourse = (overrides: Partial<Course> = {}): Course =>
  ({
    id: 'course-id',
    external_id: 'course-results',
    title: 'Course Results',
    status: CourseStatus.PUBLISHED,
    owner_id: 1,
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
    ...overrides,
  }) as Enrollment;

const createCourseRun = (course: Course, overrides: Partial<CourseRun> = {}): CourseRun =>
  ({
    id: course.id === 'course-id' ? 'course-run-id' : `${course.id}-run-id`,
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

const createAssignment = (
  overrides: Partial<Assignment> = {},
): Assignment =>
  ({
    id: 'assignment-1',
    title: 'Quiz',
    description: 'Quiz',
    type: 'QUIZ',
    maxPoints: 100,
    weight: 1,
    dueDate: new Date('2026-01-01T10:00:00.000Z'),
    isPublished: true,
    isGraded: true,
    createdBy: '1',
    updatedBy: '1',
    course: createCourse(),
    courseRunId: 'course-run-id',
    ...overrides,
  }) as Assignment;

const createGrade = (
  assignment: Assignment,
  enrollment: Enrollment,
  pointsAchieved: number,
  overrides: Partial<Grade> = {},
): Grade =>
  ({
    id: `grade-${assignment.id}-${enrollment.id}`,
    assignment,
    enrollment,
    pointsAchieved,
    feedback: '',
    gradedBy: '1',
    gradedAt: new Date('2026-01-02T10:00:00.000Z'),
    isFinal: true,
    updatedBy: '1',
    ...overrides,
  }) as Grade;

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
  items: T[] = [],
  prefix = 'entity',
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
    delete: jest.fn(),
    find: jest.fn(({ where, order } = {}) => {
      let result = items.filter((item) => matchesWhere(item, where));

      if (order?.userId === 'ASC') {
        result = [...result].sort((left: any, right: any) =>
          String(left.userId).localeCompare(String(right.userId), undefined, {
            numeric: true,
          }),
        );
      }

      return Promise.resolve(result);
    }),
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

const emptyRepository = () => createRepository([]);

const createFixture = (options: {
  assignments?: Assignment[];
  grades?: Grade[];
  results?: CourseResult[];
} = {}) => {
  const course = createCourse();
  const otherCourse = createCourse({
    id: 'other-course-id',
    external_id: 'other-course',
    owner_id: 8,
  });
  const currentRun = createCourseRun(course);
  const otherRun = createCourseRun(otherCourse);
  const student3 = createEnrollment('3', CourseMemberRole.STUDENT, {
    courseRun: currentRun,
  });
  const student4 = createEnrollment('4', CourseMemberRole.STUDENT, {
    courseRun: currentRun,
  });
  const enrollments = [
    createEnrollment('1', CourseMemberRole.TEACHER, {
      courseRun: currentRun,
    }),
    student3,
    student4,
    createEnrollment('8', CourseMemberRole.TEACHER, {
      courseId: 'other-course-id',
      courseRunId: otherRun.id,
      courseRun: otherRun,
      id: 'other-enrollment-8',
    }),
  ];
  const courseRepository = createRepository([course, otherCourse], 'course');
  const courseRunRepository = createRepository([currentRun, otherRun], 'run');
  const enrollmentRepository = createRepository(enrollments, 'enrollment');
  const assignmentRepository = createRepository(options.assignments ?? [], 'assignment');
  const gradeRepository = createRepository(options.grades ?? [], 'grade');
  const resultRepository = createRepository(options.results ?? [], 'result');
  const service = new CoursesService(
    new CourseRepositories({
      assignments: assignmentRepository as any,
      calendarEvents: emptyRepository() as any,
      contentReleases: emptyRepository() as any,
      contentTemplates: emptyRepository() as any,
      courseGroups: emptyRepository() as any,
      courseResults: resultRepository as any,
      courseRuns: courseRunRepository as any,
      courses: courseRepository as any,
      courseVersions: emptyRepository() as any,
      enrollments: enrollmentRepository as any,
      grades: gradeRepository as any,
      groupMemberships: emptyRepository() as any,
      learningMaterials: emptyRepository() as any,
      taskAssessments: emptyRepository() as any,
      taskProgress: emptyRepository() as any,
      tasks: emptyRepository() as any,
    }),
    {
      deleteFile: jest.fn(),
      openFile: jest.fn(),
      saveFile: jest.fn(),
    } as any,
  );

  return {
    assignmentRepository,
    gradeRepository,
    resultRepository,
    service,
    student3,
    student4,
  };
};

describe('CoursesService course results', () => {
  it('stores manual course results with points, grade, pass status and audit source', async () => {
    const { resultRepository, service } = createFixture();

    await expect(
      service.setManualCourseResult(
        'course-id',
        '3',
        {
          comment: 'Sauber bearbeitet.',
          manualGrade: '1.7',
          maxPoints: 100,
          passStatus: CoursePassStatus.PASSED,
          pointsAchieved: 82,
        },
        '1',
      ),
    ).resolves.toMatchObject({
      assessmentMode: CourseResultMode.MANUAL,
      comment: 'Sauber bearbeitet.',
      manualGrade: '1.7',
      passStatus: CoursePassStatus.PASSED,
      percentage: 82,
      source: CourseResultSource.MANUAL_ENTRY,
      studentId: '3',
    });
    expect(resultRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDetails: expect.objectContaining({
          source: CourseResultSource.MANUAL_ENTRY,
        }),
      }),
    );
  });

  it('calculates automatic results from final assignment points', async () => {
    const student = createEnrollment('3', CourseMemberRole.STUDENT);
    const assignment = createAssignment();
    const { service } = createFixture({
      assignments: [assignment],
      grades: [createGrade(assignment, student, 51)],
    });

    await expect(
      service.recalculateCourseResult('course-id', '3', '1'),
    ).resolves.toMatchObject({
      assessmentMode: CourseResultMode.AUTOMATIC,
      maxPoints: 100,
      passStatus: CoursePassStatus.PASSED,
      percentage: 51,
      pointsAchieved: 51,
      source: CourseResultSource.AUTOMATIC_CALCULATION,
      sourceDetails: expect.objectContaining({
        passThresholdPercent: COURSE_PASSING_THRESHOLD_PERCENT,
      }),
    });
  });

  it('treats exactly 50 percent as not passed', async () => {
    const student = createEnrollment('3', CourseMemberRole.STUDENT);
    const assignment = createAssignment();
    const { service } = createFixture({
      assignments: [assignment],
      grades: [createGrade(assignment, student, 50)],
    });

    await expect(
      service.recalculateCourseResult('course-id', '3', '1'),
    ).resolves.toMatchObject({
      passStatus: CoursePassStatus.FAILED,
      percentage: 50,
    });
  });

  it('does not divide by zero when no maximum points are available', async () => {
    const student = createEnrollment('3', CourseMemberRole.STUDENT);
    const assignment = createAssignment({ maxPoints: 0 });
    const { service } = createFixture({
      assignments: [assignment],
      grades: [createGrade(assignment, student, 0)],
    });

    await expect(
      service.recalculateCourseResult('course-id', '3', '1'),
    ).resolves.toMatchObject({
      maxPoints: 0,
      passStatus: CoursePassStatus.NOT_ASSESSED,
      percentage: null,
      pointsAchieved: 0,
    });
  });

  it('rejects negative manual points', async () => {
    const { service } = createFixture();

    await expect(
      service.setManualCourseResult(
        'course-id',
        '3',
        {
          maxPoints: 100,
          passStatus: CoursePassStatus.FAILED,
          pointsAchieved: -1,
        },
        '1',
      ),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_FAILED',
    });
  });

  it('rejects achieved points above max points', async () => {
    const { service } = createFixture();

    await expect(
      service.setManualCourseResult(
        'course-id',
        '3',
        {
          maxPoints: 100,
          passStatus: CoursePassStatus.PASSED,
          pointsAchieved: 101,
        },
        '1',
      ),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_FAILED',
    });
  });

  it('allows students to see only their own result', async () => {
    const existingResult = {
      id: 'result-3',
      assessmentMode: CourseResultMode.MANUAL,
      courseId: 'course-id',
      courseRunId: 'course-run-id',
      enrollmentId: 'enrollment-3',
      studentId: '3',
      passStatus: CoursePassStatus.PASSED,
      source: CourseResultSource.MANUAL_ENTRY,
    } as CourseResult;
    const { service } = createFixture({
      results: [existingResult],
    });

    await expect(service.getMyCourseResult('course-id', '3')).resolves.toMatchObject({
      id: 'result-3',
      studentId: '3',
    });
    await expect(service.getCourseResults('course-id', {}, '3')).rejects.toMatchObject({
      statusCode: HttpStatus.FORBIDDEN,
      code: 'COURSE_ACCESS_DENIED',
    });
  });

  it('rejects teachers outside the requested course', async () => {
    const { service } = createFixture();

    await expect(service.getCourseResults('course-id', {}, '8')).rejects.toMatchObject({
      statusCode: HttpStatus.FORBIDDEN,
      code: 'COURSE_ACCESS_DENIED',
    });
  });

  it('documents manual overrides of automatic results', async () => {
    const student = createEnrollment('3', CourseMemberRole.STUDENT);
    const assignment = createAssignment();
    const { service } = createFixture({
      assignments: [assignment],
      grades: [createGrade(assignment, student, 80)],
    });

    await service.recalculateCourseResult('course-id', '3', '1');

    await expect(
      service.setManualCourseResult(
        'course-id',
        '3',
        {
          comment: 'Nach Einsicht korrigiert.',
          manualGrade: '2.0',
          passStatus: CoursePassStatus.PASSED,
        },
        '1',
      ),
    ).resolves.toMatchObject({
      source: CourseResultSource.MANUAL_OVERRIDE,
      sourceDetails: expect.objectContaining({
        previousSource: CourseResultSource.AUTOMATIC_CALCULATION,
      }),
    });
  });

  it('returns filtered and paginated teacher overviews including missing results', async () => {
    const { service } = createFixture({
      results: [
        {
          id: 'result-3',
          assessmentMode: CourseResultMode.MANUAL,
          courseId: 'course-id',
          courseRunId: 'course-run-id',
          enrollmentId: 'enrollment-3',
          studentId: '3',
          passStatus: CoursePassStatus.PASSED,
          source: CourseResultSource.MANUAL_ENTRY,
        } as CourseResult,
      ],
    });

    await expect(
      service.getCourseResults(
        'course-id',
        { page: 1, pageSize: 10, passStatus: CoursePassStatus.NOT_ASSESSED },
        '1',
      ),
    ).resolves.toMatchObject({
      total: 1,
      items: [
        expect.objectContaining({
          passStatus: CoursePassStatus.NOT_ASSESSED,
          studentId: '4',
        }),
      ],
    });
  });
});
