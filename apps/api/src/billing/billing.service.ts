import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BillStatus, CustomerStatus, MeterStatus, PrismaClient } from '@prisma/client';
import { decimal, money } from '../common/financial';
import { randomBytes } from 'crypto';
import { CreateBillDto } from './dto/create-bill.dto';
import { ListBillsDto } from './dto/list-bills.dto';
import { AuditService } from '../audit/audit.service';

const billSelect = {
  id: true,
  billNumber: true,
  customerId: true,
  meterId: true,
  tariffId: true,
  billingPeriodStart: true,
  billingPeriodEnd: true,
  previousReading: true,
  currentReading: true,
  consumptionKwh: true,
  unitPrice: true,
  subtotal: true,
  amount: true,
  status: true,
  dueDate: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, customerNumber: true, name: true, email: true } },
  meter: { select: { id: true, meterNumber: true, meterType: true, status: true } },
  tariff: { select: { id: true, name: true, pricePerKwh: true, effectiveFrom: true, effectiveTo: true } },
} as const;

export function parseBillingPeriod(value: string, endOfDay = false): Date {
  // Date-only values from the web form use the application's UTC date convention.
  // An end date covers the complete UTC calendar day; timestamp values retain
  // the normal JavaScript Date parsing behavior for backwards compatibility.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (endOfDay) date.setUTCHours(23, 59, 59, 999);
    return date;
  }
  return new Date(value);
}

export function parseBillingReadingStartBoundary(value: string): Date {
  return parseBillingPeriod(value, /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function selectBillingReadings(readings: Array<{ reading: number; readingAt: Date }>, periodStart: Date, periodEnd: Date, readingStartBoundary: Date) {
  const eligible = readings
    .filter((item) => item.readingAt <= periodEnd)
    .sort((a, b) => b.readingAt.getTime() - a.readingAt.getTime());
  return {
    starting: eligible.find((item) => item.readingAt <= readingStartBoundary),
    ending: eligible[0],
  };
}

@Injectable()
export class BillingService {
  private readonly prisma = new PrismaClient();
  constructor(private readonly audit: AuditService) {}

  async create(dto: CreateBillDto) {
    const periodStart = parseBillingPeriod(dto.periodStart);
    const periodEnd = parseBillingPeriod(dto.periodEnd, true);
    const readingStartBoundary = parseBillingReadingStartBoundary(dto.periodStart);
    if (periodStart >= periodEnd) throw new ConflictException('periodStart must be before periodEnd');

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId }, select: { id: true, status: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.status !== CustomerStatus.ACTIVE) throw new ConflictException('Customer is not active');

    const meter = await this.prisma.meter.findUnique({ where: { id: dto.meterId }, select: { id: true, customerId: true, status: true } });
    if (!meter) throw new NotFoundException('Meter not found');
    if (meter.customerId !== dto.customerId) throw new ConflictException('Meter does not belong to customer');
    if (meter.status !== MeterStatus.ACTIVE) throw new ConflictException('Meter is not active');

    const duplicate = await this.prisma.bill.findFirst({ where: { customerId: dto.customerId, meterId: dto.meterId, billingPeriodStart: periodStart, billingPeriodEnd: periodEnd }, select: { id: true } });
    if (duplicate) throw new ConflictException('A bill already exists for this meter and billing period');

    // Fetch the meter's readings once, then select each boundary explicitly. In
    // particular, the closing reading is not the first reading after the start;
    // it is the latest reading that is still within the selected end boundary.
    // Date-only periodEnd values have already been expanded to 23:59:59.999 UTC
    // by parseBillingPeriod, so readings recorded on the selected end date are
    // included without changing the date sent by the Admin UI.
    const readings = await this.prisma.meterReading.findMany({
      where: { meterId: dto.meterId, readingAt: { lte: periodEnd } },
      orderBy: [{ readingAt: 'desc' }, { id: 'desc' }],
      select: { reading: true, readingAt: true },
    });
    const { starting, ending } = selectBillingReadings(readings, periodStart, periodEnd, readingStartBoundary);
    if (!starting || !ending || ending.readingAt < starting.readingAt) throw new ConflictException('Insufficient meter readings for this billing period');
    const consumptionKwh = ending.reading - starting.reading;
    if (consumptionKwh < 0) throw new ConflictException('Meter readings produce negative consumption');

    const tariffs = await this.prisma.tariff.findMany({ where: { isActive: true, effectiveFrom: { lte: periodStart } }, orderBy: { effectiveFrom: 'desc' }, select: { id: true, name: true, pricePerKwh: true, effectiveFrom: true, effectiveTo: true } });
    const tariff = tariffs.find((item) => !item.effectiveTo || item.effectiveTo >= periodEnd);
    if (!tariff) throw new ConflictException('No active tariff covers the complete billing period');

    const amount = money(decimal(consumptionKwh).mul(tariff.pricePerKwh));
    try {
      const bill = await this.prisma.bill.create({ data: { billNumber: `BILL-${randomBytes(4).toString('hex').toUpperCase()}`, customerId: dto.customerId, meterId: dto.meterId, tariffId: tariff.id, billingPeriodStart: periodStart, billingPeriodEnd: periodEnd, previousReading: starting.reading, currentReading: ending.reading, consumptionKwh, unitPrice: tariff.pricePerKwh, subtotal: amount, amount, status: BillStatus.PENDING, dueDate: periodEnd }, select: billSelect });
      await this.audit.record({ action: 'BILL_CREATED', entity: 'Bill', entityId: bill.id, metadata: { customerId: dto.customerId, amount, unitPrice: tariff.pricePerKwh, consumptionKwh } });
      return bill;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('A bill already exists for this meter and billing period');
      throw error;
    }
  }

  async findAll(query: ListBillsDto) {
    const where = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.meterId ? { meterId: query.meterId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.periodStartFrom || query.periodStartTo ? { billingPeriodStart: { ...(query.periodStartFrom ? { gte: new Date(query.periodStartFrom) } : {}), ...(query.periodStartTo ? { lte: new Date(query.periodStartTo) } : {}) } } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.bill.findMany({ where, select: billSelect, orderBy: { billingPeriodStart: 'desc' }, skip, take: query.limit }),
      this.prisma.bill.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOne(id: string) {
    const bill = await this.prisma.bill.findUnique({ where: { id }, select: billSelect });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  private isUniqueError(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
}
