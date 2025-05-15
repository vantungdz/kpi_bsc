// /e/project/kpi-backend/src/reports/reports.service.ts
import { Injectable } from '@nestjs/common';
import * as Excel from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import { Kpi, KpiDefinitionStatus } from 'src/entities/kpi.entity';
import { KpisService } from '../kpis/kpis.service';
import { EmployeesService } from 'src/employees/employees.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly kpisService: KpisService,
    private readonly employeesService: EmployeesService,
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
