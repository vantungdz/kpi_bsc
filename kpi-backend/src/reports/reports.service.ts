// /e/project/kpi-backend/src/reports/reports.service.ts
import { Injectable } from '@nestjs/common';
import * as Excel from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import { Kpi, KpiDefinitionStatus } from 'src/entities/kpi.entity';
import { KpisService } from '../kpis/kpis.service';
import { EmployeesService } from 'src/employees/employees.service';
import { renderKpiPerformancePieChart } from './kpi-performance-chart.util';
import { DashboardsService } from '../dashboard/dashboard.service';
import { StrategicObjectivesService } from '../strategic-objectives/strategic-objectives.service';
import { KpiValuesService } from '../kpi-values/kpi-values.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly kpisService: KpisService,
    private readonly employeesService: EmployeesService,
    private readonly dashboardsService: DashboardsService,
    private readonly strategicObjectivesService: StrategicObjectivesService, // Inject chuẩn
    private readonly kpiValuesService: KpiValuesService, // Inject chuẩn
  ) {}

  async generateKpiReport(
    reportType: string,
    startDate?: Date,
    endDate?: Date,
    fileFormat: string = 'excel',
  ): Promise<Buffer> {
    // Always fetch admin user for permissioned KPI queries
    const adminUser = await this.employeesService['employeeRepository']
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.roles', 'role')
      .where('role.name = :roleName', { roleName: 'admin' })
      .getOne();
    if (!adminUser) {
      throw new Error('No admin user found for KPI report.');
    }
    const adminUserId = adminUser.id;

    if (fileFormat === 'pdf') {
      // Lấy dữ liệu KPI
      const kpiSummaryData = await this.kpisService.findAll({}, adminUserId);
      // Tạo PDF
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {});
      // Nhúng font Unicode (DejaVuSans.ttf) để hỗ trợ tiếng Việt
      let fontPath = __dirname + '/../../public/font/DejaVuSans.ttf';
      if (fs.existsSync(fontPath)) {
        doc.registerFont('dejavu', fontPath);
        doc.font('dejavu');
      }
      // Logo (nếu có file logo.png trong public)
      try {
        doc.image(__dirname + '/../../public/logo.png', 40, 20, { width: 80 });
      } catch {}
      doc.fontSize(20).text('KPI Report', { align: 'center' });
      doc.moveDown();

      // Helper format
      const formatNumber = (val: any) => {
        if (val === null || val === undefined || val === '') return '';
        const num = Number(val);
        if (isNaN(num)) return val;
        return num
          .toLocaleString('vi-VN', { maximumFractionDigits: 2 })
          .replace(/\,00$/, '');
      };

      // --- Tổng quan ---
      if (reportType === 'kpi-summary' || reportType === 'all') {
        doc.addPage();
        doc.fontSize(16).text('Tổng quan KPI', { align: 'center' });
        doc.moveDown();
        const tableTop = doc.y;
        const colWidths = [160, 80, 80, 100, 100];
        const headers = [
          'Tên KPI',
          'Mục tiêu',
          'Kết quả',
          'Tỷ lệ hoàn thành',
          'Trạng thái',
        ];
        let x = 40;
        doc.fontSize(12).fillColor('#333');
        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, {
            width: colWidths[i],
            align: 'center',
          });
          x += colWidths[i];
        });
        let y = tableTop + 24;
        const rowPadding = 6;
        kpiSummaryData.data.forEach((kpi: any) => {
          x = 40;
          let completionRate = '0%';
          if (kpi.target && kpi.target > 0) {
            let rate = (kpi.actual_value / kpi.target) * 100;
            if (rate < 0) rate = 0;
            completionRate = rate.toFixed(2) + '%';
          }
          const row = [
            kpi.name,
            formatNumber(kpi.target),
            formatNumber(kpi.actual_value),
            completionRate,
            kpi.status || '',
          ];
          let maxCellHeight = 0;
          row.forEach((cell, i) => {
            const cellHeight = doc.heightOfString(cell, {
              width: colWidths[i],
              align: 'center',
            });
            if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
          });
          x = 40;
          row.forEach((cell, i) => {
            doc
              .fontSize(11)
              .fillColor('#000')
              .text(cell, x, y, { width: colWidths[i], align: 'center' });
            x += colWidths[i];
          });
          y += maxCellHeight + rowPadding;
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 40;
          }
        });
      }

      // --- Chi tiết ---
      if (reportType === 'kpi-details' || reportType === 'all') {
        doc.addPage();
        doc.fontSize(16).text('Chi tiết KPI', { align: 'center' });
        doc.moveDown();
        const tableTop = doc.y;
        const colWidths = [
          40, 120, 120, 60, 60, 70, 70, 70, 60, 60, 80, 80, 80,
        ];
        const headers = [
          'ID',
          'Name',
          'Description',
          'Unit',
          'Frequency',
          'Start Date',
          'End Date',
          'Created By',
          'Type',
          'Weight',
          'Target',
          'Actual Value',
          'Status',
        ];
        let x = 40;
        doc.fontSize(10).fillColor('#333');
        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, {
            width: colWidths[i],
            align: 'center',
          });
          x += colWidths[i];
        });
        let y = tableTop + 20;
        const rowPadding = 4;
        const kpiDetailsData = await this.kpisService.findAll({}, adminUserId);
        kpiDetailsData.data.forEach((kpi: any) => {
          x = 40;
          const row = [
            kpi.id,
            kpi.name,
            kpi.description,
            kpi.unit,
            kpi.frequency,
            kpi.start_date,
            kpi.end_date,
            kpi.created_by_type,
            kpi.type,
            kpi.weight,
            formatNumber(kpi.target),
            formatNumber(kpi.actual_value),
            kpi.status,
          ];
          let maxCellHeight = 0;
          row.forEach((cell, i) => {
            const cellHeight = doc.heightOfString(cell ? cell.toString() : '', {
              width: colWidths[i],
              align: 'center',
            });
            if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
          });
          x = 40;
          row.forEach((cell, i) => {
            doc
              .fontSize(9)
              .fillColor('#000')
              .text(cell ? cell.toString() : '', x, y, {
                width: colWidths[i],
                align: 'center',
              });
            x += colWidths[i];
          });
          y += maxCellHeight + rowPadding;
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 40;
          }
        });
      }

      // --- So sánh ---
      if (reportType === 'kpi-comparison' || reportType === 'all') {
        doc.addPage();
        doc.fontSize(16).text('So sánh KPI', { align: 'center' });
        doc.moveDown();
        const tableTop = doc.y;
        const colWidths = [100, 120, 80, 80, 100];
        const headers = [
          'Department',
          'KPI',
          'Target',
          'Actual Value',
          'Completion Rate',
        ];
        let x = 40;
        doc.fontSize(11).fillColor('#333');
        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, {
            width: colWidths[i],
            align: 'center',
          });
          x += colWidths[i];
        });
        let y = tableTop + 20;
        const rowPadding = 4;
        // Luôn đảm bảo comparisonData là { data: any[] }
        let comparisonData: { data: any[] } = { data: [] };
        if (
          typeof (this.kpisService as any).getKpiComparisonData === 'function'
        ) {
          comparisonData = await (this.kpisService as any).getKpiComparisonData(
            adminUserId,
          );
        } else {
          // Dùng dữ liệu tổng quan để giả lập
          const kpiSummaryData = await this.kpisService.findAll(
            {},
            adminUserId,
          );
          comparisonData.data = (kpiSummaryData.data || []).map((k: any) => ({
            department_name: k.department_name || 'Phòng ban A',
            kpi_name: k.name,
            target: k.target,
            actual_value: k.actual_value,
          }));
        }
        (comparisonData.data || []).forEach((item: any) => {
          x = 40;
          let completionRate = '0%';
          if (item.target && item.target > 0) {
            let rate = (item.actual_value / item.target) * 100;
            if (rate < 0) rate = 0;
            completionRate = rate.toFixed(2) + '%';
          }
          const row = [
            item.department_name || '',
            item.kpi_name || '',
            formatNumber(item.target),
            formatNumber(item.actual_value),
            completionRate,
          ];
          let maxCellHeight = 0;
          row.forEach((cell, i) => {
            const cellHeight = doc.heightOfString(cell ? cell.toString() : '', {
              width: colWidths[i],
              align: 'center',
            });
            if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
          });
          x = 40;
          row.forEach((cell, i) => {
            doc
              .fontSize(10)
              .fillColor('#000')
              .text(cell ? cell.toString() : '', x, y, {
                width: colWidths[i],
                align: 'center',
              });
            x += colWidths[i];
          });
          y += maxCellHeight + rowPadding;
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 40;
          }
        });
      }

      if (reportType === 'dashboard-multi') {
        // Lấy user admin đầu tiên để truyền vào DashboardsService
        const adminUser = await this.employeesService['employeeRepository']
          .createQueryBuilder('employee')
          .leftJoinAndSelect('employee.roles', 'role')
          .where('role.name = :roleName', { roleName: 'admin' })
          .getOne();
        if (!adminUser) {
          throw new Error('No admin user found for dashboard report.');
        }
        // 1. KPI chờ duyệt
        const awaitingStats =
          await this.dashboardsService.getKpiAwaitingApprovalStats(adminUser);
        doc.addPage();
        doc.fontSize(18).text('THỐNG KÊ KPI CHỜ DUYỆT', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Tổng số KPI chờ duyệt: ${awaitingStats.total}`);
        doc.moveDown(0.5);
        if (awaitingStats.byLevel && awaitingStats.byLevel.length > 0) {
          const tableColWidths = [200, 120, 220]; // Tăng width các cột
          const colPadding = 10; // Padding giữa các cột
          let y = doc.y;
          const headers = ['Cấp duyệt', 'Số lượng', 'Trạng thái'];
          let x = doc.x;
          headers.forEach((header, i) => {
            doc
              .font('dejavu')
              .fontSize(11)
              .fillColor('#0050b3')
              .text(header, x, y, {
                width: tableColWidths[i],
                align: i === 1 ? 'right' : 'left',
              });
            x += tableColWidths[i] + colPadding;
          });
          y += 18;
          const chartLabels: string[] = [];
          const chartData: number[] = [];
          awaitingStats.byLevel.forEach((row) => {
            x = doc.x;
            const cells = [row.name, row.count, row.status];
            let maxCellHeight = 0;
            cells.forEach((cell, i) => {
              const cellHeight = doc.heightOfString(
                cell ? cell.toString() : '',
                { width: tableColWidths[i], align: i === 1 ? 'right' : 'left' },
              );
              if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
            });
            x = doc.x;
            cells.forEach((cell, i) => {
              doc
                .font('dejavu')
                .fontSize(10)
                .fillColor('black')
                .text(cell.toString(), x, y, {
                  width: tableColWidths[i],
                  align: i === 1 ? 'right' : 'left',
                });
              x += tableColWidths[i] + colPadding;
            });
            chartLabels.push(row.name);
            chartData.push(row.count);
            y += maxCellHeight + 4; // padding 4px
            doc.x = 40;
            doc.y = y;
            if (y > doc.page.height - 60) {
              doc.addPage();
              y = doc.y;
            }
          });
          // Sau bảng, đảm bảo xuống dòng
          y += 10;
          doc.x = 40;
          doc.y = y;
          // Thêm biểu đồ Bar chart cho KPI chờ duyệt
          if (chartData.some((v) => v > 0)) {
            const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
            const chartJSNodeCanvas = new ChartJSNodeCanvas({
              width: 500,
              height: 250,
              backgroundColour: 'white',
            });
            const chartConfig = {
              type: 'bar',
              data: {
                labels: chartLabels,
                datasets: [
                  {
                    label: 'Số lượng KPI chờ duyệt',
                    data: chartData,
                    backgroundColor: ['#1890ff', '#faad14', '#cf1322'],
                  },
                ],
              },
              options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
              },
            };
            const barBuffer =
              await chartJSNodeCanvas.renderToBuffer(chartConfig);
            doc.moveDown(1);
            doc
              .fontSize(12)
              .text('Biểu đồ số lượng KPI chờ duyệt theo cấp duyệt:', {
                align: 'left',
              });
            doc.moveDown(0.2);
            doc.image(barBuffer, {
              fit: [400, 180],
              align: 'center',
              valign: 'center',
            });
            doc.moveDown(2); // Tạo khoảng cách lớn hơn trước section tiếp theo
          } else {
            doc.moveDown(2);
          }
        } else {
          doc.moveDown(2);
        }
        // 2. KPI đã duyệt/từ chối 7 ngày qua
        const statusStats =
          await this.dashboardsService.getKpiStatusOverTimeStats(adminUser, 7);
        doc.addPage();
        doc.fontSize(18).text('THỐNG KÊ KPI ĐÃ DUYỆT/TỪ CHỐI (7 ngày qua)', {
          align: 'center',
        });
        doc.moveDown();
        doc
          .fontSize(12)
          .fillColor('#3f8600')
          .text(`KPI đã duyệt: ${statusStats.approvedLastXDays}`);
        doc
          .fontSize(12)
          .fillColor('#cf1322')
          .text(`KPI bị từ chối: ${statusStats.rejectedLastXDays}`);
        doc.fillColor('black');
        // Thêm biểu đồ Pie chart cho KPI đã duyệt/từ chối
        const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
        const chartJSNodeCanvas2 = new ChartJSNodeCanvas({
          width: 400,
          height: 220,
          backgroundColour: 'white',
        });
        const pieConfig = {
          type: 'pie',
          data: {
            labels: ['Đã duyệt', 'Từ chối'],
            datasets: [
              {
                data: [
                  statusStats.approvedLastXDays,
                  statusStats.rejectedLastXDays,
                ],
                backgroundColor: ['#52c41a', '#f5222d'],
              },
            ],
          },
          options: {
            plugins: { legend: { position: 'top' } },
          },
        };
        const pieBuffer = await chartJSNodeCanvas2.renderToBuffer(pieConfig);
        doc.moveDown(1);
        doc
          .fontSize(12)
          .text('Biểu đồ KPI đã duyệt/từ chối:', { align: 'left' });
        doc.moveDown(0.2);
        doc.image(pieBuffer, {
          fit: [300, 150],
          align: 'center',
          valign: 'center',
        });
        doc.moveDown(2);
        // 3. Thời gian duyệt trung bình
        const avgTimeStats =
          await this.dashboardsService.getAverageApprovalTimeStats(adminUser);
        doc.addPage();
        doc
          .fontSize(18)
          .text('THỐNG KÊ THỜI GIAN DUYỆT KPI TRUNG BÌNH', { align: 'center' });
        doc.moveDown();
        doc
          .fontSize(12)
          .text(
            `Thời gian duyệt trung bình (tất cả cấp): ${avgTimeStats.totalAverageTime ?? 'N/A'} ngày`,
          );
        doc.moveDown(0.5);
        if (avgTimeStats.byLevel && avgTimeStats.byLevel.length > 0) {
          const tableColWidths = [220, 120];
          let y = doc.y;
          const headers = ['Cấp duyệt', 'Thời gian trung bình (ngày)'];
          let x = doc.x;
          headers.forEach((header, i) => {
            doc
              .font('dejavu')
              .fontSize(11)
              .fillColor('#0050b3')
              .text(header, x, y, {
                width: tableColWidths[i],
                align: 'center',
              });
            x += tableColWidths[i];
          });
          y += 18;
          avgTimeStats.byLevel.forEach((row) => {
            x = doc.x;
            const cells = [row.name, row.averageTime ?? 'N/A'];
            cells.forEach((cell, i) => {
              doc
                .font('dejavu')
                .fontSize(10)
                .fillColor('black')
                .text(cell.toString(), x, y, {
                  width: tableColWidths[i],
                  align: 'center',
                });
              x += tableColWidths[i];
            });
            y += 16;
            doc.x = 40;
            doc.y = y;
            if (y > doc.page.height - 60) {
              doc.addPage();
              y = doc.y;
            }
          });
          // Sau bảng cuối cùng, tạo khoảng cách cuối section
          y += 10;
          doc.x = 40;
          doc.y = y;
          doc.moveDown(2);
        } else {
          doc.moveDown(2);
        }
      }

      doc.end();
      return await new Promise<Buffer>((resolve) => {
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });
      });
    }

    const workbook = new Excel.Workbook();

    // Helper để chuẩn hóa dữ liệu dòng Excel (an toàn cho Excel)
    function normalizeRow(row: any[], colCount: number): any[] {
      // Regex loại bỏ ký tự control, surrogate, ngoài BMP, emoji
      const INVALID_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uD800-\uDFFF\u{10000}-\u{10FFFF}]/gu;
      return row
        .map((v) => {
          if (v === undefined || v === null) return '';
          if (typeof v === 'number') {
            if (!isFinite(v) || isNaN(v)) return '';
            return v;
          }
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          if (Array.isArray(v)) return v.map(x => (x && x.name) ? x.name : (x && x.id) ? x.id : String(x)).join(', ');
          if (typeof v === 'object') {
            if ('name' in v && typeof v.name === 'string') return v.name;
            if ('id' in v) return String(v.id);
            return '';
          }
          // Loại bỏ ký tự control, surrogate, ngoài BMP, emoji
          return String(v).replace(INVALID_CHAR_REGEX, '');
        })
        .slice(0, colCount);
    }
    // Helper log lỗi khi addRow
    function logExcelRowError(sheet: string, rowIdx: number, row: any[], error: any) {
      const fs = require('fs');
      const logMsg = `[${new Date().toISOString()}] Sheet: ${sheet}, Row: ${rowIdx}, Data: ${JSON.stringify(row)}, Error: ${error?.message || error}\n`;
      fs.appendFileSync('excel-row-error.log', logMsg);
    }

    // --- Tổng quan ---
    if (reportType === 'kpi-summary' || reportType === 'all') {
      const summarySheet = workbook.addWorksheet('KPI Summary');
      const headers = [
        'KPI Name',
        'Target',
        'Actual Value',
        'Completion Rate',
        'Status',
      ];
      summarySheet.addRow(headers);
      const kpiSummaryData = await this.kpisService.findAll({}, adminUserId);
      let rowIdx = 2;
      kpiSummaryData.data.forEach((kpi: Kpi) => {
        const formatNumber = (val: any) => {
          if (val === null || val === undefined || val === '') return '';
          const num = Number(val);
          if (isNaN(num)) return val;
          return num
            .toLocaleString('vi-VN', { maximumFractionDigits: 2 })
            .replace(/\,00$/, '');
        };
        let completionRate = '0%';
        if (
          kpi.target &&
          kpi.target > 0 &&
          kpi.actual_value !== null &&
          kpi.actual_value !== undefined
        ) {
          let rate = (Number(kpi.actual_value) / Number(kpi.target)) * 100;
          if (rate < 0) rate = 0;
          completionRate = rate.toFixed(2) + '%';
        }
        const row = [
          kpi.name,
          formatNumber(kpi.target),
          formatNumber(kpi.actual_value),
          completionRate,
          kpi.status,
        ];
        try {
          summarySheet.addRow(normalizeRow(row, headers.length));
        } catch (err) {
          logExcelRowError('Tổng quan KPI', rowIdx, row, err);
        }
        rowIdx++;
      });
      formatWorksheet(summarySheet);
    }
    // --- Chi tiết ---
    if (reportType === 'kpi-details' || reportType === 'all') {
      const detailsSheet = workbook.addWorksheet('KPI Details');
      const headers = [
        'ID',
        'Name',
        'Description',
        'Unit',
        'Frequency',
        'Start Date',
        'End Date',
        'Created By',
        'Type',
        'Weight',
        'Target',
        'Actual Value',
        'Status',
      ];
      detailsSheet.addRow(headers);
      const kpiDetailsData = await this.kpisService.findAll({}, adminUserId);
      let rowIdx = 2;
      kpiDetailsData.data.forEach((kpi: Kpi) => {
        const formatNumber = (val: any) => {
          if (val === null || val === undefined || val === '') return '';
          const num = Number(val);
          if (isNaN(num)) return val;
          return num
            .toLocaleString('vi-VN', { maximumFractionDigits: 2 })
            .replace(/\,00$/, '');
        };
        const row = [
          kpi.id,
          kpi.name,
          kpi.description,
          kpi.unit,
          kpi.frequency,
          kpi.start_date,
          kpi.end_date,
          kpi.created_by_type,
          kpi.type,
          kpi.weight,
          formatNumber(kpi.target),
          formatNumber(kpi.actual_value),
          kpi.status,
        ];
        try {
          detailsSheet.addRow(normalizeRow(row, headers.length));
        } catch (err) {
          logExcelRowError('Chi tiết KPI', rowIdx, row, err);
        }
        rowIdx++;
      });
      formatWorksheet(detailsSheet);
    }
    // --- So sánh ---
    if (reportType === 'kpi-comparison' || reportType === 'all') {
      const comparisonSheet = workbook.addWorksheet('KPI Comparison');
      const headers = [
        'Department',
        'KPI',
        'Target',
        'Actual Value',
        'Completion Rate',
      ];
      comparisonSheet.addRow(headers);
      let comparisonData: { data: any[] } = { data: [] };
      if (
        typeof (this.kpisService as any).getKpiComparisonData === 'function'
      ) {
        comparisonData = await (this.kpisService as any).getKpiComparisonData(
          adminUserId,
        );
      } else {
        const kpiSummaryData = await this.kpisService.findAll({}, adminUserId);
        comparisonData.data = (kpiSummaryData.data || []).map((k: any) => ({
          department_name: k.department_name,
          kpi_name: k.name,
          target: k.target,
          actual_value: k.actual_value,
        }));
      }
      let rowIdx = 2;
      (comparisonData.data || []).forEach((item: any) => {
        const formatNumber = (val: any) => {
          if (val === null || val === undefined || val === '') return '';
          const num = Number(val);
          if (isNaN(num)) return val;
          return num
            .toLocaleString('vi-VN', { maximumFractionDigits: 2 })
            .replace(/\,00$/, '');
        };
        let completionRate = '0%';
        if (
          item.target &&
          item.target > 0 &&
          item.actual_value !== null &&
          item.actual_value !== undefined
        ) {
          let rate = (Number(item.actual_value) / Number(item.target)) * 100;
          if (rate < 0) rate = 0;
          completionRate = rate.toFixed(2) + '%';
        }
        const row = [
          item.department_name || '',
          item.kpi_name || '',
          formatNumber(item.target),
          formatNumber(item.actual_value),
          completionRate,
        ];
        try {
          comparisonSheet.addRow(normalizeRow(row, headers.length));
        } catch (err) {
          logExcelRowError('So sánh KPI', rowIdx, row, err);
        }
        rowIdx++;
      });
      formatWorksheet(comparisonSheet);
    }
    // --- KPI chờ phê duyệt ---
    if (reportType === 'kpi-awaiting-approval') {
      const sheet = workbook.addWorksheet('KPI Awaiting Approval');
      const headers = ['Approval Level', 'Count', 'Status'];
      sheet.addRow(headers);
      const stats = await this.dashboardsService.getKpiAwaitingApprovalStats(adminUser);
      let rowIdx = 2;
      (stats.byLevel || []).forEach(row => {
        const rowData = [row.name, row.count, row.status];
        try {
          sheet.addRow(normalizeRow(rowData, headers.length));
        } catch (err) {
          logExcelRowError('KPI chờ phê duyệt', rowIdx, rowData, err);
        }
        rowIdx++;
      });
      formatWorksheet(sheet);
    }
    // --- Hiệu suất nhân viên ---
    if (reportType === 'employee-performance') {
      const sheet = workbook.addWorksheet('Employee Performance');
      const headers = ['Employee', 'Department', 'KPI Count', 'Avg. Completion Rate'];
      sheet.addRow(headers);
      const employees = await this.employeesService.findAll();
      let rowIdx = 2;
      for (const emp of employees) {
        const allKpis = await this.kpisService.findAll({}, adminUserId);
        const filteredKpis = (allKpis.data || []).filter((k: any) =>
          k.assignments?.some((a: any) => a.employee?.id === emp.id)
        ) as Kpi[];
        let totalKpi = filteredKpis.length;
        let avgRate = '0%';
        if (filteredKpis.length > 0) {
          let sumRate = 0;
          let count = 0;
          for (const k of filteredKpis) {
            if (k.target && k.target > 0 && k.actual_value !== null && k.actual_value !== undefined) {
              let rate = (Number(k.actual_value) / Number(k.target)) * 100;
              if (rate < 0) rate = 0;
              sumRate += rate;
              count++;
            }
          }
          avgRate = count > 0 ? (sumRate / count).toFixed(2) + '%' : '0%';
        }
        const empName = (emp.first_name && emp.last_name) ? `${emp.first_name} ${emp.last_name}` : emp.username;
        const deptName = emp.department?.name || '';
        const row = [empName, deptName, totalKpi, avgRate];
        try {
          sheet.addRow(normalizeRow(row, headers.length));
        } catch (err) {
          logExcelRowError('Hiệu suất nhân viên', rowIdx, row, err);
        }
        rowIdx++;
      }
      formatWorksheet(sheet);
    }
    // --- Mục tiêu chiến lược ---
    if (reportType === 'strategic-objectives') {
      const sheet = workbook.addWorksheet('Strategic Objectives');
      const headers = ['Objective Name', 'Duration', 'Status', 'Linked KPIs', 'Progress'];
      sheet.addRow(headers);
      const list = await this.strategicObjectivesService.findAll();
      let rowIdx = 2;
      for (const obj of list) {
        const row = [
          obj.name,
          `${obj.start_date || ''} - ${obj.end_date || ''}`,
          obj.is_active ? 'Đang thực hiện' : 'Ngừng',
          (obj.kpis || []).map(k => k.name).join(', '),
          (typeof obj.progress !== 'undefined' ? obj.progress + '%' : ''),
        ];
        try {
          sheet.addRow(normalizeRow(row, headers.length));
        } catch (err) {
          logExcelRowError('Mục tiêu chiến lược', rowIdx, row, err);
        }
        rowIdx++;
      }
      formatWorksheet(sheet);
    }
    // --- Tiến độ cập nhật KPI ---
    if (reportType === 'kpi-update-progress') {
      const sheet = workbook.addWorksheet('KPI Update Progress');
      const headers = ['KPI', 'Department', 'Last Update', 'Update Status'];
      sheet.addRow(headers);
      const allKpis = await this.kpisService.findAll({}, adminUserId);
      const now = new Date();
      let rowIdx = 2;
      for (const kpi of allKpis.data || []) {
        let lastUpdated = kpi.updated_at ? new Date(kpi.updated_at) : null;
        let isUpdated = false;
        if (lastUpdated) {
          const diffDays = (now.getTime() - lastUpdated.getTime()) / (1000 * 3600 * 24);
          isUpdated = diffDays <= 30;
        }
        let deptName = '';
        if (kpi.assignments && kpi.assignments.length > 0 && kpi.assignments[0].department) {
          deptName = kpi.assignments[0].department.name;
        }
        const row = [
          kpi.name,
          deptName,
          kpi.updated_at || '',
          isUpdated ? 'Đã cập nhật' : 'Chưa cập nhật',
        ];
        try {
          sheet.addRow(normalizeRow(row, headers.length));
        } catch (err) {
          logExcelRowError('Tiến độ cập nhật KPI', rowIdx, row, err);
        }
        rowIdx++;
      }
      formatWorksheet(sheet);
    }
    // --- Lịch sử cập nhật KPI ---
    if (reportType === 'kpi-history') {
      const sheet = workbook.addWorksheet('KPI Update History');
      const headers = ['KPI', 'Update Date', 'Updated By', 'New Value', 'Notes'];
      sheet.addRow(headers);
      const allKpis = await this.kpisService.findAll({}, adminUserId);
      let rowIdx = 2;
      for (const kpi of allKpis.data || []) {
        if (kpi.id) {
          const histories = await this.kpiValuesService.getHistory?.(kpi.id);
          for (const h of histories || []) {
            let updater = h.changedByUser ? ((h.changedByUser.first_name && h.changedByUser.last_name) ? `${h.changedByUser.first_name} ${h.changedByUser.last_name}` : h.changedByUser.username) : h.changed_by;
            const row = [
              kpi.name,
              h.timestamp,
              updater,
              h.value,
              h.notes,
            ];
            try {
              sheet.addRow(normalizeRow(row, headers.length));
            } catch (err) {
              logExcelRowError('Lịch sử cập nhật KPI', rowIdx, row, err);
            }
            rowIdx++;
          }
        }
      }
      formatWorksheet(sheet);
    }

    // Chuẩn hóa dữ liệu cho từng loại báo cáo
    async function getReportData(reportType: string, adminUserId: number, adminUser: any) {
      switch (reportType) {
        case 'kpi-summary': {
          const kpiSummaryData = await this.kpisService.findAll({}, adminUserId);
          const summaryHeaders = ['KPI Name', 'Target', 'Actual Value', 'Completion Rate', 'Status'];
          const summaryRows = (kpiSummaryData.data || []).map((kpi: any) => {
            let completionRate = '0%';
            if (kpi.target && kpi.target > 0 && kpi.actual_value !== null && kpi.actual_value !== undefined) {
              let rate = (Number(kpi.actual_value) / Number(kpi.target)) * 100;
              if (rate < 0) rate = 0;
              completionRate = rate.toFixed(2) + '%';
            }
            return [
              kpi.name,
              kpi.target,
              kpi.actual_value,
              completionRate,
              kpi.status,
            ];
          });
          return { headers: summaryHeaders, rows: summaryRows };
        }
        case 'kpi-details': {
          const kpiDetailsData = await this.kpisService.findAll({}, adminUserId);
          const detailsHeaders = ['ID', 'Name', 'Description', 'Unit', 'Frequency', 'Start Date', 'End Date', 'Created By', 'Type', 'Weight', 'Target', 'Actual Value', 'Status'];
          const detailsRows = (kpiDetailsData.data || []).map((kpi: any) => [
            kpi.id,
            kpi.name,
            kpi.description,
            kpi.unit,
            kpi.frequency,
            kpi.start_date,
            kpi.end_date,
            kpi.created_by_type,
            kpi.type,
            kpi.weight,
            kpi.target,
            kpi.actual_value,
            kpi.status,
          ]);
          return { headers: detailsHeaders, rows: detailsRows };
        }
        case 'kpi-comparison': {
          let comparisonData: { data: any[] } = { data: [] };
          if (typeof (this.kpisService as any).getKpiComparisonData === 'function') {
            comparisonData = await (this.kpisService as any).getKpiComparisonData(adminUserId);
          } else {
            const kpiSummaryData = await this.kpisService.findAll({}, adminUserId);
            comparisonData.data = (kpiSummaryData.data || []).map((k: any) => ({
              department_name: k.department_name || 'Phòng ban A',
              kpi_name: k.name,
              target: k.target,
              actual_value: k.actual_value,
            }));
          }
          const comparisonHeaders = ['Department', 'KPI', 'Target', 'Actual Value', 'Completion Rate'];
          const comparisonRows = (comparisonData.data || []).map((item: any) => {
            let completionRate = '0%';
            if (item.target && item.target > 0 && item.actual_value !== null && item.actual_value !== undefined) {
              let rate = (Number(item.actual_value) / Number(item.target)) * 100;
              if (rate < 0) rate = 0;
              completionRate = rate.toFixed(2) + '%';
            }
            return [
              item.department_name || '',
              item.kpi_name || '',
              item.target,
              item.actual_value,
              completionRate,
            ];
          });
          return { headers: comparisonHeaders, rows: comparisonRows };
        }
        case 'kpi-awaiting-approval': {
          const stats = await this.dashboardsService.getKpiAwaitingApprovalStats(adminUser);
          const awaitingHeaders = ['Approval Level', 'Count', 'Status'];
          const awaitingRows = (stats.byLevel || []).map(row => [row.name, row.count, row.status]);
          return { headers: awaitingHeaders, rows: awaitingRows };
        }
        case 'employee-performance': {
          const employees = await this.employeesService.findAll();
          const empHeaders = ['Employee', 'Department', 'KPI Count', 'Avg. Completion Rate'];
          const allKpis = await this.kpisService.findAll({}, adminUserId);
          const empRows = employees.map(emp => {
            const filteredKpis = (allKpis.data || []).filter((k: any) => k.assignments?.some((a: any) => a.employee?.id === emp.id));
            let totalKpi = filteredKpis.length;
            let avgRate = '0%';
            if (filteredKpis.length > 0) {
              let sumRate = 0;
              let count = 0;
              for (const k of filteredKpis) {
                if (k.target && k.target > 0 && k.actual_value !== null && k.actual_value !== undefined) {
                  let rate = (Number(k.actual_value) / Number(k.target)) * 100;
                  if (rate < 0) rate = 0;
                  sumRate += rate;
                  count++;
                }
              }
              avgRate = count > 0 ? (sumRate / count).toFixed(2) + '%' : '0%';
            }
            const empName = (emp.first_name && emp.last_name) ? `${emp.first_name} ${emp.last_name}` : emp.username;
            const deptName = emp.department?.name || '';
            return [empName, deptName, totalKpi, avgRate];
          });
          return { headers: empHeaders, rows: empRows };
        }
        case 'strategic-objectives': {
          const list = await this.strategicObjectivesService.findAll();
          const soHeaders = ['Objective Name', 'Duration', 'Status', 'Linked KPIs', 'Progress'];
          const soRows = list.map(obj => [
            obj.name,
            `${obj.start_date || ''} - ${obj.end_date || ''}`,
            obj.is_active ? 'Đang thực hiện' : 'Ngừng',
            (obj.kpis || []).map(k => k.name).join(', '),
            (typeof obj.progress !== 'undefined' ? obj.progress + '%' : ''),
          ]);
          return { headers: soHeaders, rows: soRows };
        }
        case 'kpi-update-progress': {
          const allKpis2 = await this.kpisService.findAll({}, adminUserId);
          const now = new Date();
          const updateHeaders = ['KPI', 'Department', 'Last Update', 'Update Status'];
          const updateRows = (allKpis2.data || []).map(kpi => {
            let lastUpdated = kpi.updated_at ? new Date(kpi.updated_at) : null;
            let isUpdated = false;
            if (lastUpdated) {
              const diffDays = (now.getTime() - lastUpdated.getTime()) / (1000 * 3600 * 24);
              isUpdated = diffDays <= 30;
            }
            let deptName = '';
            if (kpi.assignments && kpi.assignments.length > 0 && kpi.assignments[0].department) {
              deptName = kpi.assignments[0].department.name;
            }
            return [
              kpi.name,
              deptName,
              kpi.updated_at || '',
              isUpdated ? 'Đã cập nhật' : 'Chưa cập nhật',
            ];
          });
          return { headers: updateHeaders, rows: updateRows };
        }
        case 'kpi-history': {
          const allKpis3 = await this.kpisService.findAll({}, adminUserId);
          const historyHeaders = ['KPI', 'Update Date', 'Updated By', 'New Value', 'Notes'];
          const historyRows: any[][] = [];
          for (const kpi of allKpis3.data || []) {
            if (kpi.id) {
              const histories = await this.kpiValuesService.getHistory?.(kpi.id);
              for (const h of histories || []) {
                let updater = h.changedByUser ? ((h.changedByUser.first_name && h.changedByUser.last_name) ? `${h.changedByUser.first_name} ${h.changedByUser.last_name}` : h.changedByUser.username) : h.changed_by;
                historyRows.push([
                  kpi.name,
                  h.timestamp,
                  updater,
                  h.value,
                  h.notes,
                ]);
              }
            }
          }
          return { headers: historyHeaders, rows: historyRows };
        }
        case 'dashboard-multi': {
          const awaitingStats = await this.dashboardsService.getKpiAwaitingApprovalStats(adminUser);
          const statusStats = await this.dashboardsService.getKpiStatusOverTimeStats(adminUser, 7);
          const avgTimeStats = await this.dashboardsService.getAverageApprovalTimeStats(adminUser);
          const dashboardSheets = [
            {
              name: 'KPI Awaiting Approval',
              headers: ['Approval Level', 'Count', 'Status'],
              rows: (awaitingStats.byLevel || []).map(row => [row.name, row.count, row.status]),
            },
            {
              name: 'KPI Approved/Rejected 7 Days',
              headers: ['Approved', 'Rejected'],
              rows: [[statusStats.approvedLastXDays, statusStats.rejectedLastXDays]],
            },
            {
              name: 'Average Approval Time',
              headers: ['Approval Level', 'Average Time (days)'],
              rows: (avgTimeStats.byLevel || []).map(row => [row.name, row.averageTime ?? 'N/A']),
            },
          ];
          return { dashboardSheets };
        }
        case 'kpi-inventory':
        case 'kpiInventory': {
          // Lấy danh sách KPI và trạng thái tồn kho (ví dụ: KPI chưa có người phụ trách, chưa cập nhật giá trị, ...)
          const allKpis = await this.kpisService.findAll({}, adminUserId);
          const inventoryHeaders = [
            'KPI Name',
            'Department',
            'Assigned Employees',
            'Last Update',
            'Status',
          ];
          const inventoryRows = (allKpis.data || []).map((kpi: any) => {
            let deptName = '';
            if (kpi.assignments && kpi.assignments.length > 0 && kpi.assignments[0].department) {
              deptName = kpi.assignments[0].department.name;
            }
            const assignedEmployees = (kpi.assignments || [])
              .map((a: any) => a.employee ? ((a.employee.first_name && a.employee.last_name) ? `${a.employee.first_name} ${a.employee.last_name}` : a.employee.username) : '')
              .filter((n: string) => n)
              .join(', ');
            const lastUpdate = kpi.updated_at || '';
            let status = 'OK';
            if (!assignedEmployees) status = 'No Assignee';
            else if (!lastUpdate) status = 'No Update';
            return [
              kpi.name,
              deptName,
              assignedEmployees,
              lastUpdate,
              status,
            ];
          });
          return { headers: inventoryHeaders, rows: inventoryRows };
        }
        default:
          throw new Error('Loại báo cáo không hợp lệ');
      }
    }

    // Xử lý xuất báo cáo theo định dạng
    if (fileFormat === 'excel') {
      const reportData = await getReportData.call(this, reportType, adminUserId, adminUser);
      // Các loại report đã xử lý riêng ở trên, không tạo lại sheet ở nhánh else
      const handledTypes = [
        'kpi-summary',
        'kpi-details',
        'kpi-comparison',
        'kpi-awaiting-approval',
        'employee-performance',
        'strategic-objectives',
        'kpi-update-progress',
        'kpi-history',
      ];
      if (reportType === 'dashboard-multi' && reportData.dashboardSheets) {
        for (const sheet of reportData.dashboardSheets) {
          const ws = workbook.addWorksheet(sanitizeSheetName(sheet.name));
          ws.addRow(sheet.headers);
          for (const row of sheet.rows) {
            try {
              ws.addRow(normalizeRow(row, sheet.headers.length));
            } catch (err) {
              logExcelRowError(sheet.name, 0, row, err);
            }
          }
          formatWorksheet(ws);
        }
      } else if (reportData.headers && reportData.rows && !handledTypes.includes(reportType)) {
        // Chỉ tạo sheet nếu chưa xử lý riêng ở trên
        const ws = workbook.addWorksheet(sanitizeSheetName(reportType));
        ws.addRow(reportData.headers);
        for (const row of reportData.rows) {
          try {
            ws.addRow(normalizeRow(row, reportData.headers.length));
          } catch (err) {
            logExcelRowError(reportType, 0, row, err);
          }
        }
        formatWorksheet(ws);
      } else if (!handledTypes.includes(reportType)) {
        throw new Error('Không có dữ liệu để xuất Excel');
      }
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer as Buffer;
    }

    // Phần xuất PDF giữ nguyên logic cũ phía dưới
    throw new Error('Định dạng file không được hỗ trợ');
  }
}

// Helper để chuẩn hóa tên sheet Excel (loại bỏ ký tự đặc biệt, cắt độ dài)
function sanitizeSheetName(name: string): string {
  // Excel không cho phép: : \ / ? * [ ]
  const INVALID_SHEET_REGEX = /[\\/:\?\*\[\]]/g;
  let sanitized = name.replace(INVALID_SHEET_REGEX, ' ');
  // Cắt độ dài tối đa 31 ký tự (Excel giới hạn)
  if (sanitized.length > 31) sanitized = sanitized.slice(0, 31);
  // Loại bỏ khoảng trắng đầu/cuối
  sanitized = sanitized.trim();
  // Nếu rỗng thì trả về 'Sheet'
  if (!sanitized) return 'Sheet';
  return sanitized;
}

// Định dạng worksheet Excel
function formatWorksheet(ws: Excel.Worksheet) {
  // Định dạng header: bold, căn giữa, màu nền nhạt
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFEFEF' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  // Định dạng border và alignment cho toàn bộ bảng
  ws.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      // Căn giữa cho header và cột số, căn trái cho text
      if (rowNumber === 1 || typeof cell.value === 'number' || (typeof cell.value === 'string' && cell.value.match(/^[\d,.%]+$/))) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });
  // Tự động set width cho từng cột
  ws.columns.forEach((col) => {
    let maxLength = 10;
    if (col && typeof col.eachCell === 'function') {
      col.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value ? cell.value.toString() : '';
        if (val.length > maxLength) maxLength = val.length;
      });
      col.width = maxLength + 2;
    }
  });
}
