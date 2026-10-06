import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerEntryType, Prisma, PrismaClient } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { isFiniteDecimal, isPositive, money } from '../common/financial';

const accountSelect = { id: true, customerId: true, balance: true, createdAt: true, updatedAt: true, customer: { select: { id: true, customerNumber: true, name: true, status: true } } } as const;
const positiveTypes = new Set<LedgerEntryType>([LedgerEntryType.CREDIT, LedgerEntryType.PAYMENT, LedgerEntryType.REFUND]);
const negativeTypes = new Set<LedgerEntryType>([LedgerEntryType.DEBIT, LedgerEntryType.CHARGE]);

@Injectable()
export class AccountsService {
  private readonly prisma = new PrismaClient();
  constructor(private readonly audit: AuditService) {}

  async findByCustomer(customerId: string) {
    const account = await this.prisma.account.findUnique({ where: { customerId }, select: accountSelect });
    if (!account) {
      const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
      if (!customer) throw new NotFoundException('Customer not found');
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async list(query: { page: number; limit: number; search?: string }) {
    const skip = (query.page - 1) * query.limit;
    const search = query.search?.trim();
    const where = search ? { customer: { OR: [{ name: { contains: search } }, { customerNumber: { contains: search } }] } } : undefined;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({ where, select: accountSelect, orderBy: { createdAt: 'desc' }, skip, take: query.limit }),
      this.prisma.account.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async applyLedgerEntry(customerId: string, type: LedgerEntryType, amount: number | string | Prisma.Decimal, description?: string, reference?: string) {
    const normalizedAmount = money(amount);
    if (!isFiniteDecimal(normalizedAmount) || !isPositive(normalizedAmount)) throw new BadRequestException('Amount must be greater than zero and finite');
    const direction = positiveTypes.has(type) ? 1 : negativeTypes.has(type) ? -1 : 0;
    if (!direction) throw new BadRequestException('Ledger entry type is not supported for balance operations');

    const entry = await this.prisma.$transaction((tx) => this.applyLedgerEntryInTransaction(tx, customerId, type, amount, description, reference));
    await this.audit.record({ action: 'LEDGER_ENTRY_CREATED', entity: 'LedgerEntry', entityId: entry.id, metadata: { customerId, type, amount: entry.amount, reference } });
    return entry;
  }

  async applyLedgerEntryInTransaction(tx: Prisma.TransactionClient, customerId: string, type: LedgerEntryType, amount: number | string | Prisma.Decimal, description?: string, reference?: string) {
    const normalizedAmount = money(amount);
    if (!isFiniteDecimal(normalizedAmount) || !isPositive(normalizedAmount)) throw new BadRequestException('Amount must be greater than zero and finite');
    const direction = positiveTypes.has(type) ? 1 : negativeTypes.has(type) ? -1 : 0;
    if (!direction) throw new BadRequestException('Ledger entry type is not supported for balance operations');

    const account = await tx.account.findUnique({ where: { customerId }, select: accountSelect });
      if (!account) throw new NotFoundException('Account not found');
      const balanceBefore = money(account.balance);
      const balanceAfter = money(balanceBefore.add(normalizedAmount.mul(direction)));
      if (balanceAfter.lt(0)) throw new ConflictException('Insufficient account balance');

      const updated = await tx.account.updateMany({ where: { id: account.id, balance: account.balance }, data: { balance: balanceAfter } });
      if (updated.count !== 1) throw new ConflictException('Account changed concurrently; retry the operation');
      return tx.ledgerEntry.create({ data: { accountId: account.id, type, amount: normalizedAmount, balanceBefore, balanceAfter, description, reference } });
  }

}
