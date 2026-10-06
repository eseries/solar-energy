import { Prisma } from '@prisma/client';
export const MONEY_SCALE = 2;
export const money = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value).toDecimalPlaces(MONEY_SCALE);
export const decimal = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);
export const isPositive = (value: Prisma.Decimal) => value.gt(0);
export const isFiniteDecimal = (value: Prisma.Decimal) => value.isFinite();
export const paystackMinorUnits = (value: Prisma.Decimal) => value.mul(100).toDecimalPlaces(0).toNumber();
