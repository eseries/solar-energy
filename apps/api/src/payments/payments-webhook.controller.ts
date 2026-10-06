import { Controller, ForbiddenException, Headers, Post, Req } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsWebhookController {
  constructor(private readonly service: PaymentsService) {}
  @Post('webhook')
  async webhook(@Headers('x-paystack-signature') signature: string, @Req() request: { rawBody?: Buffer }) {
    const raw = request.rawBody;
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!raw || !secret || !signature) throw new ForbiddenException('Invalid webhook signature');
    const expected = createHmac('sha512', secret).update(raw).digest('hex');
    if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw new ForbiddenException('Invalid webhook signature');
    let event: { event?: string; data?: { reference?: string } };
    try { event = JSON.parse(raw.toString()) as typeof event; } catch { throw new ForbiddenException('Invalid webhook payload'); }
    if (event.event === 'charge.success' && event.data?.reference) await this.service.verify(event.data.reference);
    return { received: true };
  }
}
