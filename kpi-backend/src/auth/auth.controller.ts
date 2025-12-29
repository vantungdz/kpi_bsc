import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthGuard } from '@nestjs/passport';
import { EmployeesService } from '../employees/employees.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly rateLimitMap = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_MAX_REQUESTS = 3;

  constructor(
    private readonly authService: AuthService,
    private readonly employeesService: EmployeesService,
  ) {
    // Clean up rate limit map every 5 minutes
    setInterval(
      () => {
        const now = Date.now();
        for (const [email, data] of this.rateLimitMap.entries()) {
          if (now > data.resetTime) {
            this.rateLimitMap.delete(email);
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  @Post('login')
  async login(@Body() user: LoginDto, @Req() req: Request) {
    // Get device and IP information
    const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
    const ipAddress = req.ip || req.socket.remoteAddress || 'Unknown IP';

    // Login and get user with full permissions for each role
    const result = await this.authService.login(
      user,
      deviceInfo,
      ipAddress,
      deviceInfo,
    );
    if (result && result.user) {
      // Get roles with permissions
      if (Array.isArray(result.user.roles) && result.user.roles.length > 0) {
        const roleIds = result.user.roles.map((r: any) =>
          typeof r === 'object' ? r.id : r,
        );
        // Get roles with permissions from DB
        const rolesWithPerms = await this.employeesService[
          'roleRepository'
        ].find({
          where: roleIds.map((id: number) => ({ id })),
          relations: ['permissions'],
        });
        result.user.roles = rolesWithPerms;
      }
      if (Array.isArray(result.user.roles)) {
        const allPermissions = result.user.roles.flatMap(
          (role: any) => role.permissions || [],
        );
      }
    }
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('sessions')
  async getUserSessions(@Req() req: Request): Promise<any> {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    // Get active sessions for user
    return await this.authService.getUserActiveSessions(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Req() req: Request): Promise<any> {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    // Get user with role, department, section, team, and permissions
    return await this.employeesService.findOneWithPermissions(userId);
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    // Get userId and sessionId from JWT
    const userId = (req.user as any)?.id;
    const sessionId = (req.user as any)?.sessionId;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    // Call logout function in service (with operation logging)
    return await this.authService.logout(userId, sessionId);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset request processed',
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    const { email } = forgotPasswordDto;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Apply rate limiting
    const now = Date.now();
    const rateLimitKey = `${email}:${clientIp}`;
    const currentLimit = this.rateLimitMap.get(rateLimitKey);

    if (currentLimit) {
      if (now < currentLimit.resetTime) {
        if (currentLimit.count >= this.RATE_LIMIT_MAX_REQUESTS) {
          throw new HttpException(
            'Too many password reset requests. Please wait before trying again.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        currentLimit.count++;
      } else {
        this.rateLimitMap.set(rateLimitKey, {
          count: 1,
          resetTime: now + this.RATE_LIMIT_WINDOW,
        });
      }
    } else {
      this.rateLimitMap.set(rateLimitKey, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
    }

    return await this.authService.requestPasswordReset(forgotPasswordDto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.authService.resetPasswordWithToken(resetPasswordDto);
  }
}
