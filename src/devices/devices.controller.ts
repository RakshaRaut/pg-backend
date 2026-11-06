import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DevicesService } from './devices.services.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { UpdateDeviceDto } from './dto/update-devices.dto.js';
import { TelemetryDto } from './dto/telemetry.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards.js';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  findAll(@Request() request: { user: { userId: number } }) {
    return this.devicesService.findAll(request.user.userId);
  }

  @Get('telemetry')
  getTelemetry(@Request() request: { user: { userId: number } }) {
    return this.devicesService.getTelemetry(request.user.userId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: { user: { userId: number } },
  ) {
    return this.devicesService.findOne(id, request.user.userId);
  }

  @Post()
  createDevice(
    @Body() createDeviceDto: CreateDeviceDto,
    @Request() request: { user: { userId: number } },
  ) {
    return this.devicesService.create(createDeviceDto, request.user.userId);
  }

  @Post(':id/telemetry')
  sendTelemetry(
    @Param('id', ParseIntPipe) id: number,
    @Body() telemetryDto: TelemetryDto,
    @Request() request: { user: { userId: number } },
  ) {
    return this.devicesService.sendTelemetry(
      id,
      telemetryDto,
      request.user.userId,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDeviceDto: UpdateDeviceDto,
    @Request() request: { user: { userId: number } },
  ) {
    return this.devicesService.update(id, updateDeviceDto, request.user.userId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: { user: { userId: number } },
  ) {
    return this.devicesService.remove(id, request.user.userId);
  }
}
