const test = require('node:test');
const assert = require('node:assert/strict');

if (!process.env.DATABASE_URL?.startsWith('postgresql://')) {
  throw new Error('DATABASE_URL must point to the disposable PostgreSQL integration database.');
}
process.env.JWT_SECRET = 'test-only-jwt-secret-not-a-production-credential';
process.env.JWT_EXPIRES_IN = '1h';
const { PrismaClient, UserRole, CustomerStatus, MeterStatus, MeterType, ReadingSource, LedgerEntryType, BillStatus, PaymentMethod, PaymentStatus } = require('@prisma/client');
const { AuthService } = require('../dist/auth/auth.service');
const { CustomersService } = require('../dist/customers/customers.service');
const { BillingService } = require('../dist/billing/billing.service');
const { MeterReadingsService } = require('../dist/meter-readings/meter-readings.service');
const { AccountsService } = require('../dist/accounts/accounts.service');
const { AuditService } = require('../dist/audit/audit.service');
const { NotificationsService } = require('../dist/notifications/notifications.service');
const { PaymentsService } = require('../dist/payments/payments.service');
const { ConflictException, BadRequestException, UnauthorizedException } = require('@nestjs/common');

const prisma = new PrismaClient();
const audit = new AuditService();
const accounts = new AccountsService(audit);
const auth = new AuthService();
const customers = new CustomersService(audit);
const readings = new MeterReadingsService(audit);
const billing = new BillingService(audit);
let customer;
let meter;
let tariff;
let user;

test.before(async () => {
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Payment_one_successful_per_bill_key" ON "Payment"("billId") WHERE "billId" IS NOT NULL AND "status" = \'SUCCESS\'');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.account.deleteMany();
  await prisma.meter.deleteMany();
  await prisma.tariff.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  user = await prisma.user.create({ data: { name: 'Test Customer', email: 'customer@test.local', passwordHash: '$2b$12$invalid-but-unused', role: UserRole.CUSTOMER } });
  customer = await prisma.customer.create({ data: { customerNumber: 'CUS-TEST-001', name: 'Test Customer', email: 'customer@test.local', userId: user.id } });
  await prisma.account.create({ data: { customerId: customer.id } });
  meter = await prisma.meter.create({ data: { meterNumber: 'MTR-TEST-001', customerId: customer.id, meterType: MeterType.MANUAL, installedAt: new Date('2025-01-01') } });
  tariff = await prisma.tariff.create({ data: { name: 'Test tariff', pricePerKwh: 50, effectiveFrom: new Date('2025-01-01') } });
});

test.after(async () => { await prisma.$disconnect(); });

test('registration always creates CUSTOMER and rejects duplicate email', async () => {
  const created = await auth.register({ name: 'New Customer', email: 'new@test.local', password: 'password123' });
  assert.equal(created.role, UserRole.CUSTOMER);
  await assert.rejects(() => auth.register({ name: 'Duplicate', email: 'new@test.local', password: 'password123' }), (error) => error.status === 409);
});

test('customer creation atomically creates exactly one zero-balance account', async () => {
  const created = await customers.create({ name: 'Created Customer', email: 'created@test.local' });
  const accountsForCustomer = await prisma.account.findMany({ where: { customerId: created.id } });
  assert.equal(created.status, CustomerStatus.ACTIVE);
  assert.equal(created.billingMode, 'POSTPAID');
  assert.equal(accountsForCustomer.length, 1);
  assert.equal(accountsForCustomer[0].balance.toFixed(2), '0.00');
});

test('login succeeds, invalid credentials and inactive users fail', async () => {
  const loginUser = await prisma.user.update({ where: { email: 'new@test.local' }, data: {
    role: UserRole.CUSTOMER,
    isActive: true,
  } });
  await prisma.customer.create({ data: {
    customerNumber: 'CUS-LOGIN-001',
    name: 'Login Customer',
    email: 'new@test.local',
    userId: loginUser.id,
    status: CustomerStatus.ACTIVE,
  } });
  const result = await auth.login({ email: 'new@test.local', password: 'password123' });
  assert.ok(result.accessToken);
  await assert.rejects(() => auth.login({ email: 'new@test.local', password: 'wrong-password' }), UnauthorizedException);
  await prisma.user.update({ where: { email: 'new@test.local' }, data: { isActive: false } });
  await assert.rejects(() => auth.login({ email: 'new@test.local', password: 'password123' }), UnauthorizedException);
});

test('readings enforce cumulative order and calculate consumption', async () => {
  const actor = { userId: user.id, role: UserRole.CUSTOMER };
  const first = await readings.create({ meterId: meter.id, reading: 1000, readingAt: '2025-01-01T00:00:00.000Z', source: ReadingSource.MANUAL }, actor);
  assert.equal(first.consumptionKwh, null);
  const second = await readings.create({ meterId: meter.id, reading: 1250, readingAt: '2025-02-01T00:00:00.000Z', source: ReadingSource.MANUAL }, actor);
  assert.equal(second.consumptionKwh, 250);
  await assert.rejects(() => readings.create({ meterId: meter.id, reading: 1200, readingAt: '2025-03-01T00:00:00.000Z', source: ReadingSource.MANUAL }, actor), BadRequestException);
  await assert.rejects(() => readings.create({ meterId: meter.id, reading: 1300, readingAt: '2025-02-01T00:00:00.000Z', source: ReadingSource.MANUAL }, actor), ConflictException);
});

