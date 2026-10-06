import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LedgerEntryType } from '@prisma/client';

export class ListLedgerEntriesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
  @IsOptional() @IsEnum(LedgerEntryType)
  type?: LedgerEntryType;
  @IsOptional() @IsDateString()
  createdFrom?: string;
  @IsOptional() @IsDateString()
  createdTo?: string;
}
