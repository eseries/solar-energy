import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerStatus, PrismaClient } from '@prisma/client';
import { ListLedgerEntriesDto } from '../ledger/dto/list-ledger-entries.dto';

@Injectable()
export class CustomerPortalService {
  private readonly prisma = new PrismaClient();

  private async customerForUser(userId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { userId }, select: { id: true, customerNumber: true, name: true, email: true, phone: true, address: true, status: true, billingMode: true } });
    if (!customer || customer.status !== CustomerStatus.ACTIVE) throw new NotFoundException('Customer profile is not available');
    return customer;
  }

  async profile(userId: string) {
    const customer = await this.customerForUser(userId);
    const meters = await this.prisma.meter.findMany({ where: { customerId: customer.id }, select: { id: true, meterNumber: true, meterType: true, status: true, installedAt: true, replacedAt: true }, orderBy: { createdAt: 'desc' } });
    return { ...customer, meters };
  }

  async account(userId: string) {
    const customer = await this.customerForUser(userId);
    const account = await this.prisma.account.findUnique({ where: { customerId: customer.id }, select: { id: true, customerId: true, balance: true, createdAt: true, updatedAt: true } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async bills(userId: string, page = 1, limit = 20) {
    const customer = await this.customerForUser(userId); const skip = (page - 1) * limit; const where = { customerId: customer.id };
    const [data, total] = await this.prisma.$transaction([this.prisma.bill.findMany({ where, select: { id: true, billNumber: true, meterId: true, billingPeriodStart: true, billingPeriodEnd: true, consumptionKwh: true, unitPrice: true, amount: true, status: true, dueDate: true, paidAt: true, createdAt: true, meter: { select: { meterNumber: true } } }, orderBy: { createdAt: 'desc' }, skip, take: limit }), this.prisma.bill.count({ where })]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async bill(userId: string, billId: string) {
    const customer = await this.customerForUser(userId);
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, customerId: customer.id },
      select: {
        id: true, billNumber: true, customerId: true, meterId: true, tariffId: true,
        billingPeriodStart: true, billingPeriodEnd: true, previousReading: true,
        currentReading: true, consumptionKwh: true, unitPrice: true, subtotal: true,
        amount: true, status: true, dueDate: true, paidAt: true, createdAt: true,
        updatedAt: true,
        meter: { select: { id: true, meterNumber: true, meterType: true, status: true } },
        tariff: { select: { id: true, name: true, pricePerKwh: true, effectiveFrom: true, effectiveTo: true } },
      },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return { ...bill, customer: { id: customer.id, customerNumber: customer.customerNumber, name: customer.name } };
  }

  async payments(userId: string, page = 1, limit = 20) {
    const customer = await this.customerForUser(userId); const skip = (page - 1) * limit; const where = { customerId: customer.id };
    const [data, total] = await this.prisma.$transaction([this.prisma.payment.findMany({ where, select: { id: true, reference: true, billId: true, amount: true, currency: true, method: true, status: true, paidAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip, take: limit }), this.prisma.payment.count({ where })]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async payment(userId: string, paymentId: string) {
    const customer = await this.customerForUser(userId);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, customerId: customer.id },
      select: {
        id: true, customerId: true, billId: true, reference: true, amount: true,
        currency: true, method: true, status: true, paidAt: true, createdAt: true,
        updatedAt: true,
        bill: { select: {
          id: true, billNumber: true, amount: true, status: true,
          billingPeriodStart: true, billingPeriodEnd: true, dueDate: true, paidAt: true,
        } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return { ...payment, customer: { id: customer.id, customerNumber: customer.customerNumber, name: customer.name, email: customer.email } };
  }

  async ledger(userId: string, query: ListLedgerEntriesDto) {
    const customer = await this.customerForUser(userId); const account = await this.prisma.account.findUnique({ where: { customerId: customer.id }, select: { id: true } }); if (!account) throw new NotFoundException('Account not found');
    const where = { accountId: account.id, ...(query.type ? { type: query.type } : {}), ...(query.createdFrom || query.createdTo ? { createdAt: { ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}), ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}) } } : {}) };
    const skip = (query.page - 1) * query.limit; const [data, total] = await this.prisma.$transaction([this.prisma.ledgerEntry.findMany({ where, select: { id: true, type: true, amount: true, balanceBefore: true, balanceAfter: true, reference: true, description: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip, take: query.limit }), this.prisma.ledgerEntry.count({ where })]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async readings(userId: string, page = 1, limit = 20) {
    const customer = await this.customerForUser(userId); const skip = (page - 1) * limit; const where = { meter: { customerId: customer.id } }; const [rows, total] = await this.prisma.$transaction([this.prisma.meterReading.findMany({ where, select: { id: true, meterId: true, reading: true, readingAt: true, source: true, createdAt: true, meter: { select: { id: true, meterNumber: true, meterType: true, status: true } } }, orderBy: { readingAt: 'desc' }, skip, take: limit }), this.prisma.meterReading.count({ where })]);
    const data = await Promise.all(rows.map(async (row) => {
      const previous = await this.prisma.meterReading.findFirst({ where: { meterId: row.meterId, readingAt: { lt: row.readingAt } }, orderBy: { readingAt: 'desc' }, select: { reading: true } });
      return { ...row, previousReading: previous?.reading ?? null, currentReading: row.reading, consumptionKwh: previous ? row.reading - previous.reading : null };
    }));
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
