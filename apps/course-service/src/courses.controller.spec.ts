import { Test, TestingModule } from '@nestjs/testing';

import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

describe('CoursesController', () => {
  let controller: CoursesController;
  const request = {
    body: {},
    headers: {},
    query: {},
  } as any;
  const service = {
    activateCourseRun: jest.fn(),
    activateCourseVersion: jest.fn(),
    createCourseRun: jest.fn(),
    createSpecialCourseRun: jest.fn(),
    createCourseVersion: jest.fn(),
    enrollInCourse: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getAvailableCourses: jest.fn(),
    getCourseMembersByRun: jest.fn(),
    getCourseVersion: jest.fn(),
    getCurrentCourseRun: jest.fn(),
    getEnrolledCourses: jest.fn(),
    getLearningMaterialsByCourseRun: jest.fn(),
    listTaskAssessmentsByRun: jest.fn(),
    getLearningTaskProgressOverviewByRun: jest.fn(),
    getCourseRun: jest.fn(),
    getCourseRunPlan: jest.fn(),
    getTasksByCourseRun: jest.fn(),
    listAuditEvents: jest.fn(),
    listCourseVersions: jest.fn(),
    listCourseRuns: jest.fn(),
    updateCourseRunPlanTemplate: jest.fn(),
    createCourse: jest.fn(),
    joinCourse: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        {
          provide: CoursesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get(CoursesController);
  });

  it('delegates course listing to the service', async () => {
    service.findAll.mockResolvedValue([{ id: 'course-id' }]);

    await expect(controller.getCourses('42')).resolves.toEqual([
      { id: 'course-id' },
    ]);
    expect(service.findAll).toHaveBeenCalledWith('42');
  });

  it('delegates course lookup to the service', async () => {
    service.findOne.mockResolvedValue({ id: 'course-id' });

    await expect(controller.getCourse('course-id')).resolves.toEqual({
      id: 'course-id',
    });
    expect(service.findOne).toHaveBeenCalledWith('course-id');
  });

  it('delegates course creation to the service', async () => {
    const body = { title: 'Databases', ownerId: 42 };
    service.createCourse.mockResolvedValue({ id: 'course-id', ...body });

    await expect(controller.createCourse(body, request)).resolves.toEqual({
      id: 'course-id',
      ...body,
    });
    expect(service.createCourse).toHaveBeenCalledWith(body, undefined);
  });

  it('delegates actor-aware course catalogs to the service', async () => {
    const actorRequest = {
      ...request,
      headers: {
        'x-user-id': '3',
      },
    };
    service.getEnrolledCourses.mockResolvedValue([{ id: 'enrolled-course' }]);
    service.getAvailableCourses.mockResolvedValue([{ id: 'available-course' }]);

    await expect(controller.getEnrolledCourses(actorRequest as any)).resolves.toEqual([
      { id: 'enrolled-course' },
    ]);
    await expect(controller.getAvailableCourses(actorRequest as any)).resolves.toEqual([
      { id: 'available-course' },
    ]);
    expect(service.getEnrolledCourses).toHaveBeenCalledWith('3');
    expect(service.getAvailableCourses).toHaveBeenCalledWith('3');
  });

  it('delegates joining a course to the service', async () => {
    service.joinCourse.mockResolvedValue({ id: 'enrollment-id' });

    await expect(
      controller.joinCourse('course-id', { userId: 42, key: 'secret' }),
    ).resolves.toEqual({ id: 'enrollment-id' });
    expect(service.joinCourse).toHaveBeenCalledWith('course-id', 42, 'secret');
  });

  it('delegates actor-aware enrollment to the service', async () => {
    const actorRequest = {
      ...request,
      headers: {
        'x-user-id': '3',
      },
    };
    service.enrollInCourse.mockResolvedValue({ id: 'enrollment-id' });

    await expect(
      controller.enrollCourse('course-id', { key: 'secret' }, actorRequest as any),
    ).resolves.toEqual({ id: 'enrollment-id' });
    expect(service.enrollInCourse).toHaveBeenCalledWith('course-id', '3', 'secret');
  });

  it('delegates course version routes to the service with the current actor', async () => {
    const actorRequest = {
      ...request,
      headers: {
        'x-user-id': '1',
      },
    };
    service.listCourseVersions.mockResolvedValue([{ id: 'version-2' }]);
    service.getCourseVersion.mockResolvedValue({ id: 'version-2' });
    service.createCourseVersion.mockResolvedValue({ id: 'version-3' });
    service.activateCourseVersion.mockResolvedValue({ id: 'version-1' });

    await expect(controller.listCourseVersions('course-id', actorRequest as any)).resolves.toEqual([
      { id: 'version-2' },
    ]);
    await expect(
      controller.getCourseVersion('course-id', 'version-2', actorRequest as any),
    ).resolves.toEqual({ id: 'version-2' });
    await expect(
      controller.createCourseVersion(
        'course-id',
        { changeSummary: 'Neu' },
        actorRequest as any,
      ),
    ).resolves.toEqual({ id: 'version-3' });
    await expect(
      controller.activateCourseVersion('course-id', 'version-1', actorRequest as any),
    ).resolves.toEqual({ id: 'version-1' });

    expect(service.listCourseVersions).toHaveBeenCalledWith('course-id', '1');
    expect(service.getCourseVersion).toHaveBeenCalledWith('course-id', 'version-2', '1');
    expect(service.createCourseVersion).toHaveBeenCalledWith(
      'course-id',
      { changeSummary: 'Neu' },
      '1',
    );
    expect(service.activateCourseVersion).toHaveBeenCalledWith(
      'course-id',
      'version-1',
      '1',
    );
  });

  it('delegates course run routes to the service with the current actor', async () => {
    const actorRequest = {
      ...request,
      headers: {
        'x-user-id': '1',
      },
    };
    service.listCourseRuns.mockResolvedValue([{ id: 'run-2' }]);
    service.getCurrentCourseRun.mockResolvedValue({ id: 'run-2' });
    service.getCourseRun.mockResolvedValue({ id: 'run-1' });
    service.getLearningMaterialsByCourseRun.mockResolvedValue([{ id: 'material-1' }]);
    service.getTasksByCourseRun.mockResolvedValue([{ id: 'task-1' }]);
    service.getCourseMembersByRun.mockResolvedValue([{ id: 'enrollment-1' }]);
    service.getLearningTaskProgressOverviewByRun.mockResolvedValue([{ studentId: '3' }]);
    service.listTaskAssessmentsByRun.mockResolvedValue([]);
    service.listAuditEvents.mockResolvedValue([{ id: 'audit-1' }]);
    service.getCourseRunPlan.mockResolvedValue({ recurrenceType: 'SEMESTER' });
    service.updateCourseRunPlanTemplate.mockResolvedValue({ templateStrategy: 'SPECIFIC_VERSION' });
    service.createCourseRun.mockResolvedValue({ id: 'run-3' });
    service.createSpecialCourseRun.mockResolvedValue({ id: 'run-special' });
    service.activateCourseRun.mockResolvedValue({ id: 'run-3', isActive: true });

    await expect(controller.listCourseRuns('course-id', actorRequest as any)).resolves.toEqual([
      { id: 'run-2' },
    ]);
    await expect(controller.getCurrentCourseRun('course-id', actorRequest as any)).resolves.toEqual({
      id: 'run-2',
    });
    await expect(
      controller.getCourseRun('course-id', 'run-1', actorRequest as any),
    ).resolves.toEqual({ id: 'run-1' });
    await expect(
      controller.getLearningMaterialsByCourseRun('course-id', 'run-1', actorRequest as any),
    ).resolves.toEqual([{ id: 'material-1' }]);
    await expect(
      controller.getTasksByCourseRun('course-id', 'run-1', actorRequest as any),
    ).resolves.toEqual([{ id: 'task-1' }]);
    await expect(
      controller.getCourseMembersByRun('course-id', 'run-1', actorRequest as any),
    ).resolves.toEqual([{ id: 'enrollment-1' }]);
    await expect(
      controller.getLearningTaskProgressOverviewByRun('course-id', 'run-1', actorRequest as any),
    ).resolves.toEqual([{ studentId: '3' }]);
    await expect(
      controller.getTaskAssessmentsByRun('course-id', 'run-1', actorRequest as any),
    ).resolves.toEqual([]);
    await expect(
      controller.listAuditEvents('course-id', { limit: 10 }, actorRequest as any),
    ).resolves.toEqual([{ id: 'audit-1' }]);
    await expect(
      controller.listAuditEventsByRun(
        'course-id',
        'run-1',
        { eventType: 'TASK_CREATED' },
        actorRequest as any,
      ),
    ).resolves.toEqual([{ id: 'audit-1' }]);
    await expect(
      controller.getCourseRunPlan('course-id', actorRequest as any),
    ).resolves.toEqual({ recurrenceType: 'SEMESTER' });
    await expect(
      controller.updateCourseRunPlanTemplate(
        'course-id',
        { strategy: 'SPECIFIC_VERSION', sourceVersionId: 'version-2' } as any,
        actorRequest as any,
      ),
    ).resolves.toEqual({ templateStrategy: 'SPECIFIC_VERSION' });
    await expect(
      controller.createNextCourseRun(
        'course-id',
        { status: 'PUBLISHED' } as any,
        actorRequest as any,
      ),
    ).resolves.toEqual({ id: 'run-3' });
    await expect(
      controller.createSpecialCourseRun(
        'course-id',
        { label: 'Sonderdurchlauf' },
        actorRequest as any,
      ),
    ).resolves.toEqual({ id: 'run-special' });
    await expect(
      controller.activateCourseRun('course-id', 'run-3', actorRequest as any),
    ).resolves.toEqual({ id: 'run-3', isActive: true });

    expect(service.listCourseRuns).toHaveBeenCalledWith('course-id', '1');
    expect(service.getCurrentCourseRun).toHaveBeenCalledWith('course-id', '1');
    expect(service.getCourseRun).toHaveBeenCalledWith('course-id', 'run-1', '1');
    expect(service.getLearningMaterialsByCourseRun).toHaveBeenCalledWith('course-id', 'run-1', '1');
    expect(service.getTasksByCourseRun).toHaveBeenCalledWith('course-id', 'run-1', '1');
    expect(service.getCourseMembersByRun).toHaveBeenCalledWith('course-id', 'run-1', '1');
    expect(service.getLearningTaskProgressOverviewByRun).toHaveBeenCalledWith('course-id', 'run-1', '1');
    expect(service.listTaskAssessmentsByRun).toHaveBeenCalledWith('course-id', 'run-1', '1');
    expect(service.listAuditEvents).toHaveBeenCalledWith('course-id', { limit: 10 }, '1');
    expect(service.listAuditEvents).toHaveBeenCalledWith(
      'course-id',
      { eventType: 'TASK_CREATED', courseRunId: 'run-1' },
      '1',
    );
    expect(service.getCourseRunPlan).toHaveBeenCalledWith('course-id', '1');
    expect(service.updateCourseRunPlanTemplate).toHaveBeenCalledWith(
      'course-id',
      { strategy: 'SPECIFIC_VERSION', sourceVersionId: 'version-2' },
      '1',
    );
    expect(service.createCourseRun).toHaveBeenCalledWith(
      'course-id',
      { status: 'PUBLISHED' },
      '1',
    );
    expect(service.createSpecialCourseRun).toHaveBeenCalledWith(
      'course-id',
      { label: 'Sonderdurchlauf' },
      '1',
    );
    expect(service.activateCourseRun).toHaveBeenCalledWith('course-id', 'run-3', '1');
  });
});
