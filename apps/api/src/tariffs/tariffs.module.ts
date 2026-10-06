import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TariffsController } from './tariffs.controller';
import { TariffsService } from './tariffs.service';
import { AuditModule } from '../audit/audit.module';

@Module({ imports: [AuthModule, AuditModule], controllers: [TariffsController], providers: [TariffsService] })
export class TariffsModule {}
