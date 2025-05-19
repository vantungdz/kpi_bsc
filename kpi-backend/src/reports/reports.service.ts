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

@Injectable()
export class ReportsService {
  constructor(
    private readonly kpisService: KpisService,
    private readonly employeesService: EmployeesService,
    private readonly dashboardsService: DashboardsService, // Inject DashboardsService
  ) {}

  async generateKpiReport(reportType: string, startDate?: Date, endDate?: Date, fileFormat: string = 'excel'): Promise<Buffer> {
    if (fileFormat === 'pdf') {
      // Lấy dữ liệu KPI
      const kpiSummaryData = await this.kpisService.findAll({});
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
        return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 }).replace(/\,00$/, '');
      };

      // --- Tổng quan ---
      if (reportType === 'kpi-summary' || reportType === 'all') {
        doc.addPage();
        doc.fontSize(16).text('Tổng quan KPI', { align: 'center' });
        doc.moveDown();
        const tableTop = doc.y;
        const colWidths = [160, 80, 80, 100, 100];
        const headers = ['Tên KPI', 'Mục tiêu', 'Kết quả', 'Tỷ lệ hoàn thành', 'Trạng thái'];
        let x = 40;
        doc.fontSize(12).fillColor('#333');
        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, { width: colWidths[i], align: 'center' });
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
            kpi.status || ''
          ];
          let maxCellHeight = 0;
          row.forEach((cell, i) => {
            const cellHeight = doc.heightOfString(cell, { width: colWidths[i], align: 'center' });
            if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
          });
          x = 40;
          row.forEach((cell, i) => {
            doc.fontSize(11).fillColor('#000').text(cell, x, y, { width: colWidths[i], align: 'center' });
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
        const colWidths = [40, 120, 120, 60, 60, 70, 70, 70, 60, 60, 80, 80, 80];
        const headers = ['ID','Tên','Mô tả','Đơn vị','Tần suất','Bắt đầu','Kết thúc','Người tạo','Loại','Trọng số','Mục tiêu','Giá trị thực tế','Trạng thái'];
        let x = 40;
        doc.fontSize(10).fillColor('#333');
        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, { width: colWidths[i], align: 'center' });
          x += colWidths[i];
        });
        let y = tableTop + 20;
        const rowPadding = 4;
        const kpiDetailsData = await this.kpisService.findAll({});
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
            kpi.status
          ];
          let maxCellHeight = 0;
          row.forEach((cell, i) => {
            const cellHeight = doc.heightOfString(cell ? cell.toString() : '', { width: colWidths[i], align: 'center' });
            if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
          });
          x = 40;
          row.forEach((cell, i) => {
            doc.fontSize(9).fillColor('#000').text(cell ? cell.toString() : '', x, y, { width: colWidths[i], align: 'center' });
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
        const headers = ['Phòng ban', 'KPI', 'Mục tiêu', 'Kết quả', 'Tỷ lệ hoàn thành'];
        let x = 40;
        doc.fontSize(11).fillColor('#333');
        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, { width: colWidths[i], align: 'center' });
          x += colWidths[i];
        });
        let y = tableTop + 20;
        const rowPadding = 4;
        // Luôn đảm bảo comparisonData là { data: any[] }
        let comparisonData: { data: any[] } = { data: [] };
        if (typeof (this.kpisService as any).getKpiComparisonData === 'function') {
          comparisonData = await (this.kpisService as any).getKpiComparisonData();
        } else {
          // Dùng dữ liệu tổng quan để giả lập
          const kpiSummaryData = await this.kpisService.findAll({});
          comparisonData.data = (kpiSummaryData.data || []).map((k: any) => ({
            department_name: k.department_name || 'Phòng ban A',
            kpi_name: k.name,
            target: k.target,
            actual_value: k.actual_value
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
            completionRate
          ];
          let maxCellHeight = 0;
          row.forEach((cell, i) => {
            const cellHeight = doc.heightOfString(cell ? cell.toString() : '', { width: colWidths[i], align: 'center' });
            if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
          });
          x = 40;
          row.forEach((cell, i) => {
            doc.fontSize(10).fillColor('#000').text(cell ? cell.toString() : '', x, y, { width: colWidths[i], align: 'center' });
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
        const adminUser = await this.employeesService[
          'employeeRepository'
        ].findOne({
          where: { role: { name: 'admin' } },
          relations: ['role'],
        });
        if (!adminUser) {
          throw new Error('No admin user found for dashboard report.');
        }
        // 1. KPI chờ duyệt
        const awaitingStats = await this.dashboardsService.getKpiAwaitingApprovalStats(adminUser);
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
            doc.font('dejavu').fontSize(11).fillColor('#0050b3').text(header, x, y, { width: tableColWidths[i], align: i === 1 ? 'right' : 'left' });
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
              const cellHeight = doc.heightOfString(cell ? cell.toString() : '', { width: tableColWidths[i], align: i === 1 ? 'right' : 'left' });
              if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
            });
            x = doc.x;
            cells.forEach((cell, i) => {
              doc.font('dejavu').fontSize(10).fillColor('black').text(cell.toString(), x, y, { width: tableColWidths[i], align: i === 1 ? 'right' : 'left' });
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
            const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 500, height: 250, backgroundColour: 'white' });
            const chartConfig = {
              type: 'bar',
              data: {
                labels: chartLabels,
                datasets: [{
                  label: 'Số lượng KPI chờ duyệt',
                  data: chartData,
                  backgroundColor: ['#1890ff', '#faad14', '#cf1322'],
                }],
              },
              options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
              },
            };
            const barBuffer = await chartJSNodeCanvas.renderToBuffer(chartConfig);
            doc.moveDown(1);
            doc.fontSize(12).text('Biểu đồ số lượng KPI chờ duyệt theo cấp duyệt:', { align: 'left' });
            doc.moveDown(0.2);
            doc.image(barBuffer, { fit: [400, 180], align: 'center', valign: 'center' });
            doc.moveDown(2); // Tạo khoảng cách lớn hơn trước section tiếp theo
          } else {
            doc.moveDown(2);
          }
        } else {
          doc.moveDown(2);
        }
        // 2. KPI đã duyệt/từ chối 7 ngày qua
        const statusStats = await this.dashboardsService.getKpiStatusOverTimeStats(adminUser, 7);
        doc.addPage();
        doc.fontSize(18).text('THỐNG KÊ KPI ĐÃ DUYỆT/TỪ CHỐI (7 ngày qua)', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).fillColor('#3f8600').text(`KPI đã duyệt: ${statusStats.approvedLastXDays}`);
        doc.fontSize(12).fillColor('#cf1322').text(`KPI bị từ chối: ${statusStats.rejectedLastXDays}`);
        doc.fillColor('black');
        // Thêm biểu đồ Pie chart cho KPI đã duyệt/từ chối
        const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
        const chartJSNodeCanvas2 = new ChartJSNodeCanvas({ width: 400, height: 220, backgroundColour: 'white' });
        const pieConfig = {
          type: 'pie',
          data: {
            labels: ['Đã duyệt', 'Từ chối'],
            datasets: [{
              data: [statusStats.approvedLastXDays, statusStats.rejectedLastXDays],
              backgroundColor: ['#52c41a', '#f5222d'],
            }],
          },
          options: {
            plugins: { legend: { position: 'top' } },
          },
        };
        const pieBuffer = await chartJSNodeCanvas2.renderToBuffer(pieConfig);
        doc.moveDown(1);
        doc.fontSize(12).text('Biểu đồ KPI đã duyệt/từ chối:', { align: 'left' });
        doc.moveDown(0.2);
        doc.image(pieBuffer, { fit: [300, 150], align: 'center', valign: 'center' });
        doc.moveDown(2);
        // 3. Thời gian duyệt trung bình
        const avgTimeStats = await this.dashboardsService.getAverageApprovalTimeStats(adminUser);
        doc.addPage();
        doc.fontSize(18).text('THỐNG KÊ THỜI GIAN DUYỆT KPI TRUNG BÌNH', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Thời gian duyệt trung bình (tất cả cấp): ${avgTimeStats.totalAverageTime ?? 'N/A'} ngày`);
        doc.moveDown(0.5);
        if (avgTimeStats.byLevel && avgTimeStats.byLevel.length > 0) {
          const tableColWidths = [220, 120];
          let y = doc.y;
          const headers = ['Cấp duyệt', 'Thời gian trung bình (ngày)'];
          let x = doc.x;
          headers.forEach((header, i) => {
            doc.font('dejavu').fontSize(11).fillColor('#0050b3').text(header, x, y, { width: tableColWidths[i], align: 'center' });
            x += tableColWidths[i];
          });
          y += 18;
          avgTimeStats.byLevel.forEach((row) => {
            x = doc.x;
            const cells = [row.name, row.averageTime ?? 'N/A'];
            cells.forEach((cell, i) => {
              doc.font('dejavu').fontSize(10).fillColor('black').text(cell.toString(), x, y, { width: tableColWidths[i], align: 'center' });
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

    // --- Tổng quan ---
    if (reportType === 'kpi-summary' || reportType === 'all') {
      const summarySheet = workbook.addWorksheet('Tổng quan KPI');
      summarySheet.addRow([
        'Tên KPI',
        'Mục tiêu',
        'Kết quả',
        'Tỷ lệ hoàn thành',
        'Trạng thái',
      ]);
      const kpiSummaryData = await this.kpisService.findAll({});
      kpiSummaryData.data.forEach((kpi: Kpi) => {
        const formatNumber = (val: any) => {
          if (val === null || val === undefined || val === '') return '';
          const num = Number(val);
          if (isNaN(num)) return val;
          return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 }).replace(/\,00$/, '');
        };
        let completionRate = '0%';
        if (kpi.target && kpi.target > 0 && kpi.actual_value !== null && kpi.actual_value !== undefined) {
          let rate = (Number(kpi.actual_value) / Number(kpi.target)) * 100;
          if (rate < 0) rate = 0;
          completionRate = rate.toFixed(2) + '%';
        }
        summarySheet.addRow([
          kpi.name,
          formatNumber(kpi.target),
          formatNumber(kpi.actual_value),
          completionRate,
          kpi.status,
        ]);
      });
    }

    // --- Chi tiết ---
    if (reportType === 'kpi-details' || reportType === 'all') {
      const detailsSheet = workbook.addWorksheet('Chi tiết KPI');
      detailsSheet.addRow([
        'ID',
        'Tên',
        'Mô tả',
        'Đơn vị',
        'Tần suất',
        'Ngày bắt đầu',
        'Ngày kết thúc',
        'Người tạo',
        'Loại',
        'Trọng số',
        'Mục tiêu',
        'Giá trị thực tế',
        'Trạng thái',
      ]);
      const kpiDetailsData = await this.kpisService.findAll({});
      kpiDetailsData.data.forEach((kpi: Kpi) => {
        const formatNumber = (val: any) => {
          if (val === null || val === undefined || val === '') return '';
          const num = Number(val);
          if (isNaN(num)) return val;
          return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 }).replace(/\,00$/, '');
        };
        detailsSheet.addRow([
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
        ]);
      });
    }

    // --- So sánh ---
    if (reportType === 'kpi-comparison' || reportType === 'all') {
      const comparisonSheet = workbook.addWorksheet('So sánh KPI');
      comparisonSheet.addRow([
        'Phòng ban',
        'KPI',
        'Mục tiêu',
        'Kết quả',
        'Tỷ lệ hoàn thành',
      ]);
      // Luôn đảm bảo comparisonData là { data: any[] }
      let comparisonData: { data: any[] } = { data: [] };
      if (typeof (this.kpisService as any).getKpiComparisonData === 'function') {
        comparisonData = await (this.kpisService as any).getKpiComparisonData();
      } else {
        // Dùng dữ liệu tổng quan để giả lập
        const kpiSummaryData = await this.kpisService.findAll({});
        comparisonData.data = (kpiSummaryData.data || []).map((k: any) => ({
          department_name: k.department_name || 'Phòng ban A',
          kpi_name: k.name,
          target: k.target,
          actual_value: k.actual_value
        }));
      }
      (comparisonData.data || []).forEach((item: any) => {
        const formatNumber = (val: any) => {
          if (val === null || val === undefined || val === '') return '';
          const num = Number(val);
          if (isNaN(num)) return val;
          return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 }).replace(/\,00$/, '');
        };
        let completionRate = '0%';
        if (item.target && item.target > 0 && item.actual_value !== null && item.actual_value !== undefined) {
          let rate = (Number(item.actual_value) / Number(item.target)) * 100;
          if (rate < 0) rate = 0;
          completionRate = rate.toFixed(2) + '%';
        }
        comparisonSheet.addRow([
          item.department_name || '',
          item.kpi_name || '',
          formatNumber(item.target),
          formatNumber(item.actual_value),
          completionRate
        ]);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }
}
