// jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { EmployeesService } from 'src/employees/employees.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private employeesService: EmployeesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET_KEY') as string,
    });
  }

  async validate(payload: { id: number; username: string; role: string }) {
    // Sử dụng hàm lấy user kèm permissions
    const user = await this.employeesService.findOneWithPermissions(payload.id);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
