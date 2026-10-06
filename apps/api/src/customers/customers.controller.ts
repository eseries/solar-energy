import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Body, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';
import { AssociateCustomerUserDto } from './dto/associate-customer-user.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}
  @Post() create(@Body() dto: CreateCustomerDto) { return this.service.create(dto); }
  @Get() findAll(@Query() query: ListCustomersDto) { return this.service.findAll(query); }
  @Get(':id/onboarding') onboarding(@Param('id', ParseUUIDPipe) id: string) { return this.service.getOnboarding(id); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) { return this.service.update(id, dto); }
  @Delete(':id') deactivate(@Param('id', ParseUUIDPipe) id: string) { return this.service.deactivate(id); }
  @Post(':id/user') @Roles(UserRole.ADMIN) associateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssociateCustomerUserDto) { return this.service.associateUser(id, dto.userId); }
}
