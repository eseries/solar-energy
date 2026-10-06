import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
@Catch()
export class ProductionExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProductionExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const isHttp = error instanceof HttpException;
    const status = isHttp ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!isHttp) this.logger.error(`${request.method} ${request.url}`, error instanceof Error ? error.stack : String(error));
    const payload = isHttp ? error.getResponse() : 'Internal server error';
    const message = typeof payload === 'object' && payload !== null && 'message' in payload ? (payload as { message: unknown }).message : payload;
    response.status(status).json({ statusCode: status, message, path: request.url, timestamp: new Date().toISOString() });
  }
}
