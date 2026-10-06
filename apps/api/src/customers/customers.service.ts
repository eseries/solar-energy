import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerStatus, PrismaClient, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuditService } from '../audit/audit.service';

const customerSelect = { id: true, customerNumber: true, name: true, email: true, phone: true, address: true, status: true, billingMode: true, createdAt: true } as const;

@Injectable()
export class CustomersService {
  private readonly prisma = new PrismaClient();
  constructor(private readonly audit: AuditService) {}

  async create(dto: CreateCustomerDto) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const customer = await this.prisma.$transaction(async (tx) => {
          const customer = await tx.customer.create({ data: { ...dto, email: dto.email?.toLowerCase(), customerNumber: `CUS-${randomBytes(4).toString('hex').toUpperCase()}` }, select: customerSelect });
          await tx.account.create({ data: { customerId: customer.id, balance: 0 } });
          return customer;
        });
        await this.audit.record({ action: 'CUSTOMER_CREATED', entity: 'Customer', entityId: customer.id, metadata: { customerNumber: customer.customerNumber } });
        return customer;
      } catch (error) {
        if (this.isUniqueError(error) && attempt < 2) continue;
        if (this.isUniqueError(error)) throw new ConflictException('Customer number already exists');
        throw error;
      }
    }
    throw new ConflictException('Unable to generate a unique customer number');
  }

  async findAll(query: ListCustomersDto) {
    const skip = (query.page - 1) * query.limit;
    const where = query.status ? { status: query.status } : undefined;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, select: customerSelect, orderBy: { createdAt: 'desc' }, skip, take: query.limit }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: { ...customerSelect, meters: { select: { id: true, meterNumber: true, meterType: true, status: true, installedAt: true, replacedAt: true } } } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async getOnboarding(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: {
      ...customerSelect,
      user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      meters: { select: { id: true, meterNumber: true, meterType: true, status: true, installedAt: true, replacedAt: true, readings: { orderBy: { readingAt: 'desc' }, take: 1, select: { reading: true, readingAt: true } } } },
      account: { select: { id: true, balance: true } },
      bills: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, billNumber: true, amount: true, status: true, dueDate: true, createdAt: true } },
    } });
    if (!customer) throw new NotFoundException('Customer not found');
    const users = await this.prisma.user.findMany({ where: { role: UserRole.CUSTOMER, isActive: true, OR: [{ email: customer.email ?? undefined }, { customers: { none: {} } }] }, select: { id: true, name: true, email: true, role: true, isActive: true, customers: { select: { id: true } } }, orderBy: { name: 'asc' } });
    return { ...customer, availableUsers: users.filter((user) => user.customers.length === 0 || user.customers.some((item) => item.id === id)).map(({ customers: _customers, ...user }) => ({ ...user, associationStatus: customer.user?.id === user.id ? 'CURRENT' : 'AVAILABLE' })) };
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.ensureExists(id);
    try {
      const updated = await this.prisma.customer.update({ where: { id }, data: { ...dto, email: dto.email?.toLowerCase() }, select: customerSelect });
      await this.audit.record({ action: 'CUSTOMER_UPDATED', entity: 'Customer', entityId: id, metadata: { fields: Object.keys(dto) } });
      return updated;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Customer update conflicts with existing data');
      throw error;
    }
  }

  async deactivate(id: string) {
    await this.ensureExists(id);
    const updated = await this.prisma.customer.update({ where: { id }, data: { status: CustomerStatus.INACTIVE }, select: customerSelect });
    await this.audit.record({ action: 'CUSTOMER_DEACTIVATED', entity: 'Customer', entityId: id });
    return updated;
  }

  async associateUser(customerId: string, userId: string) {
    const [customer, user] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, customers: { select: { id: true } } } }),
    ]);
    if (!customer) throw new NotFoundException('Customer not found');
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.CUSTOMER) throw new ConflictException('Only CUSTOMER users can be associated with a customer');
    if (user.customers.some((item) => item.id !== customerId)) throw new ConflictException('User is already associated with another customer');
    const existing = await this.prisma.customer.findFirst({ where: { userId, id: { not: customerId } }, select: { id: true } });
    if (existing) throw new ConflictException('User is already associated with another customer');
    const updated = await this.prisma.customer.update({ where: { id: customerId }, data: { userId }, select: { ...customerSelect, userId: true } });
    await this.audit.record({ action: 'CUSTOMER_USER_ASSOCIATED', entity: 'Customer', entityId: customerId, metadata: { userId } });
    return updated;
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Customer not found');
  }

  private isUniqueError(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
}
