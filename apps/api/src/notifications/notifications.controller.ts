import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() list(@Req() req: AuthenticatedRequest) { return this.service.list(req.user.userId); }
  @Get('admin') @Roles(UserRole.ADMIN, UserRole.STAFF)
  listAdmin(@Query() query: ListNotificationsDto, @Req() req: AuthenticatedRequest) { return this.service.listAdmin(query, req.user.role); }
  @Get('admin/:id') @Roles(UserRole.ADMIN, UserRole.STAFF)
  findAdmin(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) { return this.service.findAdmin(id, req.user.role); }
  @Patch(':id/read') read(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) { return this.service.markRead(id, req.user.userId); }
}
