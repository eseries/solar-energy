import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly prisma = new PrismaClient();

  async record(input: { userId?: string; action: string; entity: string; entityId: string; metadata?: Record<string, unknown> }) {
    return this.prisma.auditLog.create({ data: { userId: input.userId, action: input.action, entity: input.entity, entityId: input.entityId, metadata: input.metadata ? JSON.stringify(input.metadata) : undefined } });
  }
}
