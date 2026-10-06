import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeterReadingsController } from './meter-readings.controller';
import { MeterReadingsService } from './meter-readings.service';
import { AuditModule } from '../audit/audit.module';

@Module({ imports: [AuthModule, AuditModule], controllers: [MeterReadingsController], providers: [MeterReadingsService] })
export class MeterReadingsModule {}
