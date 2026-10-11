import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ProductionExceptionFilter } from './common/http-exception.filter';
import { SensitiveRateLimitMiddleware } from './common/rate-limit.middleware';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, bodyParser: true });
  app.setGlobalPrefix('api');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  const limiter = new SensitiveRateLimitMiddleware();
  app.use(limiter.use.bind(limiter));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ProductionExceptionFilter());
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true });
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}

void bootstrap();
