import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { PersonalGoalService } from './personal-goal.service';
import {
  CreatePersonalGoalDto,
  UpdatePersonalGoalDto,
} from './dto/personal-goal.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Employee } from '../employees/entities/employee.entity';
import { userHasPermission } from '../common/utils/permission.utils';

@Controller('personal-goals')
@UseGuards(JwtAuthGuard)
export class PersonalGoalController {
  constructor(private readonly service: PersonalGoalService) {}

  private userHasPermission(
    user: Employee,
    action: string,
    resource: string,
    scope?: string,
  ): boolean {
    return userHasPermission(user, action, resource, scope);
  }

  @Post()
  create(@Req() req, @Body() dto: CreatePersonalGoalDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get('my')
  findMyGoals(@Req() req) {
    return this.service.findAllByEmployee(req.user.id);
  }

  @Get()
  async findAllOrByEmployee(
    @Req() req,
    @Query('employeeId') employeeId?: number,
  ) {
    const user: Employee = req.user;

    if (employeeId) {
      const canViewEmployeeGoals = this.userHasPermission(
        user,
        'view',
        'employee',
        'company',
      );

      if (canViewEmployeeGoals) {
        return this.service.findAllByEmployee(Number(employeeId));
      }

      if (Number(employeeId) === user.id) {
        return this.service.findAllByEmployee(Number(employeeId));
      }

      throw new ForbiddenException(
        'Insufficient permission to view employee personal goals',
      );
    }

    const canViewAllGoals = this.userHasPermission(
      user,
      'view',
      'employee',
      'company',
    );
    if (!canViewAllGoals) {
      throw new ForbiddenException(
        'Insufficient permission to view all personal goals',
      );
    }

    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number, @Req() req) {
    return this.service.findOne(Number(id), req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: number,
    @Req() req,
    @Body() dto: UpdatePersonalGoalDto,
  ) {
    return this.service.update(Number(id), req.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number, @Req() req) {
    return this.service.remove(Number(id), req.user.id);
  }
}
