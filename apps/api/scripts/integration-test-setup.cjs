const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');
const { PrismaClient, UserRole, CustomerStatus, BillingMode, MeterType, MeterStatus, ReadingSource } = require('@prisma/client');

const expectedDatabase = path.resolve(__dirname, '../../../packages/database/prisma/integration-test.db');
const configuredUrl = process.env.DATABASE_URL ?? '';
const configuredPath = configuredUrl.startsWith('file:') ? path.resolve(process.cwd(), configuredUrl.slice(5)) : '';
if (configuredPath !== expectedDatabase) {
  console.error('Refusing to run: DATABASE_URL must point exactly to packages/database/prisma/integration-test.db.');
  process.exit(1);
}
if (configuredPath.endsWith('dev.db') || configuredPath.includes('production')) {
  console.error('Refusing to run against a development or production database.');
  process.exit(1);
}

const credentials = {
  admin: process.env.INTEGRATION_ADMIN_PASSWORD,
  staff: process.env.INTEGRATION_STAFF_PASSWORD,
  customerA: process.env.INTEGRATION_CUSTOMER_A_PASSWORD,
  customerB: process.env.INTEGRATION_CUSTOMER_B_PASSWORD,
};
if (Object.values(credentials).some((password) => typeof password !== 'string' || password.length < 12)) {
  console.error('Set all INTEGRATION_*_PASSWORD variables to test-only passwords of at least 12 characters.');
  process.exit(1);
}

const users = [
  { key: 'admin', name: 'Integration Admin', email: 'integration-admin@example.test', role: UserRole.ADMIN },
  { key: 'staff', name: 'Integration Staff', email: 'integration-staff@example.test', role: UserRole.STAFF },
  { key: 'customerA', name: 'Integration Customer A', email: 'customer-a@example.test', role: UserRole.CUSTOMER },
  { key: 'customerB', name: 'Integration Customer B', email: 'customer-b@example.test', role: UserRole.CUSTOMER },
];

async function main() {
  if (!fs.existsSync(expectedDatabase)) throw new Error('Integration database file does not exist; initialize the empty database first.');
  const prisma = new PrismaClient();
  try {
    const counts = await Promise.all([
      prisma.user.count(), prisma.customer.count(), prisma.meter.count(), prisma.meterReading.count(),
      prisma.tariff.count(), prisma.bill.count(), prisma.payment.count(), prisma.account.count(),
      prisma.ledgerEntry.count(), prisma.notification.count(), prisma.auditLog.count(),
    ]);
    if (counts.some((count) => count !== 0)) throw new Error('Refusing to seed: integration database is not empty. No records were changed.');

    await prisma.$transaction(async (tx) => {
      const createdUsers = {};
      for (const item of users) {
        const customerData = item.key === 'customerA'
          ? { customerNumber: 'CUS-INT-A', name: item.name, email: item.email, status: CustomerStatus.ACTIVE, billingMode: BillingMode.POSTPAID }
          : item.key === 'customerB'
            ? { customerNumber: 'CUS-INT-B', name: item.name, email: item.email, status: CustomerStatus.ACTIVE, billingMode: BillingMode.POSTPAID }
            : undefined;
        createdUsers[item.key] = await tx.user.create({
          data: {
            name: item.name,
            email: item.email,
            passwordHash: await bcrypt.hash(credentials[item.key], 12),
            role: item.role,
            isActive: true,
            ...(customerData ? { customers: { create: customerData } } : {}),
          },
          include: { customers: true },
        });
      }
      const customerA = createdUsers.customerA.customers[0];
      const customerB = createdUsers.customerB.customers[0];
      await tx.account.createMany({ data: [{ customerId: customerA.id, balance: 0 }, { customerId: customerB.id, balance: 0 }] });
      const meterA = await tx.meter.create({ data: { customerId: customerA.id, meterNumber: 'MTR-INT-A', meterType: MeterType.MANUAL, status: MeterStatus.ACTIVE, installedAt: new Date('2025-01-01T00:00:00.000Z') } });
      const meterB = await tx.meter.create({ data: { customerId: customerB.id, meterNumber: 'MTR-INT-B', meterType: MeterType.SMART, status: MeterStatus.ACTIVE, installedAt: new Date('2026-01-01T00:00:00.000Z') } });
      await tx.tariff.createMany({ data: [
        { name: 'Integration Tariff A', pricePerKwh: 50, effectiveFrom: new Date('2025-01-01T00:00:00.000Z'), effectiveTo: new Date('2025-12-31T23:59:59.999Z'), isActive: true },
        { name: 'Integration Tariff B', pricePerKwh: 75, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), effectiveTo: new Date('2026-12-31T23:59:59.999Z'), isActive: true },
      ] });
      await tx.meterReading.createMany({ data: [
        { meterId: meterA.id, reading: 1000, readingAt: new Date('2025-03-01T00:00:00.000Z'), source: ReadingSource.MANUAL, recordedBy: createdUsers.admin.id },
        { meterId: meterA.id, reading: 1125, readingAt: new Date('2025-03-31T00:00:00.000Z'), source: ReadingSource.MANUAL, recordedBy: createdUsers.admin.id },
        { meterId: meterB.id, reading: 2000, readingAt: new Date('2026-03-01T00:00:00.000Z'), source: ReadingSource.AUTOMATIC },
        { meterId: meterB.id, reading: 2180, readingAt: new Date('2026-03-31T00:00:00.000Z'), source: ReadingSource.AUTOMATIC },
      ] });
    });
    console.log('Integration test database seeded with identities, customers, accounts, meters, tariffs, and readings.');
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
