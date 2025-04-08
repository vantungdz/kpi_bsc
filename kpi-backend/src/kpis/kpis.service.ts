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
  FindOptionsWhere,
  IsNull,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm'; 
import { Kpi } from '../entities/kpi.entity';
import { KpiFilterDto } from './dto/filter-kpi.dto';
import { User } from 'src/entities/user.entity';
import { Perspective } from 'src/entities/perspective.entity';
import { Department } from 'src/entities/department.entity';

@Injectable()
export class KpisService {
  constructor(
    @InjectRepository(Kpi)
    private kpisRepository: Repository<Kpi>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Perspective)
    private perspectivesRepository: Repository<Perspective>,
    @InjectRepository(Perspective)
    private departmentsRepository: Repository<Department>,
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

  async findAll(filterDto: KpiFilterDto): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    const where: FindOptionsWhere<Kpi> = {
      deletedAt: IsNull(),
    };

    const { page = 1, limit = 15 } = filterDto;

    let order: any = {};

    if (filterDto.name) {
      // where.name = filterDto.name;
      where.name = ILike(`%${filterDto.name}%`);
    }

    if (filterDto.perspectiveId) {
      where.perspective_id = filterDto.perspectiveId;
    }

    if (filterDto.departmentId) {
      where.department_id = filterDto.departmentId;
    }

    if (filterDto.assignedToName) {
      where['assignedTo'] = [
        { first_name: ILike(`%${filterDto.assignedToName}%`) },
        { last_name: ILike(`%${filterDto.assignedToName}%`) },
      ];
    }

    if (filterDto.status) {
      where.status = filterDto.status;
    }

    if (filterDto.startDate) {
      where.start_date = MoreThanOrEqual(filterDto.startDate);
    }
    if (filterDto.endDate) {
      where.end_date = LessThanOrEqual(filterDto.endDate);
    }

    // Add sorting
    const validSortColumns = ['name'];

    if (filterDto.sortBy) {
      if (validSortColumns.includes(filterDto.sortBy)) {
        order[filterDto.sortBy] = filterDto.sortOrder || 'ASC';
      } else if (filterDto.sortBy === 'assignedToName') {
        order['assignedTo'] = {
          username: filterDto.sortOrder || 'ASC', // Or 'DESC' for descending order
        };
      }
    }

    const [data, totalItems] = await this.kpisRepository.findAndCount({
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
        'perspective',
        'department',
        'section',
        'team',
        'evaluations',
        'evaluations.evaluator',
        'evaluations.evaluatee',
        'values',
        'values.user',
      ],
      skip: (page - 1) * limit, // Bỏ qua các bản ghi đã có trong các trang trước
      take: limit, // Lấy số lượng bản ghi cho mỗi trang
    });

    const totalPages = Math.ceil(totalItems / limit);

    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalItems,
      itemsPerPage: limit,
    };

    return { data, pagination };
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

    const departmentId =
      kpi.department_id ||
      (kpi.department ? Number(kpi.department) : undefined);
    const departmentEntity = departmentId
      ? await this.departmentsRepository.findOneBy({ id: departmentId })
      : null;
    if (departmentId && !departmentEntity) {
      throw new NotFoundException(
        `Department with ID ${departmentId} not found`,
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
      relations: ['perspective', 'parent', 'assignedTo', 'department'],
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
