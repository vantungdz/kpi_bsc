import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { PersonalGoalService } from './personal-goal.service';
import { CreatePersonalGoalDto, UpdatePersonalGoalDto } from './dto/personal-goal.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('personal-goals')
@UseGuards(JwtAuthGuard)
export class PersonalGoalController {
  constructor(private readonly service: PersonalGoalService) {}

  @Post()
  create(@Req() req, @Body() dto: CreatePersonalGoalDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get('my')
  findMyGoals(@Req() req) {
    return this.service.findAllByEmployee(req.user.id);
  }

  @Get()
  async findAllOrByEmployee(@Req() req, @Query('employeeId') employeeId?: number) {
    // Nếu có query employeeId, kiểm tra quyền và trả về mục tiêu của nhân viên đó
    if (employeeId) {
      // Nếu là admin/manager thì cho phép xem mục tiêu của bất kỳ nhân viên nào
      const roles = req.user?.roles?.map(r => (typeof r === 'string' ? r : r.name?.toLowerCase?.())) || [];
      if (roles.includes('admin') || roles.includes('manager')) {
        return this.service.findAllByEmployee(Number(employeeId));
      }
      // Nếu là chính mình thì cũng cho phép
      if (Number(employeeId) === req.user.id) {
        return this.service.findAllByEmployee(Number(employeeId));
      }
      // Nếu không có quyền
      throw new Error('Forbidden');
    }
    // Nếu không có employeeId, trả về tất cả (chỉ cho admin/manager)
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number, @Req() req) {
    return this.service.findOne(Number(id), req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Req() req, @Body() dto: UpdatePersonalGoalDto) {
    return this.service.update(Number(id), req.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number, @Req() req) {
    return this.service.remove(Number(id), req.user.id);
  }
}
