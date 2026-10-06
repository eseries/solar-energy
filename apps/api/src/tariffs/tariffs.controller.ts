import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTariffDto } from './dto/create-tariff.dto';
import { ListTariffsDto } from './dto/list-tariffs.dto';
import { UpdateTariffDto } from './dto/update-tariff.dto';
import { TariffsService } from './tariffs.service';

@Controller('tariffs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TariffsController {
  constructor(private readonly service: TariffsService) {}
  @Get() @Roles(UserRole.ADMIN, UserRole.STAFF)
  findAll(@Query() query: ListTariffsDto) { return this.service.findAll(query); }
  @Get(':id') @Roles(UserRole.ADMIN, UserRole.STAFF)
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }
  @Post() @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateTariffDto) { return this.service.create(dto); }
  @Patch(':id') @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTariffDto) { return this.service.update(id, dto); }
  @Delete(':id') @Roles(UserRole.ADMIN)
  deactivate(@Param('id', ParseUUIDPipe) id: string) { return this.service.deactivate(id); }
}
