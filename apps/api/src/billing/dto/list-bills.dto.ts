import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { BillStatus } from '@prisma/client';

export class ListBillsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
  @IsOptional() @IsUUID()
  customerId?: string;
  @IsOptional() @IsUUID()
  meterId?: string;
  @IsOptional() @IsEnum(BillStatus)
  status?: BillStatus;
  @IsOptional() @IsDateString()
  periodStartFrom?: string;
  @IsOptional() @IsDateString()
  periodStartTo?: string;
}
