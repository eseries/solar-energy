import { IsDateString, IsEnum, IsNumber, IsUUID, Min } from 'class-validator';
import { ReadingSource } from '@prisma/client';

export class CreateMeterReadingDto {
  @IsUUID()
  meterId!: string;
  @IsNumber() @Min(0)
  reading!: number;
  @IsDateString()
  readingAt!: string;
  @IsEnum(ReadingSource)
  source!: ReadingSource;
}
