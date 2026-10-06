const test = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { money, decimal, paystackMinorUnits } = require('../dist/common/financial');

const exact = (value) => new Prisma.Decimal(value).toFixed(2);

test('billing amount is exactly two decimal places', () => {
  const amount = money(decimal('125').mul(decimal('100')));
  assert.equal(amount.toFixed(2), '12500.00');
});

test('high-precision tariff multiplication stays Decimal-based', () => {
  const amount = money(decimal('3').mul(decimal('12.34567')));
  assert.equal(amount.toFixed(2), '37.04');
  assert.notEqual(3 * 12.34567, Number(amount.toFixed(2)));
});

test('repeating-decimal calculation follows the two-decimal rounding strategy', () => {
  const amount = money(decimal('10').div(decimal('3')).mul(decimal('100')));
  assert.equal(amount.toFixed(2), '333.33');
  assert.equal(exact(amount), '333.33');
});

test('account and ledger arithmetic remains exact across multiple entries', () => {
  let balance = decimal('0.00');
  const entries = [
    ['CREDIT', '0.10'],
    ['CREDIT', '0.20'],
    ['PAYMENT', '1.11'],
    ['DEBIT', '0.41'],
  ];
  for (const [type, raw] of entries) {
    const before = money(balance);
    const amount = money(raw);
    const after = money(before.add(['DEBIT'].includes(type) ? amount.neg() : amount));
    assert.equal(after.toFixed(2), money(before.add(['DEBIT'].includes(type) ? amount.neg() : amount)).toFixed(2));
    balance = after;
  }
  assert.equal(balance.toFixed(2), '1.00');
});

test('Paystack conversion is exact in kobo, including float-sensitive values', () => {
  assert.equal(paystackMinorUnits(decimal('12500.00')), 1250000);
  assert.equal(paystackMinorUnits(decimal('0.29')), 29);
  assert.equal(paystackMinorUnits(decimal('1234.567')), 123457);
});

test('financial API serialization exposes intentional values, not Decimal objects', () => {
  const payload = { amount: money('12500'), balanceBefore: money('0'), balanceAfter: money('12500') };
  const serialized = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(serialized, { amount: '12500', balanceBefore: '0', balanceAfter: '12500' });
  assert.equal(Object.prototype.toString.call(serialized.amount), '[object String]');
});
