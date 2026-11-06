import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.services.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ThingsBoardService } from './thingsboard.service.js';
import { ThingsBoardController } from './thingsboard.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [DevicesController, ThingsBoardController],
  providers: [DevicesService, ThingsBoardService],
})
export class DevicesModule {}