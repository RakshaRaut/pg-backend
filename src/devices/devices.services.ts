import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { UpdateDeviceDto } from './dto/update-devices.dto.js';

@Injectable()
export class DevicesService {
  private devices = [
    {
      id: 1,
      name: 'Living Room Sensor',
      deviceKey: 'living-room-sensor',
      type: 'sensor',
      location: 'Living Room',
      status: 'online',
      userId: 1,
    },
  ];

  findAll() {
    return this.devices;
  }

  create(createDeviceDto: CreateDeviceDto) {
    const device = {
      id: this.devices.length + 1,
      name: createDeviceDto.name,
      deviceKey: createDeviceDto.deviceKey,
      type: createDeviceDto.type,
      location: createDeviceDto.location ?? '',
      status: createDeviceDto.status ?? 'offline',
      userId: createDeviceDto.userId,
    };

    this.devices.push(device);

    return device;
  }

  findOne(id: number) {
    const device = this.devices.find((device) => device.id === id);

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return device;
  }

  update(id: number, updateDeviceDto: UpdateDeviceDto) {
    const device = this.findOne(id);

    Object.assign(device, updateDeviceDto);

    return device;
  }

  remove(id: number) {
    const index = this.devices.findIndex((device) => device.id === id);

    if (index === -1) {
      throw new NotFoundException('Device not found');
    }

    const [deletedDevice] = this.devices.splice(index, 1);

    return deletedDevice;
  }
}