test('billing calculates consumption and preserves historical tariff price', async () => {
  const bill = await billing.create({ customerId: customer.id, meterId: meter.id, periodStart: '2025-01-01T00:00:00.000Z', periodEnd: '2025-02-01T00:00:00.000Z' });
  assert.equal(bill.consumptionKwh, 250);
  assert.equal(bill.unitPrice.toFixed(2), '50.00');
  assert.equal(bill.amount.toFixed(2), '12500.00');
  assert.equal(bill.status, BillStatus.PENDING);
  await assert.rejects(() => billing.create({ customerId: customer.id, meterId: meter.id, periodStart: '2025-01-01T00:00:00.000Z', periodEnd: '2025-02-01T00:00:00.000Z' }), ConflictException);
});

test('billed readings are immutable while unreferenced readings retain mutation behavior', async () => {
  const actor = { userId: user.id, role: UserRole.CUSTOMER };
  const unreferenced = await readings.create({ meterId: meter.id, reading: 1400, readingAt: '2025-03-01T00:00:00.000Z', source: ReadingSource.MANUAL }, actor);
  const updatedUnreferenced = await readings.update(unreferenced.id, { reading: 1450 });
  assert.equal(updatedUnreferenced.reading, 1450);
  await readings.remove(unreferenced.id);
  const previousReadingId = (await prisma.meterReading.findFirstOrThrow({ where: { meterId: meter.id, reading: 1000 } })).id;
  const currentReadingId = (await prisma.meterReading.findFirstOrThrow({ where: { meterId: meter.id, reading: 1250 } })).id;
  await assert.rejects(() => readings.update(previousReadingId, { reading: 1001 }), (error) => error.status === 409 && error.message === 'Meter reading is already referenced by a bill and cannot be modified');
  const pendingBill = await prisma.bill.findFirstOrThrow({ where: { status: BillStatus.PENDING } });
  const pendingBefore = { ...pendingBill };
  await assert.rejects(() => readings.remove(currentReadingId), (error) => error.status === 409 && error.message === 'Meter reading is already referenced by a bill and cannot be modified');
  assert.deepEqual(await prisma.bill.findUniqueOrThrow({ where: { id: pendingBill.id } }), pendingBefore);

  const paidBill = await prisma.bill.create({ data: { billNumber: 'BILL-READING-INTEGRITY-PAID', customerId: customer.id, meterId: meter.id, tariffId: tariff.id, billingPeriodStart: new Date('2025-01-01'), billingPeriodEnd: new Date('2025-02-01'), previousReading: 1000, currentReading: 1250, consumptionKwh: 250, unitPrice: 50, subtotal: 12500, amount: 12500, status: BillStatus.PAID, dueDate: new Date('2025-02-01') } });
  const paidBefore = await prisma.bill.findUniqueOrThrow({ where: { id: paidBill.id } });
  await assert.rejects(() => readings.update(previousReadingId, { reading: 1002 }), (error) => error.status === 409);
  await assert.rejects(() => readings.remove(currentReadingId), (error) => error.status === 409);
  assert.deepEqual(await prisma.bill.findUniqueOrThrow({ where: { id: paidBill.id } }), paidBefore);
});

test('account ledger updates balances and rejects invalid operations', async () => {
  const credit = await accounts.applyLedgerEntry(customer.id, LedgerEntryType.CREDIT, 12500, 'test credit', 'TEST-CREDIT');
  assert.equal(credit.balanceBefore.toFixed(2), '0.00');
  assert.equal(credit.balanceAfter.toFixed(2), '12500.00');
  const debit = await accounts.applyLedgerEntry(customer.id, LedgerEntryType.DEBIT, 2500, 'test debit', 'TEST-DEBIT');
  assert.equal(debit.balanceBefore.toFixed(2), '12500.00');
  assert.equal(debit.balanceAfter.toFixed(2), '10000.00');
  assert.equal(debit.balanceAfter.toFixed(2), debit.balanceBefore.sub(debit.amount).toFixed(2));
  await assert.rejects(() => accounts.applyLedgerEntry(customer.id, LedgerEntryType.DEBIT, 20000), ConflictException);
  await assert.rejects(() => accounts.applyLedgerEntry(customer.id, LedgerEntryType.CREDIT, -1), BadRequestException);
  assert.equal(await prisma.ledgerEntry.count({ where: { account: { customerId: customer.id } } }), 2);
});

test('bill creation does not create a ledger entry', async () => {
  const count = await prisma.ledgerEntry.count({ where: { account: { customerId: customer.id } } });
  assert.equal(count, 2);
});

