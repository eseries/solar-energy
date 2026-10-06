const path = require('node:path');
process.loadEnvFile(path.resolve(__dirname, '../.env'));
const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const name = process.env.ADMIN_NAME;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!name || !email || !password || password.length < 12) { console.error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (minimum 12 characters).'); process.exit(1); }
async function main() { const prisma = new PrismaClient(); try { if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new Error('A user with this email already exists.'); await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: UserRole.ADMIN } }); console.log('ADMIN account provisioned.'); } finally { await prisma.$disconnect(); } }
main().catch((error) => { console.error(error.message); process.exit(1); });
