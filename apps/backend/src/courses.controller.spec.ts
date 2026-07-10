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
    findAll: jest.fn(),
    findOne: jest.fn(),
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

  it('delegates joining a course to the service', async () => {
    service.joinCourse.mockResolvedValue({ id: 'enrollment-id' });

    await expect(
      controller.joinCourse('course-id', { userId: 42, key: 'secret' }),
    ).resolves.toEqual({ id: 'enrollment-id' });
    expect(service.joinCourse).toHaveBeenCalledWith('course-id', 42, 'secret');
  });
});
