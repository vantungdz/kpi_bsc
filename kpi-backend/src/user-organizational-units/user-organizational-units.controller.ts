import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { UserOrganizationalUnitsService } from './user-organizational-units.service';
import { UserOrganizationalUnit } from '../entities/user-organizational-unit.entity';

@Controller('user-organizational-units')
export class UserOrganizationalUnitsController {
  constructor(
    private readonly userOrgUnitsService: UserOrganizationalUnitsService,
  ) {}

  @Get()
  async findAll(): Promise<UserOrganizationalUnit[]> {
    return await this.userOrgUnitsService.findAll();
  }

  @Get(':userId')
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<UserOrganizationalUnit> {
    return await this.userOrgUnitsService.findOne(userId);
  }

  @Post()
  create(
    @Body() unit: Partial<UserOrganizationalUnit>,
  ): Promise<UserOrganizationalUnit> {
    return this.userOrgUnitsService.create(unit);
  }

  @Patch(':userId')
  update(
    @Param('userId') userId: string,
    @Body() update: Partial<UserOrganizationalUnit>,
  ): Promise<UserOrganizationalUnit> {
    return this.userOrgUnitsService.update(+userId, update);
  }

  @Delete(':userId')
  delete(@Param('userId') userId: string): Promise<void> {
    return this.userOrgUnitsService.delete(+userId);
  }
}
