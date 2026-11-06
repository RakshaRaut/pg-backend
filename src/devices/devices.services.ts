import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { UpdateDeviceDto } from './dto/update-devices.dto.js';
import { TelemetryDto } from './dto/telemetry.dto.js';
import { ThingsBoardService } from './thingsboard.service.js';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly thingsBoard: ThingsBoardService,
  ) {}

  findAll(userId: number) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTelemetry(userId: number) {
    const devices = await this.findAll(userId);
    const data = await Promise.all(
      devices.map(async (device) => {
        if (!device.thingsboardId) {
          return {
            deviceId: device.id,
            deviceKey: device.deviceKey,
            status: device.status,
            updatedAt: device.createdAt,
            readings: null,
            error: 'ThingsBoard device is not linked',
          };
        }

        try {
          const readings = await this.thingsBoard.getTelemetry(
            device.thingsboardId,
          );
          const points = Object.values(readings).flat();
          const hasReadings = points.length > 0;
          const updatedAt = Math.max(
            ...points.map((point) => point.ts),
            device.createdAt.getTime(),
          );
          return {
            deviceId: device.id,
            deviceKey: device.deviceKey,
            status: hasReadings ? 'online' : device.status,
            updatedAt: new Date(updatedAt),
            readings,
          };
        } catch (error) {
          return {
            deviceId: device.id,
            deviceKey: device.deviceKey,
            status: device.status,
            updatedAt: device.createdAt,
            readings: null,
            error:
              error instanceof Error ? error.message : 'Telemetry unavailable',
          };
        }
      }),
    );

    return { data, updatedAt: new Date().toISOString() };
  }

  async create(createDeviceDto: CreateDeviceDto, userId: number) {
    const thingsboardId = await this.thingsBoard.createDevice({
      name: createDeviceDto.name,
      type: createDeviceDto.type,
      label: createDeviceDto.location,
    });

    try {
      return await this.prisma.device.create({
        data: { ...createDeviceDto, thingsboardId, userId },
      });
    } catch (error) {
      await this.deleteRemoteAfterDatabaseFailure(thingsboardId);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Device key is already registered');
      }
      throw error;
    }
  }

  async findOne(id: number, userId: number) {
    const device = await this.prisma.device.findFirst({ where: { id, userId } });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async update(id: number, updateDeviceDto: UpdateDeviceDto, userId: number) {
    const device = await this.findOne(id, userId);
    if (device.thingsboardId) {
      await this.thingsBoard.updateDevice(device.thingsboardId, {
        name: updateDeviceDto.name ?? device.name,
        type: updateDeviceDto.type ?? device.type,
        label: updateDeviceDto.location ?? device.location ?? undefined,
      });
    }
    return this.prisma.device.update({
      where: { id },
      data: updateDeviceDto,
    });
  }

  async remove(id: number, userId: number) {
    const device = await this.findOne(id, userId);
    if (device.thingsboardId) {
      await this.thingsBoard.deleteDevice(device.thingsboardId);
    }
    return this.prisma.device.delete({ where: { id } });
  }

  async sendTelemetry(
    id: number,
    telemetryDto: TelemetryDto,
    userId: number,
  ) {
    const device = await this.findOne(id, userId);
    if (!device.thingsboardId) {
      throw new NotFoundException('ThingsBoard device is not linked');
    }

    const telemetry = Object.fromEntries(
      Object.entries(telemetryDto).filter(
        ([key, value]) => key !== 'timestamp' && value !== undefined,
      ),
    ) as Record<string, number | string>;
    if (Object.keys(telemetry).length === 0) {
      throw new ConflictException('At least one telemetry reading is required');
    }
    await this.thingsBoard.sendTelemetry(device.thingsboardId, telemetry);
    return { status: 'accepted', deviceId: device.id };
  }

  private async deleteRemoteAfterDatabaseFailure(thingsboardId: string) {
    try {
      await this.thingsBoard.deleteDevice(thingsboardId);
    } catch (error) {
      this.logger.error(
        `Failed to roll back ThingsBoard device ${thingsboardId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
