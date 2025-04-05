import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindManyOptions,
  FindOptionsWhere,
  Like,
  IsNull,
} from 'typeorm';
import { Kpi } from '../entities/kpi.entity';
import { KpiFilterDto } from './dto/filter-kpi.dto';
import { User } from 'src/entities/user.entity';
import { Perspective } from 'src/entities/perspective.entity';

@Injectable()
export class KpisService {
  constructor(
    @InjectRepository(Kpi)
    private kpisRepository: Repository<Kpi>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Perspective)
    private perspectivesRepository: Repository<Perspective>,
  ) {}

  async getAllSortedByAssignName(
    sortOrder: 'ASC' | 'DESC' = 'ASC',
  ): Promise<Kpi[]> {
    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignedTo', 'assignedTo') // Join với bảng users
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('kpi.parent', 'parent')
      .where('kpi.deletedAt IS NULL') // Loại bỏ KPI bị xóa mềm
      .orderBy('assignedTo.username', sortOrder); // Sắp xếp theo username

    return query.getMany();
  }
  

  async findAll(filterDto: KpiFilterDto): Promise<Kpi[]> {
    const where: FindOptionsWhere<Kpi> = {
      deletedAt: IsNull(),
    };

    const order: any = {};

    if (filterDto.name) {
      where.name = filterDto.name;
    }

    if (filterDto.perspectiveId) {
      where.perspective_id = filterDto.perspectiveId;
    }

    if (filterDto.departmentId) {
      where.department_id = filterDto.departmentId;
    }

    if (filterDto.assignedToId) {
      where.assigned_to_id = filterDto.assignedToId;
    }

    if (filterDto.status) {
      where.status = filterDto.status;
    }

    // Add sorting
    if (filterDto.sortBy) {
      order[filterDto.sortBy] = filterDto.sortOrder || 'ASC'; // Default to ASC
    }

    return await this.kpisRepository.find({
      where,
      order,
      relations: [
        'assignedTo',
        'parent',
        'children',
        'children.assignedTo',
        'children.evaluations',
        'children.evaluations.evaluator',
        'children.evaluations.evaluatee',
        'children.values',
        'children.values.user',
        'perspective', // Thêm quan hệ mới
        'department',
        'section',
        'team',
        'evaluations',
        'evaluations.evaluator',
        'evaluations.evaluatee',
        'values',
        'values.user',
      ],
    });
  }

  async findOne(id: number): Promise<Kpi> {
    const value = await this.kpisRepository.findOne({
      where: { id },
      relations: [
        'assignedTo',
        'parent',
        'children',
        'children.assignedTo',
        'children.evaluations',
        'children.evaluations.evaluator',
        'children.evaluations.evaluatee',
        'children.values',
        'children.values.user',
        'perspective', // Thêm quan hệ mới
        'department',
        'section',
        'team',
        'evaluations',
        'evaluations.evaluator',
        'evaluations.evaluatee',
        'values',
        'values.user',
      ],
    });

    if (!value) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return value;
  }

  async create(
    kpi: Partial<Kpi> & { parent?: string; perspective?: string },
  ): Promise<Kpi> {
    if (!kpi.name || !kpi.unit || !kpi.target || !kpi.frequency) {
      throw new NotFoundException(
        'Missing required fields: name, unit, target, frequency',
      );
    }

    const targetNum = Number(kpi.target);
    const weightNum = Number(kpi.weight) || 0;

    // Lấy parent_id từ parent hoặc parent_id
    const parentId =
      kpi.parent_id || (kpi.parent ? Number(kpi.parent) : undefined);

    const parentKpi = parentId
      ? await this.kpisRepository.findOne({
          where: { id: parentId },
          relations: ['parent'],
        })
      : null;

    if (parentId && !parentKpi) {
      throw new NotFoundException(`Parent KPI with ID ${parentId} not found`);
    }

    // Lấy perspective_id từ perspective hoặc perspective_id
    const perspectiveId =
      kpi.perspective_id ||
      (kpi.perspective ? Number(kpi.perspective) : undefined);
    const perspectiveEntity = perspectiveId
      ? await this.perspectivesRepository.findOneBy({ id: perspectiveId })
      : null;
    if (perspectiveId && !perspectiveEntity) {
      throw new NotFoundException(
        `Perspective with ID ${perspectiveId} not found`,
      );
    }

    const assignedTo = kpi.assigned_to_id
      ? await this.usersRepository.findOneBy({ id: Number(kpi.assigned_to_id) })
      : null;
    if (kpi.assigned_to_id && !assignedTo) {
      throw new NotFoundException(
        `User with ID ${kpi.assigned_to_id} not found`,
      );
    }

    const newKpiData: Partial<Kpi> = {
      name: kpi.name,
      unit: kpi.unit,
      target: targetNum,
      weight: weightNum,
      frequency: kpi.frequency,
      description: kpi.description || '',
      parent: parentKpi || undefined,
      perspective: perspectiveEntity || undefined,
      assignedTo: assignedTo || undefined,
    };

    const newKpi = this.kpisRepository.create(newKpiData);
    const savedKpi = await this.kpisRepository.save(newKpi);

    // Tạo path thủ công nếu cần
    if (parentKpi && !savedKpi.path) {
      savedKpi.path = `${parentKpi.path}.${savedKpi.id}` as any;
      await this.kpisRepository.save(savedKpi);
    }

    const fullKpi = await this.kpisRepository.findOne({
      where: { id: savedKpi.id },
      relations: ['perspective', 'parent', 'assignedTo'],
    });

    if (!fullKpi) {
      throw new NotFoundException(
        `Failed to load saved KPI with ID ${savedKpi.id}`,
      );
    }

    return fullKpi;
  }

  async update(id: number, update: Partial<Kpi>): Promise<Kpi> {
    await this.kpisRepository.update(id, update);
    return this.findOne(id);
  }

  async softDelete(id: number): Promise<void> {
    await this.kpisRepository.softDelete(id);
  }

  async reassign(id: number, assignedToId: number): Promise<Kpi> {
    const kpi = await this.kpisRepository.findOne({ where: { id } });
    console.log('kpi', kpi);

    if (!kpi) {
      throw new HttpException('KPI not found', HttpStatus.NOT_FOUND);
    }
    const user = await this.usersRepository.findOne({
      where: { id: assignedToId },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    kpi.assigned_to_id = assignedToId;
    return await this.kpisRepository.save(kpi);
  }
}
