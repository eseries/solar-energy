import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateTariffDto } from './dto/create-tariff.dto';
import { ListTariffsDto } from './dto/list-tariffs.dto';
import { UpdateTariffDto } from './dto/update-tariff.dto';
import { AuditService } from '../audit/audit.service';

const tariffSelect = { id: true, name: true, pricePerKwh: true, effectiveFrom: true, effectiveTo: true, isActive: true, createdAt: true, updatedAt: true } as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Date-only Admin values describe a whole UTC calendar day. Timestamps retain their exact instant. */
export function parseTariffDate(value: string, endOfDay = false): Date {
  if (DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const result = new Date(Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
    if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) return new Date(NaN);
    return result;
  }
  return new Date(value);
}

@Injectable()
export class TariffsService {
  private readonly prisma = new PrismaClient();
  constructor(private readonly audit: AuditService) {}

  async create(dto: CreateTariffDto) {
    const dates = this.validDates(dto.effectiveFrom, dto.effectiveTo);
    await this.ensureNoActiveOverlap(dates.from, dates.to);
    const tariff = await this.prisma.tariff.create({ data: { name: dto.name.trim(), pricePerKwh: dto.pricePerKwh, effectiveFrom: dates.from, effectiveTo: dates.to }, select: tariffSelect });
    await this.audit.record({ action: 'TARIFF_CREATED', entity: 'Tariff', entityId: tariff.id, metadata: { pricePerKwh: tariff.pricePerKwh } });
    return tariff;
  }

  async findAll(query: ListTariffsDto) {
    const where = query.isActive === undefined ? undefined : { isActive: query.isActive };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tariff.findMany({ where, select: tariffSelect, orderBy: { effectiveFrom: 'desc' }, skip, take: query.limit }),
      this.prisma.tariff.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOne(id: string) {
    const tariff = await this.prisma.tariff.findUnique({ where: { id }, select: tariffSelect });
    if (!tariff) throw new NotFoundException('Tariff not found');
    return tariff;
  }

  async update(id: string, dto: UpdateTariffDto) {
    const current = await this.findOne(id);
    const from = dto.effectiveFrom ? parseTariffDate(dto.effectiveFrom) : current.effectiveFrom;
    const to = dto.effectiveTo === undefined ? current.effectiveTo : parseTariffDate(dto.effectiveTo, true);
    if (dto.effectiveFrom || dto.effectiveTo !== undefined) {
      const dates = this.validDates(from, to);
      if (current.isActive) await this.ensureNoActiveOverlap(dates.from, dates.to, id);
    }
    const tariff = await this.prisma.tariff.update({ where: { id }, data: { name: dto.name?.trim(), pricePerKwh: dto.pricePerKwh, effectiveFrom: dto.effectiveFrom ? from : undefined, effectiveTo: dto.effectiveTo !== undefined ? to : undefined }, select: tariffSelect });
    await this.audit.record({ action: 'TARIFF_UPDATED', entity: 'Tariff', entityId: id, metadata: { fields: Object.keys(dto) } });
    return tariff;
  }

  async deactivate(id: string) {
    await this.findOne(id);
    const tariff = await this.prisma.tariff.update({ where: { id }, data: { isActive: false }, select: tariffSelect });
    await this.audit.record({ action: 'TARIFF_DEACTIVATED', entity: 'Tariff', entityId: id });
    return tariff;
  }

  private validDates(fromValue: string | Date, toValue?: string | Date | null) {
    const from = fromValue instanceof Date ? fromValue : parseTariffDate(fromValue);
    const to = toValue ? (toValue instanceof Date ? toValue : parseTariffDate(toValue, true)) : undefined;
    if (Number.isNaN(from.getTime()) || (to && Number.isNaN(to.getTime()))) throw new BadRequestException('Invalid tariff effective date');
    if (to && to <= from) throw new BadRequestException('effectiveTo must be after effectiveFrom');
    return { from, to };
  }

  private async ensureNoActiveOverlap(from: Date, to?: Date, excludeId?: string) {
    const candidates = await this.prisma.tariff.findMany({ where: { isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true, effectiveFrom: true, effectiveTo: true } });
    const overlaps = candidates.some((item) => from < (item.effectiveTo ?? new Date(8640000000000000)) && (to ?? new Date(8640000000000000)) > item.effectiveFrom);
    if (overlaps) throw new ConflictException('Active tariff period overlaps an existing active tariff');
  }
}
