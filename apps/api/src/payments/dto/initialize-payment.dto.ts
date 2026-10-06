import { IsUUID } from 'class-validator';

export class InitializePaymentDto {
  @IsUUID()
  billId!: string;
}
