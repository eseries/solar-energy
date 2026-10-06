import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { PaymentsService } from './payments.service';
import { AuthenticatedRequest } from '../auth/auth.types';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CUSTOMER)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Post('initialize') initialize(@Body() dto: InitializePaymentDto, @Req() request: AuthenticatedRequest) { return this.service.initialize(dto, request.user); }
  @Get('verify/:reference') verify(@Param('reference') reference: string, @Req() request: AuthenticatedRequest) { return this.service.verify(reference, request.user); }
  @Get() @Roles(UserRole.ADMIN, UserRole.STAFF)
  findAll(@Query() query: ListPaymentsDto) { return this.service.findAll(query); }
  @Get(':id') @Roles(UserRole.ADMIN, UserRole.STAFF)
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }
}
