// /e/project/kpi-backend/src/reports/reports.controller.ts
import { Controller, Get, Res, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/guards/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('generate')
  async generateReport(
    @Query('reportType') reportType: string,
    @Query('fileFormat') fileFormat: string,
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
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
    const buffer = await this.reportsService.generateKpiReport(
      reportType,
      startDate,
      endDate,
      fileFormat,
    );
    res.send(buffer);
  }
}
