import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { BillStatus, LedgerEntryType, PaymentMethod, PaymentStatus, Prisma, PrismaClient, UserRole } from '@prisma/client';
import { AuthTokenPayload } from '../auth/auth.types';
import { randomBytes } from 'crypto';
import { AccountsService } from '../accounts/accounts.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { PaystackService } from './paystack.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isFiniteDecimal, isPositive, money, paystackMinorUnits } from '../common/financial';

const paymentSelect = { id: true, customerId: true, billId: true, reference: true, amount: true, currency: true, method: true, status: true, paidAt: true, createdAt: true, updatedAt: true, customer: { select: { id: true, customerNumber: true, name: true, email: true } }, bill: { select: { id: true, billNumber: true, amount: true, status: true } } } as const;

@Injectable()
export class PaymentsService {
  private readonly prisma = new PrismaClient();
  constructor(private readonly paystack: PaystackService, private readonly accounts: AccountsService, private readonly audit: AuditService, private readonly notifications: NotificationsService) {}

  async initialize(dto: InitializePaymentDto, actor?: AuthTokenPayload) {
    const bill = await this.prisma.bill.findUnique({ where: { id: dto.billId }, select: { id: true, customerId: true, amount: true, status: true, customer: { select: { id: true, email: true, status: true } } } });
    if (!bill) throw new NotFoundException('Bill not found');
    if (actor?.role === UserRole.CUSTOMER) {
      const owned = await this.prisma.customer.findFirst({ where: { id: bill.customerId, userId: actor.userId }, select: { id: true } });
      if (!owned) throw new ConflictException('Bill does not belong to the authenticated customer');
    }
    if (bill.customer.status !== 'ACTIVE') throw new ConflictException('Customer is not active');
    if (bill.status === BillStatus.PAID) throw new ConflictException('Bill is already paid');
    if (!isFiniteDecimal(bill.amount) || !isPositive(bill.amount)) throw new ConflictException('Bill amount is not payable');
    const email = bill.customer.email;
    if (!email) throw new ConflictException('Customer email is required for Paystack checkout');

    const reference = await this.uniqueReference();
    const payment = await this.prisma.payment.create({ data: { customerId: bill.customerId, billId: bill.id, reference, amount: money(bill.amount), currency: 'NGN', method: PaymentMethod.PAYSTACK, status: PaymentStatus.PENDING }, select: { id: true, reference: true } });
    try {
      return await this.paystack.initialize(payment.reference, bill.amount, email);
    } catch (error) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } }).catch(() => undefined);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Paystack payment initialization failed');
    }
  }

  async verify(reference: string, actor?: AuthTokenPayload) {
    const local = await this.prisma.payment.findUnique({ where: { reference }, select: paymentSelect });
    if (!local) throw new NotFoundException('Payment not found');
    if (actor?.role === UserRole.CUSTOMER) {
      const owned = await this.prisma.customer.findFirst({ where: { id: local.customerId, userId: actor.userId }, select: { id: true } });
      if (!owned) throw new ConflictException('Payment does not belong to the authenticated customer');
    }
    if (local.status === PaymentStatus.SUCCESS) return local;
    const result = await this.paystack.verify(reference);
    const transaction = result.data;
    if (!result.status || !transaction || transaction.reference !== reference || transaction.status !== 'success') throw new ConflictException('Paystack payment is not successful');
    if (transaction.currency !== 'NGN' || transaction.amount !== paystackMinorUnits(local.amount)) throw new ConflictException('Paystack payment amount or currency does not match');

    let payment;
    try {
      payment = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { reference }, select: { ...paymentSelect, status: true, amount: true, customerId: true, billId: true } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === PaymentStatus.SUCCESS) return payment;
      if (payment.billId) {
        const bill = await tx.bill.findUnique({ where: { id: payment.billId }, select: { status: true } });
        if (bill?.status === BillStatus.PAID) throw new ConflictException('Bill is already settled by another payment');
      }
      await this.accounts.applyLedgerEntryInTransaction(tx, payment.customerId, LedgerEntryType.PAYMENT, payment.amount, `Paystack payment for ${reference}`, reference);
      await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCESS, paidAt: new Date() } });
      if (payment.billId) await tx.bill.update({ where: { id: payment.billId }, data: { status: BillStatus.PAID, paidAt: new Date() } });
      await tx.notification.create({ data: { customerId: payment.customerId, type: 'PAYMENT', title: 'Payment successful', message: `Payment ${reference} was received successfully.` } });
      return tx.payment.findUniqueOrThrow({ where: { id: payment.id }, select: paymentSelect });
      });
    } catch (error) {
      // The partial unique index is the serialization point for concurrent
      // successful payments targeting the same bill. The transaction rolls
      // back its ledger, payment, and notification writes before this error
      // is exposed as a business conflict.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Bill is already settled by another payment');
      }
      throw error;
    }
    await this.audit.record({ action: 'PAYMENT_VERIFIED', entity: 'Payment', entityId: payment.id, metadata: { reference, amount: payment.amount, currency: 'NGN' } });
    return payment;
  }

  async findAll(query: ListPaymentsDto) {
    const search = query.search?.trim();
    const where = { ...(query.customerId ? { customerId: query.customerId } : {}), ...(query.billId ? { billId: query.billId } : {}), ...(query.status ? { status: query.status } : {}), ...(query.method ? { method: query.method } : {}), ...(search ? { OR: [{ reference: { contains: search } }, { customer: { OR: [{ name: { contains: search } }, { customerNumber: { contains: search } }] } }, { bill: { billNumber: { contains: search } } }] } : {}), ...(query.createdFrom || query.createdTo ? { createdAt: { ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}), ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}) } } : {}) };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([this.prisma.payment.findMany({ where, select: paymentSelect, orderBy: { createdAt: 'desc' }, skip, take: query.limit }), this.prisma.payment.count({ where })]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id }, select: paymentSelect });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  private async uniqueReference() {
    for (let i = 0; i < 3; i += 1) {
      const reference = `SOLAR-${randomBytes(4).toString('hex').toUpperCase()}`;
      if (!(await this.prisma.payment.findUnique({ where: { reference }, select: { id: true } }))) return reference;
    }
    throw new ConflictException('Unable to generate a unique payment reference');
  }
}
