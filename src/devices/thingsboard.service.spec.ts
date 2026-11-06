import { BadRequestException } from '@nestjs/common';
import { ThingsBoardService } from './thingsboard.service.js';

describe('ThingsBoardService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TB_BASE_URL;
    delete process.env.THINGSBOARD_URL;
    delete process.env.TB_USERNAME;
    delete process.env.TB_PASSWORD;
  });

  it('returns the latest values and timestamp for each requested key', async () => {
    const service = new ThingsBoardService();
    vi.spyOn(service, 'getTelemetry').mockResolvedValue({
      temperature: [
        { ts: 1000, value: '27' },
        { ts: 2000, value: '28' },
      ],
      humidity: [{ ts: 1500, value: 65 }],
      battery: [{ ts: 1200, value: 90 }],
    });

    await expect(service.getLatestTelemetry('tb-device')).resolves.toEqual({
      temperature: 28,
      humidity: 65,
      battery: 90,
      timestamp: '1970-01-01T00:00:02.000Z',
    });
  });

  it('returns null values when ThingsBoard has no telemetry', async () => {
    const service = new ThingsBoardService();
    vi.spyOn(service, 'getTelemetry').mockResolvedValue({});

    await expect(service.getLatestTelemetry('tb-device')).resolves.toEqual({
      temperature: null,
      humidity: null,
      battery: null,
      timestamp: null,
    });
  });

  it('surfaces the ThingsBoard validation message for a rejected device', async () => {
    process.env.TB_BASE_URL = 'http://thingsboard.test';
    process.env.TB_JWT_TOKEN = 'configured-token';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 400,
          message: 'Device with such name already exists!',
          errorCode: 31,
        }),
        { status: 400 },
      ),
    );
    const service = new ThingsBoardService();

    await expect(
      service.createDevice({
        name: 'Duplicate',
        type: 'Environmental',
        label: 'Warehouse A',
      }),
    ).rejects.toEqual(
      new BadRequestException(
        'ThingsBoard rejected the device request: Device with such name already exists!',
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://thingsboard.test/api/device',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
