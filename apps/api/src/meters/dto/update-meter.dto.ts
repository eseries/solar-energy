import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { MeterStatus, MeterType } from '@prisma/client';

export class UpdateMeterDto {
  @IsOptional() @IsEnum(MeterType)
  meterType?: MeterType;
  @IsOptional() @IsEnum(MeterStatus)
  status?: MeterStatus;
  @IsOptional() @IsUUID()
  customerId?: string;
  @IsOptional() @IsDateString()
  installedAt?: string;
  @IsOptional() @IsDateString()
  replacedAt?: string;
}
