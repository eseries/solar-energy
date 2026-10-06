import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateMeterDto } from './dto/create-meter.dto';
import { ListMetersDto } from './dto/list-meters.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
import { MetersService } from './meters.service';

@Controller('meters')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class MetersController {
  constructor(private readonly service: MetersService) {}
  @Post() create(@Body() dto: CreateMeterDto) { return this.service.create(dto); }
  @Get() findAll(@Query() query: ListMetersDto) { return this.service.findAll(query); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMeterDto) { return this.service.update(id, dto); }
  @Delete(':id') deactivate(@Param('id', ParseUUIDPipe) id: string) { return this.service.deactivate(id); }
}
