import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { MetersModule } from './meters/meters.module';
import { TariffsModule } from './tariffs/tariffs.module';
import { MeterReadingsModule } from './meter-readings/meter-readings.module';
import { BillingModule } from './billing/billing.module';
import { AccountsModule } from './accounts/accounts.module';
import { LedgerModule } from './ledger/ledger.module';
import { PaymentsModule } from './payments/payments.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({ imports: [AuditModule, NotificationsModule, AuthModule, CustomersModule, MetersModule, TariffsModule, MeterReadingsModule, BillingModule, AccountsModule, LedgerModule, PaymentsModule, CustomerPortalModule], controllers: [HealthController] })
export class AppModule {}
