import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { HealthController } from '../src/health.controller';

describe('Application smoke test', () => {
  let app: INestApplication;
  const dataSource = {
    query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('initializes the application and checks database connectivity', async () => {
    const health = app.get(HealthController);

    await expect(health.getHealth()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
    expect(dataSource.query).toHaveBeenCalledWith('select 1');
  });
});
