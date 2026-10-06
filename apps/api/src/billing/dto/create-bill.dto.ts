import { IsDateString, IsUUID } from 'class-validator';

export class CreateBillDto {
  @IsUUID()
  customerId!: string;
  @IsUUID()
  meterId!: string;
  @IsDateString()
  periodStart!: string;
  @IsDateString()
  periodEnd!: string;
}
