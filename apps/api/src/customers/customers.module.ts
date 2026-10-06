import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { AuditModule } from '../audit/audit.module';

@Module({ imports: [AuthModule, AuditModule], controllers: [CustomersController], providers: [CustomersService] })
export class CustomersModule {}
