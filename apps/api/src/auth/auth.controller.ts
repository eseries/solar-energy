import { Body, Controller, Get, HttpException, InternalServerErrorException, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: Record<string, unknown>) {
    try { return await this.authService.register(body); }
    catch (error) { if (error instanceof Error && 'getStatus' in error) throw error; throw new InternalServerErrorException('Unable to register account'); }
  }

  @Post('login')
  async login(@Body() body: Record<string, unknown>) {
    try { return await this.authService.login(body); }
    catch (error) {
      if (error instanceof HttpException) throw error;

      const prismaCode = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z]\d{4}$/.test(error.code)
        ? error.code
        : 'unavailable';
      const exceptionName = error instanceof Error ? error.constructor.name : typeof error;
      this.logger.error(`Unexpected login failure (${exceptionName}, Prisma code: ${prismaCode}, path: /api/auth/login)`);

      throw new InternalServerErrorException('Unable to log in');
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.currentUser(request.user.userId);
  }
}
