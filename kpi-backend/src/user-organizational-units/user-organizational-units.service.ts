import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserOrganizationalUnit } from '../entities/user-organizational-unit.entity';

@Injectable()
export class UserOrganizationalUnitsService {
  constructor(
    @InjectRepository(UserOrganizationalUnit)
    private userOrgUnitsRepository: Repository<UserOrganizationalUnit>,
  ) {}

  async findAll(): Promise<UserOrganizationalUnit[]> {
    return await this.userOrgUnitsRepository.find({
      relations: ['user', 'user.assignedKpis', 'department', 'section', 'team'],
    });
  }

  async findOne(userId: number): Promise<UserOrganizationalUnit> {
    const realationsDta = await this.userOrgUnitsRepository.findOne({
      where: { user_id: userId },
      relations: ['user', 'user.assignedKpis', 'department', 'section', 'team'],
    });

    if (!realationsDta) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    return realationsDta;
  }

  async create(
    unit: Partial<UserOrganizationalUnit>,
  ): Promise<UserOrganizationalUnit> {
    const newUnit = this.userOrgUnitsRepository.create(unit);
    return this.userOrgUnitsRepository.save(newUnit);
  }

  async update(
    userId: number,
    update: Partial<UserOrganizationalUnit>,
  ): Promise<UserOrganizationalUnit> {
    await this.userOrgUnitsRepository.update({ user_id: userId }, update);
    return this.findOne(userId);
  }

  async delete(userId: number): Promise<void> {
    await this.userOrgUnitsRepository.delete({ user_id: userId });
  }
}
