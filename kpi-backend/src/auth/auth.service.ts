import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { EmployeesService } from 'src/employees/employees.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailService } from '../common/services/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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
    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepository: Repository<PasswordResetToken>,
    private emailService: EmailService,
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

  async requestPasswordReset(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;
    const user = await this.usersService.findOneByEmail(email);

    if (!user) {
      return {
        message:
          'If an account with this email exists, a password reset link has been sent.',
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const resetToken = this.passwordResetTokenRepository.create({
      token,
      userId: user.id,
      expiresAt,
      used: false,
    });

    await this.passwordResetTokenRepository.save(resetToken);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const emailSent = await this.emailService.sendPasswordResetEmail(
      email,
      resetLink,
    );

    await this.auditLogService.logAction({
      action: 'password_reset_requested',
      resource: 'auth',
      userId: user.id,
      username: user.username,
      data: {
        email,
        emailSent,
        requestedAt: new Date(),
      },
    });

    return {
      message:
        'If an account with this email exists, a password reset link has been sent.',
    };
  }

  async resetPasswordWithToken(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    if (resetToken.used) {
      throw new BadRequestException(
        'This password reset token has already been used.',
      );
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Password reset token has expired.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = resetToken.user;
    await this.usersService.updatePassword(user.id, hashedPassword);

    resetToken.used = true;
    await this.passwordResetTokenRepository.save(resetToken);

    await this.sessionService.logoutAllUserSessions(user.id);

    await this.auditLogService.logAction({
      action: 'password_reset_completed',
      resource: 'auth',
      userId: user.id,
      username: user.username,
      data: {
        resetAt: new Date(),
        sessionsTerminated: true,
      },
    });

    return {
      message:
        'Password has been reset successfully. Please login with your new password.',
    };
  }
}
