import { DevicesService } from './devices.services.js';

describe('DevicesService', () => {
  it('creates and links a PostgreSQL device to its ThingsBoard device', async () => {
    const prisma = {
      device: {
        create: vi.fn().mockResolvedValue({
          id: 1,
          name: 'Rooftop Sensor',
          deviceKey: 'rooftop-sensor-1',
          type: 'Environmental',
          location: 'Rooftop',
          thingsboardId: 'tb-device-1',
          userId: 7,
        }),
      },
    };
    const thingsBoard = {
      createDevice: vi.fn().mockResolvedValue('tb-device-1'),
    };
    const service = new DevicesService(prisma as never, thingsBoard as never);

    const result = await service.create(
      {
        name: 'Rooftop Sensor',
        deviceKey: 'rooftop-sensor-1',
        type: 'Environmental',
        location: 'Rooftop',
      },
      7,
    );

    expect(thingsBoard.createDevice).toHaveBeenCalledWith({
      name: 'Rooftop Sensor',
      type: 'Environmental',
      label: 'Rooftop',
    });
    expect(prisma.device.create).toHaveBeenCalledWith({
      data: {
        name: 'Rooftop Sensor',
        deviceKey: 'rooftop-sensor-1',
        type: 'Environmental',
        location: 'Rooftop',
        thingsboardId: 'tb-device-1',
        userId: 7,
      },
    });
    expect(result.thingsboardId).toBe('tb-device-1');
  });
});
