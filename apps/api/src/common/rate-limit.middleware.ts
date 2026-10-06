import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
type Bucket = { count: number; resetAt: number };
@Injectable()
export class SensitiveRateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 60_000;
  private readonly limits: Record<string, number> = { '/api/auth/login': 10, '/api/auth/register': 5, '/api/payments/initialize': 20, '/api/payments/verify': 30, '/api/payments/webhook': 120 };
  use(request: Request, response: Response, next: NextFunction) {
    const key = Object.keys(this.limits).find((path) => request.path === path || (path.endsWith('/verify') && request.path.startsWith(path + '/')));
    if (!key) return next();
    const bucketKey = `${request.ip}:${key}`;
    const now = Date.now();
    const bucket = this.buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) this.buckets.set(bucketKey, { count: 1, resetAt: now + this.windowMs });
    else if (bucket.count >= this.limits[key]) return response.status(429).json({ statusCode: 429, message: 'Too many requests; please try again later.' });
    else bucket.count += 1;
    return next();
  }
}
