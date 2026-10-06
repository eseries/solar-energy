export type HealthResponse = { status: 'ok'; service: 'solar-energy-api' };

export type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';
export type Role = UserRole;
export type User = { id: string; name: string; email: string; role: UserRole; isActive: boolean; customerId?: string };
export type Page<T> = { data: T[]; meta?: { page: number; limit: number; total: number; totalPages: number } };
export type Customer = { id: string; customerNumber: string; name: string; email?: string | null; phone?: string | null; address?: string | null; status: string; billingMode: string; createdAt?: string; user?: User | null; meters?: Meter[]; account?: Account | null; bills?: Bill[]; availableUsers?: (User & { associationStatus: string })[] };
export type Meter = { id: string; meterNumber: string; meterType: string; status: string; installedAt?: string | null; replacedAt?: string | null; customer?: Customer; customerId?: string; readings?: { reading: number; readingAt: string }[] };
export type MeterReading = { id: string; meterId: string; reading: number; readingAt: string; source: string; recordedBy?: string | null; createdAt: string; previousReading?: number | null; currentReading?: number | null; consumptionKwh?: number | null; meter?: Meter; recorder?: Pick<User, 'id'|'name'|'role'> | null };
export type Reading = MeterReading;
/** Financial API values are serialized as decimal strings; number is retained for backwards-compatible clients. */
export type FinancialValue = any;
export type Tariff = { id: string; name: string; pricePerKwh: FinancialValue; effectiveFrom: string; effectiveTo?: string | null; isActive: boolean; createdAt: string; updatedAt: string };
export type Bill = { id: string; billNumber: string; customerId?: string; meterId: string; tariffId?: string; billingPeriodStart: string; billingPeriodEnd: string; previousReading?: number; currentReading?: number; consumptionKwh: number; unitPrice: FinancialValue; subtotal?: FinancialValue; amount: FinancialValue; status: string; dueDate?: string; paidAt?: string | null; createdAt: string; customer?: Customer; meter?: Meter; tariff?: Tariff };
export type Payment = { id: string; customerId?: string; billId?: string | null; reference: string; amount: FinancialValue; currency?: string; method?: string; status: string; paidAt?: string | null; createdAt: string; updatedAt?: string; customer?: Customer; bill?: Bill };
export type Account = { id: string; customerId: string; balance: FinancialValue; createdAt: string; updatedAt: string; customer?: Pick<Customer, 'id'|'customerNumber'|'name'|'status'> };
export type LedgerEntry = { id: string; accountId: string; type: string; amount: FinancialValue; balanceBefore: FinancialValue; balanceAfter: FinancialValue; reference?: string | null; description?: string | null; createdAt: string };
export type Notification = { id: string; customerId?: string | null; userId?: string | null; type: string; title: string; message: string; status: string; createdAt: string; sentAt?: string | null; customer?: Pick<Customer, 'id'|'customerNumber'|'name'|'email'> | null; user?: Pick<User, 'id'|'name'|'email'|'role'> | null };
export type AuthResponse = { accessToken: string; user: User };
export type ApiErrorResponse = { statusCode?: number; message?: string | string[]; error?: string };
export const USER_ROLES = { ADMIN: 'ADMIN', STAFF: 'STAFF', CUSTOMER: 'CUSTOMER' } as const satisfies Record<UserRole, UserRole>;
