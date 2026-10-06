import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateTariffDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;
  @IsOptional() @IsNumber() @Min(0.000001)
  pricePerKwh?: number;
  @IsOptional() @IsDateString()
  effectiveFrom?: string;
  @IsOptional() @IsDateString()
  effectiveTo?: string;
}
