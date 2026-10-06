import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MetersController } from './meters.controller';
import { MetersService } from './meters.service';
import { AuditModule } from '../audit/audit.module';

@Module({ imports: [AuthModule, AuditModule], controllers: [MetersController], providers: [MetersService] })
export class MetersModule {}
