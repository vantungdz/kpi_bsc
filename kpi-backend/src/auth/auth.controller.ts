import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { EmployeesService } from '../employees/employees.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Post('login')
  async login(@Body() user: LoginDto, @Req() req: Request) {
    // Lấy thông tin device và IP
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
    // Get userId và sessionId từ JWT
    const userId = (req.user as any)?.id;
    const sessionId = (req.user as any)?.sessionId;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    // Call logout function in service (with operation logging)
    return await this.authService.logout(userId, sessionId);
  }
}
