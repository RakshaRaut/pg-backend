import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  const prisma = {
    $queryRaw: vi.fn(),
  };

  beforeEach(async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('reports application and database health', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      dependencies: {
        database: 'ok',
      },
    });
  });

  it('returns service unavailable when the database check fails', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(controller.check()).rejects.toMatchObject({
      status: 503,
      response: {
        status: 'error',
        dependencies: {
          database: 'unavailable',
        },
      },
    });
  });
});
