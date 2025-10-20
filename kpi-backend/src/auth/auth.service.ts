import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EmployeesService } from 'src/employees/employees.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  [x: string]: any;
  constructor(
    private jwtService: JwtService,
    private usersService: EmployeesService,
    private auditLogService: AuditLogService,
    private sessionService: SessionService,
  ) {}

  async login(
    loginDto: LoginDto,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.usersService.findOneByUsernameOrEmailForAuth(
      loginDto.username,
    );

    if (!user) {
      await this.auditLogService.logAction({
        action: 'login_failed',
        resource: 'auth',
        username: loginDto.username,
        data: { reason: 'user_not_found' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordMatching = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordMatching) {
      await this.auditLogService.logAction({
        action: 'login_failed',
        resource: 'auth',
        userId: user.id,
        username: user.username,
        data: { reason: 'wrong_password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get user with permissions (RBAC entity)
    const userWithPermissions = await this.usersService.findOneWithPermissions(
      user.id,
    );

    // Create new session and logout all old sessions
    const sessionId = await this.sessionService.createSession(
      user.id,
      deviceInfo || 'Unknown Device',
      ipAddress || 'Unknown IP',
      userAgent || 'Unknown User Agent',
    );

    await this.auditLogService.logAction({
      action: 'login_success',
      resource: 'auth',
      userId: user.id,
      username: user.username,
      data: {
        loginAt: new Date(),
        sessionId,
        deviceInfo,
        ipAddress,
      },
    });

    const payload = {
      id: user.id,
      username: user.username,
      sessionId, // Add sessionId to JWT payload
      roles: Array.isArray(user.roles)
        ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
        : [], // Pass roles array to JWT
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: userWithPermissions,
      sessionId,
    };
  }

  async getUserActiveSessions(userId: number) {
    return await this.sessionService.getUserActiveSessions(userId);
  }

  async logout(userId: number, sessionId?: string) {
    // Logout specific session or all user sessions
    if (sessionId) {
      await this.sessionService.logoutSession(sessionId);
    } else {
      await this.sessionService.logoutAllUserSessions(userId);
    }

    await this.auditLogService.logAction({
      action: 'logout',
      resource: 'auth',
      userId,
      data: {
        logoutAt: new Date(),
        sessionId,
      },
    });
    return { message: 'Logout successful' };
  }
}
