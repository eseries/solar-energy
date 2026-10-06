import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paystackMinorUnits } from '../common/financial';

type PaystackInitializeResponse = { status: boolean; message: string; data?: { reference: string; authorization_url: string; access_code: string } };
type PaystackVerifyResponse = { status: boolean; message: string; data?: { status: string; reference: string; amount: number; currency: string; id: number } };

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';

  private secret(): string {
    const value = process.env.PAYSTACK_SECRET_KEY;
    if (!value) throw new ServiceUnavailableException('Paystack is not configured');
    return value;
  }

  async initialize(reference: string, amount: number | string | Prisma.Decimal, email: string) {
    const response = await this.request<PaystackInitializeResponse>('/transaction/initialize', { method: 'POST', body: JSON.stringify({ email, amount: paystackMinorUnits(new Prisma.Decimal(amount)), currency: 'NGN', reference }) });
    if (!response.status || !response.data) throw new ServiceUnavailableException('Paystack payment initialization failed');
    return { reference: response.data.reference, authorizationUrl: response.data.authorization_url, accessCode: response.data.access_code };
  }

  verify(reference: string) { return this.request<PaystackVerifyResponse>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' }); }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers: { Authorization: `Bearer ${this.secret()}`, 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error('Paystack request failed');
      return await response.json() as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Paystack request failed');
    }
  }
}
