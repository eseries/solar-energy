import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({ imports: [AuthModule, AccountsModule, AuditModule, NotificationsModule], controllers: [PaymentsController, PaymentsWebhookController], providers: [PaymentsService, PaystackService] })
export class PaymentsModule {}
