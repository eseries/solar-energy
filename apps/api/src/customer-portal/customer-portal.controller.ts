import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CustomerPortalService } from './customer-portal.service';
import { ListLedgerEntriesDto } from '../ledger/dto/list-ledger-entries.dto';

@Controller('customer/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class CustomerPortalController {
  constructor(private readonly service: CustomerPortalService) {}
  @Get() profile(@Req() req: AuthenticatedRequest) { return this.service.profile(req.user.userId); }
  @Get('account') account(@Req() req: AuthenticatedRequest) { return this.service.account(req.user.userId); }
  @Get('bills') bills(@Req() req: AuthenticatedRequest, @Query('page') page = '1', @Query('limit') limit = '20') { return this.service.bills(req.user.userId, this.number(page), this.number(limit)); }
  @Get('bills/:id') bill(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) { return this.service.bill(req.user.userId, id); }
  @Get('payments') payments(@Req() req: AuthenticatedRequest, @Query('page') page = '1', @Query('limit') limit = '20') { return this.service.payments(req.user.userId, this.number(page), this.number(limit)); }
  @Get('payments/:id') payment(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) { return this.service.payment(req.user.userId, id); }
  @Get('ledger') ledger(@Req() req: AuthenticatedRequest, @Query() query: ListLedgerEntriesDto) { return this.service.ledger(req.user.userId, query); }
  @Get('readings') readings(@Req() req: AuthenticatedRequest, @Query('page') page = '1', @Query('limit') limit = '20') { return this.service.readings(req.user.userId, this.number(page), this.number(limit)); }
  private number(value: string) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 1; }
}
