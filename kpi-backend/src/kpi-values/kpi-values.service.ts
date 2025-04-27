import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiValueHistory } from 'src/entities/kpi-value-history.entity';

@Injectable()
export class KpiValuesService {
  constructor(
    @InjectRepository(KpiValue)
    private kpiValuesRepository: Repository<KpiValue>,
    @InjectRepository(KpiValueHistory)
    private kpiValueHistoryRepository: Repository<KpiValueHistory>,
  ) {}

  async findAll(): Promise<KpiValue[]> {
    return await this.kpiValuesRepository.find({});
  }

  async findOne(id: number): Promise<KpiValue> {
    const data = await this.kpiValuesRepository.findOne({
      where: { id },
    });

    if (!data) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return data;
  }

  async create(
    kpiValueData: Partial<KpiValue>,
    createdBy: number,
  ): Promise<KpiValue> {
    const newKpiValue = this.kpiValuesRepository.create(kpiValueData);
    const savedKpiValue = await this.kpiValuesRepository.save(newKpiValue);

    // Lưu lịch sử: Hành động CREATE
    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: savedKpiValue.id,
      // kpi_id: savedKpiValue.kpi.id,
      value: savedKpiValue.value,
      timestamp: savedKpiValue.timestamp,
      notes: savedKpiValue.notes,
      action: 'CREATE',
      changed_by: createdBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    return savedKpiValue;
  }

  async update(
    id: number,
    updateData: Partial<KpiValue>,
    updatedBy: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }

    // Lưu lịch sử: Hành động UPDATE (lưu giá trị cũ trước khi cập nhật)
    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: kpiValue.id,
      // kpi_id: kpiValue.kpi.id,
      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: kpiValue.notes,
      action: 'UPDATE',
      changed_by: updatedBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    // Cập nhật giá trị mới
    Object.assign(kpiValue, updateData);
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = updatedBy;
    return this.kpiValuesRepository.save(kpiValue);
  }

  // Xóa KPI Value
  async delete(id: number, deletedBy: number): Promise<boolean> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }

    // Lưu lịch sử: Hành động DELETE
    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: kpiValue.id,
      // kpi_id: kpiValue.kpi.id,
      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: kpiValue.notes,
      action: 'DELETE',
      changed_by: deletedBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    await this.kpiValuesRepository.delete(id);
    return true;
  }

  async submitProgressUpdate(
    assignmentId: number,
    notes: string,
    projectDetails: any[],
    userId: number,
  ): Promise<KpiValue> {
    // Tính toán giá trị từ projectDetails (ví dụ: tổng các projectValue)
    let calculatedValue = 0;
    if (projectDetails && Array.isArray(projectDetails)) {
      calculatedValue = projectDetails.reduce(
        (sum, project) => sum + Number(project.projectValue || 0),
        0,
      );
    }

    const newKpiValue = this.kpiValuesRepository.create({
      kpi_assigment_id: assignmentId,
      value: calculatedValue, // Sử dụng giá trị đã tính toán
      timestamp: new Date(),
      notes: notes,
      status: 'submitted',
      project_details: JSON.stringify(projectDetails),
      updated_by: userId,
    });

    const savedKpiValue = await this.kpiValuesRepository.save(newKpiValue);

    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: savedKpiValue.id,
      kpi_assigment_id: assignmentId,
      value: savedKpiValue.value,
      timestamp: savedKpiValue.timestamp,
      notes: savedKpiValue.notes,
      action: 'SUBMIT',
      changed_by: userId,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    return savedKpiValue;
  }

  // Lấy lịch sử của KPI Value
  async getHistory(kpiValueId: number): Promise<KpiValueHistory[]> {
    return this.kpiValueHistoryRepository.find({
      where: { kpi_value_id: kpiValueId },
      order: { changed_at: 'ASC' },
    });
  }
}
