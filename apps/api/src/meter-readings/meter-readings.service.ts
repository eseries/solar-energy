import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MeterStatus, PrismaClient, ReadingSource } from '@prisma/client';
import { AuthTokenPayload } from '../auth/auth.types';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { ListMeterReadingsDto } from './dto/list-meter-readings.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';
import { AuditService } from '../audit/audit.service';

const readingSelect = { id: true, meterId: true, reading: true, readingAt: true, source: true, recordedBy: true, createdAt: true, meter: { select: { id: true, meterNumber: true, meterType: true, status: true, customer: { select: { id: true, customerNumber: true, name: true } } } }, recorder: { select: { id: true, name: true, role: true } } } as const;

@Injectable()
export class MeterReadingsService {
  private readonly prisma = new PrismaClient();
  constructor(private readonly audit: AuditService) {}

  async create(dto: CreateMeterReadingDto, actor: AuthTokenPayload) {
    await this.ensureActiveMeter(dto.meterId);
    const readingAt = new Date(dto.readingAt);
    await this.validateSequence(dto.meterId, dto.reading, readingAt);
    try {
      const reading = await this.prisma.meterReading.create({ data: { meterId: dto.meterId, reading: dto.reading, readingAt, source: dto.source, recordedBy: dto.source === ReadingSource.MANUAL ? actor.userId : null }, select: readingSelect });
      await this.audit.record({ userId: actor.userId, action: 'METER_READING_CREATED', entity: 'MeterReading', entityId: reading.id, metadata: { meterId: dto.meterId } });
      return this.withConsumption(reading);
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('A reading already exists for this meter and timestamp');
      throw error;
    }
  }

  async findAll(query: ListMeterReadingsDto) {
    const where = { ...(query.meterId ? { meterId: query.meterId } : {}), ...(query.customerId ? { meter: { customerId: query.customerId } } : {}), ...(query.source ? { source: query.source } : {}), ...(query.readingAtFrom || query.readingAtTo ? { readingAt: { ...(query.readingAtFrom ? { gte: new Date(query.readingAtFrom) } : {}), ...(query.readingAtTo ? { lte: new Date(query.readingAtTo) } : {}) } } : {}) };
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.meterReading.findMany({ where, select: readingSelect, orderBy: { readingAt: 'asc' }, skip, take: query.limit }),
      this.prisma.meterReading.count({ where }),
    ]);
    return { data: await Promise.all(rows.map((row) => this.withConsumption(row))), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOne(id: string) {
    const row = await this.prisma.meterReading.findUnique({ where: { id }, select: readingSelect });
    if (!row) throw new NotFoundException('Meter reading not found');
    return this.withConsumption(row);
  }

  async update(id: string, dto: UpdateMeterReadingDto) {
    const current = await this.prisma.meterReading.findUnique({ where: { id }, select: { id: true, meterId: true, reading: true, readingAt: true } });
    if (!current) throw new NotFoundException('Meter reading not found');
    await this.ensureNotReferencedByBill(current.meterId, current.reading);
    const reading = dto.reading ?? current.reading;
    const readingAt = dto.readingAt ? new Date(dto.readingAt) : current.readingAt;
    await this.validateSequence(current.meterId, reading, readingAt, id);
    try {
      const updated = await this.prisma.meterReading.update({ where: { id }, data: { reading, readingAt, source: dto.source }, select: readingSelect });
      await this.audit.record({ action: 'METER_READING_CORRECTED', entity: 'MeterReading', entityId: id, metadata: { reading, readingAt } });
      return this.withConsumption(updated);
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('A reading already exists for this meter and timestamp');
      throw error;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.meterReading.findUnique({ where: { id }, select: { id: true, meterId: true, reading: true } });
    if (!existing) throw new NotFoundException('Meter reading not found');
    await this.ensureNotReferencedByBill(existing.meterId, existing.reading);
    const removed = await this.prisma.meterReading.delete({ where: { id }, select: readingSelect });
    await this.audit.record({ action: 'METER_READING_DELETED', entity: 'MeterReading', entityId: id });
    return removed;
  }

  private async ensureActiveMeter(meterId: string) {
    const meter = await this.prisma.meter.findUnique({ where: { id: meterId }, select: { status: true } });
    if (!meter) throw new NotFoundException('Meter not found');
    if (meter.status !== MeterStatus.ACTIVE) throw new ConflictException('Readings can only be recorded for an active meter');
  }

  private async validateSequence(meterId: string, reading: number, readingAt: Date, excludeId?: string) {
    const [previous, next] = await Promise.all([
      this.prisma.meterReading.findFirst({ where: { meterId, readingAt: { lt: readingAt }, ...(excludeId ? { id: { not: excludeId } } : {}) }, orderBy: { readingAt: 'desc' }, select: { reading: true } }),
      this.prisma.meterReading.findFirst({ where: { meterId, readingAt: { gt: readingAt }, ...(excludeId ? { id: { not: excludeId } } : {}) }, orderBy: { readingAt: 'asc' }, select: { reading: true } }),
    ]);
    if (previous && reading < previous.reading) throw new BadRequestException('Reading cannot be lower than the previous reading for this meter');
    if (next && reading > next.reading) throw new BadRequestException('Reading cannot be higher than the next reading for this meter');
  }

  private async withConsumption<T extends { meterId: string; reading: number; readingAt: Date }>(row: T) {
    const previous = await this.prisma.meterReading.findFirst({ where: { meterId: row.meterId, readingAt: { lt: row.readingAt } }, orderBy: { readingAt: 'desc' }, select: { reading: true } });
    return { ...row, previousReading: previous?.reading ?? null, currentReading: row.reading, consumptionKwh: previous ? row.reading - previous.reading : null };
  }

  private async ensureNotReferencedByBill(meterId: string, reading: number) {
    const bill = await this.prisma.bill.findFirst({
      where: { meterId, OR: [{ previousReading: reading }, { currentReading: reading }] },
      select: { id: true },
    });
    if (bill) throw new ConflictException('Meter reading is already referenced by a bill and cannot be modified');
  }

  private isUniqueError(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
}
