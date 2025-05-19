import { Controller, Post, Body, UseGuards, Get, Req, UnauthorizedException } from '@nestjs/common';
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
  login(@Body() user: LoginDto) {
    return this.authService.login(user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Req() req: Request): Promise<Employee> {
    const userId = (req.user as any)?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    // Lấy user kèm relations: role, department, section, team
    return await this.employeesService.findOne(userId);
  }
}