test('duplicate successful payment processing is idempotent', async () => {
  const reference = 'SOLAR-IDEMPOTENCY-TEST';
  const bill = await prisma.bill.findFirstOrThrow({ where: { customerId: customer.id } });
  await prisma.payment.create({ data: { customerId: customer.id, billId: bill.id, reference, amount: bill.amount, currency: 'NGN', method: PaymentMethod.PAYSTACK } });
  const paymentService = new PaymentsService({ verify: async () => ({ status: true, data: { reference, status: 'success', amount: Math.round(bill.amount * 100), currency: 'NGN', id: 1 } }) }, accounts, audit, new NotificationsService());

  await paymentService.verify(reference);
  await paymentService.verify(reference);

  const payment = await prisma.payment.findUniqueOrThrow({ where: { reference } });
  const updatedBill = await prisma.bill.findUniqueOrThrow({ where: { id: bill.id } });
  const account = await prisma.account.findUniqueOrThrow({ where: { customerId: customer.id } });
  assert.equal(payment.status, PaymentStatus.SUCCESS);
  assert.equal(payment.amount.toFixed(2), bill.amount.toFixed(2));
  assert.equal(updatedBill.status, BillStatus.PAID);
  assert.equal(account.balance.toFixed(2), '22500.00');
  const paymentLedger = await prisma.ledgerEntry.findMany({ where: { accountId: account.id, type: LedgerEntryType.PAYMENT, reference } });
  assert.equal(paymentLedger.length, 1);
  assert.equal(paymentLedger[0].balanceAfter.toFixed(2), paymentLedger[0].balanceBefore.add(paymentLedger[0].amount).toFixed(2));
  assert.equal(await prisma.notification.count({ where: { customerId: customer.id, type: 'PAYMENT', message: { contains: reference } } }), 1);
});

test('a different successful reference cannot settle the same bill', async () => {
  const bill = await prisma.bill.findFirstOrThrow({ where: { customerId: customer.id, status: BillStatus.PAID } });
  const reference = 'SOLAR-DIFFERENT-REFERENCE';
  await prisma.payment.create({ data: { customerId: customer.id, billId: bill.id, reference, amount: bill.amount, currency: 'NGN', method: PaymentMethod.PAYSTACK } });
  const before = await prisma.account.findUniqueOrThrow({ where: { customerId: customer.id } });
  const ledgerBefore = await prisma.ledgerEntry.count({ where: { accountId: before.id, type: LedgerEntryType.PAYMENT } });
  const service = new PaymentsService({ verify: async () => ({ status: true, data: { reference, status: 'success', amount: Math.round(bill.amount * 100), currency: 'NGN', id: 2 } }) }, accounts, audit, new NotificationsService());
  await assert.rejects(() => service.verify(reference), (error) => error.status === 409 && error.message === 'Bill is already settled by another payment');
  const after = await prisma.account.findUniqueOrThrow({ where: { customerId: customer.id } });
  assert.equal(after.balance.toFixed(2), before.balance.toFixed(2));
  assert.equal(await prisma.ledgerEntry.count({ where: { accountId: before.id, type: LedgerEntryType.PAYMENT } }), ledgerBefore);
  assert.equal((await prisma.payment.findUniqueOrThrow({ where: { reference } })).status, PaymentStatus.PENDING);
  assert.equal((await prisma.bill.findUniqueOrThrow({ where: { id: bill.id } })).status, BillStatus.PAID);
});

test('concurrent different references allow exactly one settlement', async () => {
  const bill = await prisma.bill.create({ data: { billNumber: 'BILL-CONCURRENT-TEST', customerId: customer.id, meterId: meter.id, tariffId: tariff.id, billingPeriodStart: new Date('2026-01-01'), billingPeriodEnd: new Date('2026-02-01'), previousReading: 0, currentReading: 10, consumptionKwh: 10, unitPrice: 50, subtotal: 500, amount: 500, dueDate: new Date('2026-02-15') } });
  const refs = ['SOLAR-CONCURRENT-A', 'SOLAR-CONCURRENT-B'];
  await prisma.payment.createMany({ data: refs.map(reference => ({ customerId: customer.id, billId: bill.id, reference, amount: bill.amount, currency: 'NGN', method: PaymentMethod.PAYSTACK })) });
  const services = refs.map((reference) => new PaymentsService({ verify: async () => ({ status: true, data: { reference, status: 'success', amount: 50000, currency: 'NGN', id: 3 } }) }, accounts, audit, new NotificationsService()));
  const results = await Promise.allSettled(services.map((service, index) => service.verify(refs[index])));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.status === 409).length, 1);
  const account = await prisma.account.findUniqueOrThrow({ where: { customerId: customer.id } });
  assert.equal(await prisma.ledgerEntry.count({ where: { accountId: account.id, type: LedgerEntryType.PAYMENT, reference: { in: refs } } }), 1);
  assert.equal((await prisma.bill.findUniqueOrThrow({ where: { id: bill.id } })).status, BillStatus.PAID);
});
