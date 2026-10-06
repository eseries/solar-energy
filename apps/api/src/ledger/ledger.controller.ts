import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LedgerService } from './ledger.service';
import { ListLedgerEntriesDto } from './dto/list-ledger-entries.dto';

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class LedgerController {
  constructor(private readonly service: LedgerService) {}
  @Get(':customerId') findByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string, @Query() query: ListLedgerEntriesDto) { return this.service.findByCustomer(customerId, query); }
}
