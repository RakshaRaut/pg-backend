import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ThingsBoardService } from './thingsboard.service.js';

@Controller('thingsboard')
@UseGuards(JwtAuthGuard)
export class ThingsBoardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly thingsBoard: ThingsBoardService,
  ) {}

  @Get('telemetry/:deviceId')
  async getTelemetry(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Request() request: { user: { userId: number } },
  ) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId: request.user.userId },
      select: { id: true, thingsboardId: true },
    });
    if (!device) throw new NotFoundException('Device not found');

    if (!device.thingsboardId) {
      return {
        deviceId: device.id,
        telemetry: {
          temperature: null,
          humidity: null,
          battery: null,
        },
        timestamp: null,
        available: false,
      };
    }

    const latest = await this.thingsBoard.getLatestTelemetry(
      device.thingsboardId,
    );
    return {
      deviceId: device.id,
      thingsboardDeviceId: device.thingsboardId,
      telemetry: {
        temperature: latest.temperature,
        humidity: latest.humidity,
        battery: latest.battery,
      },
      timestamp: latest.timestamp,
      available: latest.timestamp !== null,
    };
  }
}
