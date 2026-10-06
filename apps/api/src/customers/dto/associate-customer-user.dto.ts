import { IsUUID } from 'class-validator';

export class AssociateCustomerUserDto {
  @IsUUID()
  userId!: string;
}
