import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class TelemetryDto {
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  humidity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  battery?: number;

  @IsOptional()
  @IsString()
  timestamp?: string;
}
