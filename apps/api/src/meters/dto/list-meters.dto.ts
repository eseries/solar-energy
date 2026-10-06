import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MeterStatus } from '@prisma/client';

export class ListMetersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
  @IsOptional() @IsUUID()
  customerId?: string;
  @IsOptional() @IsEnum(MeterStatus)
  status?: MeterStatus;
}
