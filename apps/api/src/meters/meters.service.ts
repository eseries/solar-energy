import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerStatus, MeterStatus, PrismaClient } from '@prisma/client';
import { CreateMeterDto } from './dto/create-meter.dto';
import { ListMetersDto } from './dto/list-meters.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
import { AuditService } from '../audit/audit.service';

const meterSelect = { id: true, meterNumber: true, meterType: true, status: true, installedAt: true, replacedAt: true, customerId: true, customer: { select: { id: true, customerNumber: true, name: true, status: true } } } as const;

@Injectable()
export class MetersService {
  private readonly prisma = new PrismaClient();
  constructor(private readonly audit: AuditService) {}

  async create(dto: CreateMeterDto) {
    await this.ensureActiveCustomer(dto.customerId);
    try {
      const meter = await this.prisma.meter.create({ data: { meterNumber: dto.meterNumber.trim(), meterType: dto.meterType, customerId: dto.customerId, installedAt: new Date(dto.installedAt) }, select: meterSelect });
      await this.audit.record({ action: 'METER_CREATED', entity: 'Meter', entityId: meter.id, metadata: { customerId: dto.customerId } });
      return meter;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Meter number already exists');
      throw error;
    }
  }

  async findAll(query: ListMetersDto) {
    const where = query.customerId || query.status ? { ...(query.customerId ? { customerId: query.customerId } : {}), ...(query.status ? { status: query.status } : {}) } : undefined;
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.meter.findMany({ where, select: meterSelect, orderBy: { createdAt: 'desc' }, skip, take: query.limit }),
      this.prisma.meter.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOne(id: string) {
    const meter = await this.prisma.meter.findUnique({ where: { id }, select: meterSelect });
    if (!meter) throw new NotFoundException('Meter not found');
    return meter;
  }

  async update(id: string, dto: UpdateMeterDto) {
    const current = await this.findOne(id);
    if (dto.customerId && dto.customerId !== current.customer?.id && current.status === MeterStatus.ACTIVE) throw new ConflictException('Active meters cannot be reassigned; create a new meter or deactivate this meter first');
    if (dto.customerId) await this.ensureActiveCustomer(dto.customerId);
    if (dto.status === MeterStatus.REPLACED && !dto.replacedAt) dto.replacedAt = new Date().toISOString();
    try {
      const meter = await this.prisma.meter.update({ where: { id }, data: { ...dto, installedAt: dto.installedAt ? new Date(dto.installedAt) : undefined, replacedAt: dto.replacedAt ? new Date(dto.replacedAt) : undefined }, select: meterSelect });
      await this.audit.record({ action: 'METER_UPDATED', entity: 'Meter', entityId: id, metadata: { fields: Object.keys(dto) } });
      return meter;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Meter update conflicts with existing data');
      throw error;
    }
  }

  async deactivate(id: string) {
    await this.findOne(id);
    const meter = await this.prisma.meter.update({ where: { id }, data: { status: MeterStatus.INACTIVE }, select: meterSelect });
    await this.audit.record({ action: 'METER_DEACTIVATED', entity: 'Meter', entityId: id });
    return meter;
  }

  private async ensureActiveCustomer(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: { status: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.status !== CustomerStatus.ACTIVE) throw new BadRequestException('Meter must be assigned to an active customer');
  }

  private isUniqueError(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
}
