import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find({
      relations: [
        'assignedKpis',
        'assignedKpis.evaluations',
        'evaluationsAsEvaluator',
        'evaluationsAsEvaluatee',
        'kpiValues',
        'organizationalUnit',
      ],
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: [
        'assignedKpis',
        'assignedKpis.evaluations',
        'evaluationsAsEvaluator',
        'evaluationsAsEvaluatee',
        'kpiValues',
        'organizationalUnit',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }
}
