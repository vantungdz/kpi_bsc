import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmployeesModule } from 'src/employees/employees.module';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SessionService } from './session.service';
import { UserSession } from './entities/user-session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailService } from '../common/services/email.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forFeature([UserSession, PasswordResetToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get<string>('JWT_SECRET_KEY'),
          signOptions: {
            expiresIn: configService.get<string>('JWT_TOKEN_EXPIRED_TIME'),
          },
        };
      },
      inject: [ConfigService],
    }),
    EmployeesModule,
    require('../audit-log/audit-log.module').AuditLogModule,
  ],
  providers: [AuthService, JwtStrategy, SessionService, EmailService],
  controllers: [AuthController],
  exports: [JwtModule, SessionService, EmailService],
})
export class AuthModule {}
