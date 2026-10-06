import { UserRole } from '@prisma/client';

export type AuthTokenPayload = {
  userId: string;
  role: UserRole;
};

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  customerId?: string;
};

export type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  user: AuthTokenPayload;
};
