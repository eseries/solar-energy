import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AccountsService } from './accounts.service';
import { ListAccountsDto } from './dto/list-accounts.dto';

@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class AccountsController {
  constructor(private readonly service: AccountsService) {}
  @Get() list(@Query() query: ListAccountsDto) { return this.service.list(query); }
  @Get(':customerId') findByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string) { return this.service.findByCustomer(customerId); }
}
