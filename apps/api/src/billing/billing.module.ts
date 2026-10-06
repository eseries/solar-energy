import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuditModule } from '../audit/audit.module';

@Module({ imports: [AuthModule, AuditModule], controllers: [BillingController], providers: [BillingService] })
export class BillingModule {}
