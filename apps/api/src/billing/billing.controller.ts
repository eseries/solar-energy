import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BillingService } from './billing.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { ListBillsDto } from './dto/list-bills.dto';

@Controller('bills')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class BillingController {
  constructor(private readonly service: BillingService) {}
  @Post() create(@Body() dto: CreateBillDto) { return this.service.create(dto); }
  @Get() findAll(@Query() query: ListBillsDto) { return this.service.findAll(query); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }
}
