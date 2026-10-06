import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTariffDto {
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;
  @IsNumber() @Min(0.000001)
  pricePerKwh!: number;
  @IsDateString()
  effectiveFrom!: string;
  @IsOptional() @IsDateString()
  effectiveTo?: string;
}
