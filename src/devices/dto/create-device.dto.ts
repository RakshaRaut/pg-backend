import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  deviceKey: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type: string;

  @IsOptional()
  @MaxLength(200)
  location?: string;
}