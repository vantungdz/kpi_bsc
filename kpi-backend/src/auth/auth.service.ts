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
  ) { }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findOneByUsernameOrEmailForAuth(loginDto.username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordMatching = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordMatching) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
