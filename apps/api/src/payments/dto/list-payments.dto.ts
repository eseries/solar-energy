import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class ListPaymentsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
  @IsOptional() @IsUUID()
  customerId?: string;
  @IsOptional() @IsUUID()
  billId?: string;
  @IsOptional() @IsEnum(PaymentStatus)
  status?: PaymentStatus;
  @IsOptional() @IsEnum(PaymentMethod)
  method?: PaymentMethod;
  @IsOptional() @IsString()
  search?: string;
  @IsOptional() @IsDateString()
  createdFrom?: string;
  @IsOptional() @IsDateString()
  createdTo?: string;
}
