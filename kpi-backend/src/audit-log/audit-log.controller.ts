import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('audit-log')
@UseGuards(JwtAuthGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getLogs(
    @Query('userId') userId?: number,
    @Query('username') username?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.auditLogService.getLogs({
      userId,
      username,
      action,
      resource,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      skip,
      take,
    });
  }
}
