# Neighbourhood Solar Energy Management System

Production-oriented modular monolith for managing neighbourhood solar electricity distribution. Development uses SQLite; production uses the PostgreSQL migration path described below.

## Architecture

The frontend (`apps/web`) communicates with the REST API (`apps/api`). The API will access PostgreSQL through the shared Prisma package (`packages/database`). Shared TypeScript code belongs in `packages/shared`.

## Stack

Next.js, TypeScript, Tailwind CSS, NestJS, REST, PostgreSQL, Prisma, and npm workspaces.

## Repository structure

```text
apps/web          Next.js frontend
apps/api          NestJS REST API
packages/database Prisma schema and client
packages/shared   Shared TypeScript types/utilities
```

## Prerequisites

Node.js 20+, npm 10+, and PostgreSQL 14+.

## Installation and environment

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

For local development, Prisma uses SQLite. Copy the database package environment template if desired:

```bash
cp packages/database/.env.example packages/database/.env
```

The SQLite file is created at `packages/database/prisma/dev.db`. Production requires a deployment-provided PostgreSQL `DATABASE_URL`, for example `postgresql://user:password@host:5432/solar_energy?schema=public`. Never commit `.env` files or real secrets. `FRONTEND_URL` controls API CORS. The frontend uses `NEXT_PUBLIC_API_URL` when calling the API.

## PostgreSQL and Prisma

With the SQLite development URL configured, run:

```bash
npm run db:validate
npm run db:generate
npx prisma db push --schema packages/database/prisma/schema.prisma
```

These commands target SQLite only. Do not run them against production.

The PostgreSQL schema and migrations are isolated under `packages/database/prisma/postgresql/`. Validate or generate its client explicitly:

```bash
npm run prisma:validate:postgres -w @solar-energy/database
npm run prisma:generate:postgres -w @solar-energy/database
```

For production, set `DATABASE_URL` to the deployment PostgreSQL URL and run `npm run prisma:migrate:deploy:postgres -w @solar-energy/database`, followed by the PostgreSQL client generation command. Production schema changes must use `prisma migrate deploy`; never use `prisma db push`.

## Development

Run both workspace applications in separate terminals:

```bash
npm run dev -w @solar-energy/api
npm run dev -w @solar-energy/web
```

The frontend is at http://localhost:3000 and the API health endpoint is http://localhost:3001/api/health.

Useful commands: `npm run build`, `npm run lint`, `npm run format`, `npm run db:validate`, and `npm run db:generate`.
# Solar Energy MVP

Modular monorepo: Next.js/Tailwind web app, NestJS API, Prisma persistence, SQLite for local development and PostgreSQL for production.

## Local setup

Run `npm install`, copy `apps/api/.env.example` to `apps/api/.env`, copy `apps/web/.env.example` to `apps/web/.env`, then run `npm run db:generate`. Start the API with `npm run dev -w @solar-energy/api` and the web app with `npm run dev -w @solar-energy/web`.

Production uses PostgreSQL and the isolated PostgreSQL Prisma migrations: run `npm run prisma:migrate:deploy:postgres -w @solar-energy/database` during deployment, followed by `npm run prisma:generate:postgres -w @solar-energy/database`. Do not use `prisma db push` for production schema management.

Required API variables are `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `FRONTEND_URL`, and `PAYSTACK_SECRET_KEY`. Never expose API secrets through `NEXT_PUBLIC_*`; the web app only needs `NEXT_PUBLIC_API_URL`.

Initial administration is provisioned outside HTTP: set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (12+ characters) and run the provisioning script from `apps/api/scripts/provision-admin.cjs`. The command refuses an existing email and does not use a default credential. Sensitive endpoints have in-memory per-IP limits per minute: login 10, registration 5, payment initialization 20, payment verification 30, and webhook 120.

## API

Public routes are `/api/auth/register` and `/api/auth/login`; protected routes require a bearer JWT. Roles are `CUSTOMER`, `STAFF`, and `ADMIN`. Customer isolation is enforced by `/api/customer/me` (profile, account, bills, payments, ledger, readings). Administrative resources cover customers, meters, readings, tariffs, bills, accounts, ledger, and payments. Paystack uses `/api/payments/initialize`, `/api/payments/verify/:reference`, and the signed server-to-server `/api/payments/webhook` (`x-paystack-signature`). Authenticated users can read and mark their own `/api/notifications`.

Financial values remain Float in the SQLite schema because Prisma SQLite does not support Decimal. The PostgreSQL schema preserves them as Decimal fields mapped to NUMERIC(18,2): tariff price, bill prices/totals, payment amount, account balance, and ledger amounts/balances. Application calculations normalize money to two decimal places and Paystack amounts to deterministic kobo integers.

The PostgreSQL migration is a new empty-database baseline, not a conversion of SQLite migration SQL and not a data migration. Existing SQLite business data is intentionally outside this path; any future data migration requires a separately reviewed milestone.
## Web and mobile clients

This repository is an npm-workspace modular monolith. `apps/web` is the existing Next.js web application, `apps/api` is the single NestJS API, `packages/database` owns Prisma, and `packages/shared` contains platform-neutral TypeScript contracts used by web and mobile. `apps/mobile` is an Expo React Native client for Android and iOS. Web and mobile use the same NestJS API and database; mobile never imports Prisma or accesses SQLite directly.

Run the existing services with `npm run dev:web` and `npm run dev:api`. Run the mobile app with `npm run dev:mobile`, or `npm run android -w @solar-energy/mobile` / `npm run ios -w @solar-energy/mobile`.

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set `EXPO_PUBLIC_API_URL` to the API URL including `/api`, for example `http://192.168.1.10:3001/api`. Expo public variables are bundled into the client, so only the public API URL belongs there. Never put `JWT_SECRET`, `DATABASE_URL` credentials, Paystack secrets, or other backend secrets in mobile environment files.

For a physical phone, `localhost` means the phone itself. Use the development machine's LAN IP and ensure the phone and machine share a reachable network, or use a deployed API. Android emulators and iOS simulators have different localhost/network behavior; a LAN IP is the least surprising option for device testing. Android and iOS runtime builds are not produced by the TypeScript checks alone.

Mobile authentication calls the existing `POST /api/auth/login` and `GET /api/auth/me` endpoints. JWTs are stored with Expo SecureStore, not browser localStorage. Customer data uses the existing ownership-safe `/api/customer/me/*` endpoints, whose customer is derived from the authenticated JWT. The mobile navigation exposes only customer screens: Home, Bills, Payments, Consumption, Account, and Profile.
