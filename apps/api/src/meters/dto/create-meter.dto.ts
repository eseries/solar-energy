import { IsDateString, IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { MeterType } from '@prisma/client';

export class CreateMeterDto {
  @IsString() @MinLength(1) @MaxLength(80)
  meterNumber!: string;
  @IsEnum(MeterType)
  meterType!: MeterType;
  @IsUUID()
  customerId!: string;
  @IsDateString()
  installedAt!: string;
}
