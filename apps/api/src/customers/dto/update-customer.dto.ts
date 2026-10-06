import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BillingMode, CustomerStatus } from '@prisma/client';

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;
  @IsOptional() @IsEmail() @MaxLength(254)
  email?: string;
  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;
  @IsOptional() @IsString() @MaxLength(300)
  address?: string;
  @IsOptional() @IsEnum(BillingMode)
  billingMode?: BillingMode;
  @IsOptional() @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}
