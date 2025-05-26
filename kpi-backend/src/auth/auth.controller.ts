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
import { Employee } from '../entities/employee.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Post('login')
  async login(@Body() user: LoginDto) {
    // Đăng nhập và lấy user kèm permissions đầy đủ cho từng role
    const result = await this.authService.login(user);
    if (result && result.user) {
      // Lấy lại roles kèm permissions
      if (Array.isArray(result.user.roles) && result.user.roles.length > 0) {
        const roleIds = result.user.roles.map((r: any) =>
          typeof r === 'object' ? r.id : r,
        );
        // Lấy roles kèm permissions từ DB
        const rolesWithPerms = await this.employeesService[
          'roleRepository'
        ].find({
          where: roleIds.map((id: number) => ({ id })),
          relations: ['permissions'],
        });
        result.user.roles = rolesWithPerms;
      }
      // eslint-disable-next-line no-console
      console.log('LOGIN SUCCESS - User info:', result.user);
      // eslint-disable-next-line no-console
      console.log('LOGIN SUCCESS - User roles:', result.user.roles);
      if (Array.isArray(result.user.roles)) {
        const allPermissions = result.user.roles.flatMap(
          (role: any) => role.permissions || [],
        );
        // eslint-disable-next-line no-console
        console.log('LOGIN SUCCESS - User permissions:', allPermissions);
      }
    }
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Req() req: Request): Promise<any> {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    // Lấy user kèm role, department, section, team, và permissions
    return await this.employeesService.findOneWithPermissions(userId);
  }
}
