import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus, NotificationType, PrismaClient, UserRole } from '@prisma/client';
import { ListNotificationsDto } from './dto/list-notifications.dto';

const adminNotificationSelect = { id: true, customerId: true, userId: true, type: true, title: true, message: true, status: true, createdAt: true, sentAt: true, customer: { select: { id: true, customerNumber: true, name: true, email: true } }, user: { select: { id: true, name: true, email: true, role: true } } } as const;

@Injectable()
export class NotificationsService {
  private readonly prisma = new PrismaClient();
  async create(input: { customerId?: string; userId?: string; type: NotificationType; title: string; message: string }) {
    return this.prisma.notification.create({ data: input });
  }
  async list(userId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { userId }, select: { id: true } });
    return this.prisma.notification.findMany({ where: { OR: [{ userId }, ...(customer ? [{ customerId: customer.id }] : [])] }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  async markRead(id: string, userId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { userId }, select: { id: true } });
    const notification = await this.prisma.notification.findFirst({ where: { id, OR: [{ userId }, ...(customer ? [{ customerId: customer.id }] : [])] } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { status: NotificationStatus.READ } });
  }

  async listAdmin(query: ListNotificationsDto, role: UserRole) {
    if (role !== UserRole.ADMIN && role !== UserRole.STAFF) throw new NotFoundException('Notification not found');
    const search = query.search?.trim();
    const where = { ...(query.type ? { type: query.type } : {}), ...(query.status ? { status: query.status } : {}), ...(query.customerId ? { customerId: query.customerId } : {}), ...(search ? { OR: [{ title: { contains: search } }, { message: { contains: search } }, { customer: { OR: [{ name: { contains: search } }, { customerNumber: { contains: search } }] } }] } : {}), ...(query.createdFrom || query.createdTo ? { createdAt: { ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}), ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}) } } : {}) };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([this.prisma.notification.findMany({ where, select: adminNotificationSelect, orderBy: { createdAt: 'desc' }, skip, take: query.limit }), this.prisma.notification.count({ where })]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async findAdmin(id: string, role: UserRole) {
    if (role !== UserRole.ADMIN && role !== UserRole.STAFF) throw new NotFoundException('Notification not found');
    const notification = await this.prisma.notification.findUnique({ where: { id }, select: adminNotificationSelect });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }
}
