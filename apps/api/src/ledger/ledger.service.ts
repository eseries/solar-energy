import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ListLedgerEntriesDto } from './dto/list-ledger-entries.dto';

@Injectable()
export class LedgerService {
  private readonly prisma = new PrismaClient();

  async findByCustomer(customerId: string, query: ListLedgerEntriesDto) {
    const account = await this.prisma.account.findUnique({ where: { customerId }, select: { id: true } });
    if (!account) {
      const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
      if (!customer) throw new NotFoundException('Customer not found');
      throw new NotFoundException('Account not found');
    }
    const where = { accountId: account.id, ...(query.type ? { type: query.type } : {}), ...(query.createdFrom || query.createdTo ? { createdAt: { ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}), ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}) } } : {}) };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.findMany({ where, select: { id: true, accountId: true, type: true, amount: true, balanceBefore: true, balanceAfter: true, reference: true, description: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip, take: query.limit }),
      this.prisma.ledgerEntry.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }
}
