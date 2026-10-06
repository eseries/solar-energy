import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

@Module({ imports: [AuthModule, AccountsModule], controllers: [LedgerController], providers: [LedgerService] })
export class LedgerModule {}
