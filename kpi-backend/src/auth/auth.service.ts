import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EmployeesService } from 'src/employees/employees.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  [x: string]: any;
  constructor(
    private jwtService: JwtService,
    private usersService: EmployeesService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findOneByUsernameOrEmailForAuth(
      loginDto.username,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordMatching = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordMatching) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Lấy user kèm permissions (RBAC entity)
    const userWithPermissions = await this.usersService.findOneWithPermissions(
      user.id,
    );

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
}
