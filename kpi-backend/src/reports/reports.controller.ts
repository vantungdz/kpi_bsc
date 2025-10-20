// /e/project/kpi-backend/src/reports/reports.controller.ts
import { Controller, Get, Res, Query, UseGuards, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Response, Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermissionGuard } from 'src/common/rbac/permission.guard';
import { Permission } from 'src/common/rbac/permission.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('generate')
  @Permission('export', 'report', 'global')
  async generateReport(
    @Query('reportType') reportType: string,
    @Query('fileFormat') fileFormat: string,
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Req() req: Request & { user?: { id: number; username?: string } },
    @Res() res: Response,
  ) {
    let contentType =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    let fileExt = 'xlsx';
    if (fileFormat === 'csv') {
      contentType = 'text/csv';
      fileExt = 'csv';
    } else if (fileFormat === 'pdf') {
      contentType = 'application/pdf';
      fileExt = 'pdf';
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=kpi-report.${fileExt}`,
    );
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const buffer = await this.reportsService.generateKpiReport(
      reportType,
      startDate,
      endDate,
      fileFormat,
      req.user.id,
    );
    res.send(buffer);
  }
}
