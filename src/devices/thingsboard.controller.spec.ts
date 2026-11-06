import { NotFoundException } from '@nestjs/common';
import { ThingsBoardController } from './thingsboard.controller.js';

describe('ThingsBoardController', () => {
  it('only reads telemetry for a device owned by the authenticated user', async () => {
    const prisma = {
      device: {
        findFirst: vi.fn().mockResolvedValue({
          id: 4,
          thingsboardId: 'tb-device-4',
        }),
      },
    };
    const thingsBoard = {
      getLatestTelemetry: vi.fn().mockResolvedValue({
        temperature: 28,
        humidity: 65,
        battery: 90,
        timestamp: '2026-11-04T10:00:00.000Z',
      }),
    };
    const controller = new ThingsBoardController(
      prisma as never,
      thingsBoard as never,
    );

    await expect(
      controller.getTelemetry(4, { user: { userId: 9 } }),
    ).resolves.toEqual({
      deviceId: 4,
      thingsboardDeviceId: 'tb-device-4',
      telemetry: { temperature: 28, humidity: 65, battery: 90 },
      timestamp: '2026-11-04T10:00:00.000Z',
      available: true,
    });
    expect(prisma.device.findFirst).toHaveBeenCalledWith({
      where: { id: 4, userId: 9 },
      select: { id: true, thingsboardId: true },
    });
  });

  it('returns missing telemetry without exposing ThingsBoard details', async () => {
    const prisma = {
      device: {
        findFirst: vi.fn().mockResolvedValue({ id: 4, thingsboardId: null }),
      },
    };
    const thingsBoard = { getLatestTelemetry: vi.fn() };
    const controller = new ThingsBoardController(
      prisma as never,
      thingsBoard as never,
    );

    await expect(
      controller.getTelemetry(4, { user: { userId: 9 } }),
    ).resolves.toEqual({
      deviceId: 4,
      telemetry: { temperature: null, humidity: null, battery: null },
      timestamp: null,
      available: false,
    });
    expect(thingsBoard.getLatestTelemetry).not.toHaveBeenCalled();
  });

  it('rejects devices outside the authenticated user account', async () => {
    const prisma = { device: { findFirst: vi.fn().mockResolvedValue(null) } };
    const controller = new ThingsBoardController(
      prisma as never,
      {} as never,
    );

    await expect(
      controller.getTelemetry(4, { user: { userId: 9 } }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
