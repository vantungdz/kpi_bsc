// jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { EmployeesService } from 'src/employees/employees.service';
import { SessionService } from './session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private employeesService: EmployeesService,
    private sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET_KEY') as string,
    });
  }

  async validate(payload: {
    id: number;
    username: string;
    sessionId: string;
    role: string;
  }) {
    // Validate session before validating user
    if (payload.sessionId) {
      const session = await this.sessionService.validateSession(
        payload.sessionId,
      );
      if (!session || !session.isActive) {
        throw new UnauthorizedException('Session expired or invalid');
      }
    }

    // Use function to get user with permissions
    const user = await this.employeesService.findOneWithPermissions(payload.id);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
