import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EmployeesService } from 'src/employees/employees.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class AuthService {
  [x: string]: any;
  constructor(
    private jwtService: JwtService,
    private usersService: EmployeesService,
    private auditLogService: AuditLogService,
  ) {}

  async login(loginDto: LoginDto) {
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

    // Lấy user kèm permissions (RBAC entity)
    const userWithPermissions = await this.usersService.findOneWithPermissions(
      user.id,
    );

    await this.auditLogService.logAction({
      action: 'login_success',
      resource: 'auth',
      userId: user.id,
      username: user.username,
      data: { loginAt: new Date() },
    });

    const payload = {
      id: user.id,
      username: user.username,
      roles: Array.isArray(user.roles)
        ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
        : [], // Truyền mảng roles vào JWT
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: userWithPermissions,
    };
  }

  async logout(userId: number) {
    await this.auditLogService.logAction({
      action: 'logout',
      resource: 'auth',
      userId,
      data: { logoutAt: new Date() },
    });
    return { message: 'Logout successful' };
  }
}
