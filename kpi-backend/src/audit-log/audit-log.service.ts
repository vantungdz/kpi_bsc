import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async logAction(params: {
    action: string;
    resource: string;
    userId?: number;
    username?: string;
    data?: any;
    ip?: string;
  }) {
    let { userId, username } = params;
    // If missing userId or username, try to get from request context (if available)
    // Priority: if userId exists but no username, automatically get username from DB
    if (!username && userId) {
      try {
        // Get Employee entity properly
        const employeeRepo = this.auditLogRepo.manager.getRepository('Employee');
        const employee = await employeeRepo.findOne({ where: { id: userId } });
        if (employee && employee.username) {
          username = employee.username;
        }
      } catch (e) {
        // ignore
      }
    }
    // If still missing userId or username, log as null (keep original behavior)
    const log = this.auditLogRepo.create({
      ...params,
      userId,
      username,
      createdAt: new Date(),
    });
    await this.auditLogRepo.save(log);
  }

  async getLogs(query: {
    userId?: number;
    username?: string;
    action?: string;
    resource?: string;
    fromDate?: Date;
    toDate?: Date;
    skip?: number;
    take?: number;
  }) {
    const qb = this.auditLogRepo.createQueryBuilder('log');
    if (query.userId) qb.andWhere('log.userId = :userId', { userId: query.userId });
    if (query.username) qb.andWhere('LOWER(log.username) LIKE :username', { username: `%${query.username.toLowerCase()}%` });
    if (query.action) qb.andWhere('LOWER(log.action) LIKE :action', { action: `%${query.action.toLowerCase()}%` });
    if (query.resource) qb.andWhere('LOWER(log.resource) LIKE :resource', { resource: `%${query.resource.toLowerCase()}%` });
    if (query.fromDate) qb.andWhere('log.createdAt >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate) qb.andWhere('log.createdAt <= :toDate', { toDate: query.toDate });
    qb.orderBy('log.createdAt', 'DESC');
    if (query.skip) qb.skip(query.skip);
    if (query.take) qb.take(query.take);
    return qb.getMany();
  }
}
