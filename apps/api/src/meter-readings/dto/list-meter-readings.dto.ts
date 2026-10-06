import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ReadingSource } from '@prisma/client';

export class ListMeterReadingsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
  @IsOptional() @IsUUID()
  meterId?: string;
  @IsOptional() @IsUUID()
  customerId?: string;
  @IsOptional() @IsEnum(ReadingSource)
  source?: ReadingSource;
  @IsOptional() @IsDateString()
  readingAtFrom?: string;
  @IsOptional() @IsDateString()
  readingAtTo?: string;
}
