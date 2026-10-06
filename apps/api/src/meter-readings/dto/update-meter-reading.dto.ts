import { IsDateString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { ReadingSource } from '@prisma/client';

export class UpdateMeterReadingDto {
  @IsOptional() @IsNumber() @Min(0)
  reading?: number;
  @IsOptional() @IsDateString()
  readingAt?: string;
  @IsOptional() @IsEnum(ReadingSource)
  source?: ReadingSource;
}
