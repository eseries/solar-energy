import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CustomerStatus, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import { AuthTokenPayload, SafeUser } from './auth.types';

type Credentials = { name?: unknown; email?: unknown; password?: unknown };

@Injectable()
export class AuthService {
  private readonly prisma = new PrismaClient();
  private readonly jwtSecret = process.env.JWT_SECRET;
  private readonly jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '1d';

  constructor() {
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET must be configured before starting the API');
    }
  }

  async register(input: Credentials): Promise<SafeUser> {
    const name = this.requiredString(input.name, 'name');
    const email = this.normalizedEmail(input.email);
    const password = this.password(input.password);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: { name, email, passwordHash, role: UserRole.CUSTOMER },
    });
    return this.safeUser(user);
  }

  async login(input: Credentials) {
    const email = this.normalizedEmail(input.email);
    const password = this.password(input.password);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: AuthTokenPayload = { userId: user.id, role: user.role };
    const accessToken = jwt.sign(payload, this.jwtSecret as string, {
      expiresIn: this.jwtExpiresIn as SignOptions['expiresIn'],
    });
    const customer = await this.prisma.customer.findFirst({ where: { userId: user.id }, select: { id: true, status: true } });
    if (user.role === UserRole.CUSTOMER && (!customer || customer.status !== CustomerStatus.ACTIVE)) throw new UnauthorizedException('Customer account is not active');
    return { accessToken, user: this.safeUser(user, customer?.id) };
  }

  async currentUser(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('User is not active');
    const customer = await this.prisma.customer.findFirst({ where: { userId: user.id }, select: { id: true, status: true } });
    if (user.role === UserRole.CUSTOMER && (!customer || customer.status !== CustomerStatus.ACTIVE)) throw new UnauthorizedException('Customer account is not active');
    return this.safeUser(user, customer?.id);
  }

  async ensureActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (!user?.isActive) throw new UnauthorizedException('User is not active');
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret as string);
      if (!payload || typeof payload !== 'object' || typeof payload.userId !== 'string' || !Object.values(UserRole).includes(payload.role)) {
        throw new Error('Invalid token payload');
      }
      return { userId: payload.userId, role: payload.role as UserRole };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private safeUser(user: { id: string; name: string; email: string; role: UserRole; isActive: boolean }, customerId?: string): SafeUser {
    return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, ...(user.role === UserRole.CUSTOMER && customerId ? { customerId } : {}) };
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private normalizedEmail(value: unknown): string {
    const email = this.requiredString(value, 'email').toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException('email must be valid');
    return email;
  }

  private password(value: unknown): string {
    if (typeof value !== 'string' || value.length < 8) throw new BadRequestException('password must be at least 8 characters');
    return value;
  }
}
