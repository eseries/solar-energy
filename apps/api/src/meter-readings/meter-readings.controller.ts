import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { ListMeterReadingsDto } from './dto/list-meter-readings.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';
import { MeterReadingsService } from './meter-readings.service';

@Controller('meter-readings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class MeterReadingsController {
  constructor(private readonly service: MeterReadingsService) {}
  @Post() create(@Body() dto: CreateMeterReadingDto, @Req() request: AuthenticatedRequest) { return this.service.create(dto, request.user); }
  @Get() findAll(@Query() query: ListMeterReadingsDto) { return this.service.findAll(query); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMeterReadingDto) { return this.service.update(id, dto); }
  @Delete(':id') @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
