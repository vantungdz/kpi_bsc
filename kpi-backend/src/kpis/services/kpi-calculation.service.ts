import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { evaluate, mean } from 'mathjs';
import { Kpi } from '../entities/kpi.entity';
import { KPIAssignment } from '../../kpi-assessments/entities/kpi-assignment.entity';
import { KpiValueStatus } from '../../kpi-values/entities/kpi-value.entity';

export interface CalculatedValuesCache {
  employeeValues: Map<number, number>;
  sectionValues: Map<number, number>;
  departmentValues: Map<number, number>;
  cacheKey: string;
}

@Injectable()
export class KpiCalculationService {
  private readonly logger = new Logger(KpiCalculationService.name);
  private valuesCache = new Map<string, CalculatedValuesCache>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Kpi)
    private readonly kpisRepository: Repository<Kpi>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    private dataSource: DataSource,
  ) {}

  /**
   * Evaluate a math formula expression with given variables.
   * Returns 0 on any error.
   */
  evaluateFormulaExpression(
    expression: string,
    variables: Record<string, any>,
  ): number {
    try {
      const result = evaluate(expression, { ...variables, average: mean });
      if (typeof result === 'number' && !isNaN(result)) {
        return parseFloat(result.toFixed(2));
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Generate cache key for assignments
   */
  generateCacheKey(assignments: KPIAssignment[]): string {
    const keyData = assignments
      .filter((a) => !a.deleted_at)
      .map((a) => {
        let latestValue: any = null;
        if (a.kpiValues && a.kpiValues.length > 0) {
          latestValue = a.kpiValues.reduce((latest: any, current: any) =>
            new Date(current.updated_at || current.created_at).getTime() >
            new Date(latest.updated_at || latest.created_at).getTime()
              ? current
              : latest,
          );
        }
        return `${a.id}-${latestValue?.updated_at || latestValue?.created_at || a.updated_at}`;
      })
      .sort()
      .join('|');
    if (!keyData) {
      return 'empty-assignments';
    }
    return Buffer.from(keyData).toString('base64').substring(0, 50);
  }

  /**
   * Get cached calculated values or compute them
   */
  getCalculatedValues(assignments: KPIAssignment[]): CalculatedValuesCache {
    if (!assignments || assignments.length === 0) {
      return {
        employeeValues: new Map<number, number>(),
        sectionValues: new Map<number, number>(),
        departmentValues: new Map<number, number>(),
        cacheKey: 'empty-assignments',
      };
    }
    const cacheKey = this.generateCacheKey(assignments);
    const cached = this.valuesCache.get(cacheKey);
    if (cached && cached.cacheKey === cacheKey) {
      return cached;
    }
    const employeeValues = this.calculateEmployeeValues(assignments);
    const sectionValues = this.calculateSectionValues(
      assignments,
      employeeValues,
    );
    const departmentValues = this.calculateDepartmentValues(
      assignments,
      sectionValues,
      employeeValues,
    );
    const result: CalculatedValuesCache = {
      employeeValues,
      sectionValues,
      departmentValues,
      cacheKey,
    };
    this.valuesCache.set(cacheKey, result);
    if (this.valuesCache.size > 100) {
      const keysToDelete = Array.from(this.valuesCache.keys()).slice(0, 50);
      keysToDelete.forEach((key) => this.valuesCache.delete(key));
    }
    return result;
  }

  /**
   * Helper method để tính employee values (APPROVED)
   * Find latest APPROVED value without sorting (O(n) scan).
   */
  calculateEmployeeValues(assignments: KPIAssignment[]): Map<number, number> {
    const employeeValues = new Map<number, number>();
    assignments
      .filter((a) => a.assigned_to_employee && !a.deleted_at)
      .forEach((assignment) => {
        const employeeId = assignment.assigned_to_employee!;
        if (!assignment.kpiValues || assignment.kpiValues.length === 0) {
          return;
        }
        let bestValue: number | null = null;
        let bestMs = -Infinity;
        for (const v of assignment.kpiValues) {
          if (v.status !== 'APPROVED' || v.value == null) continue;
          const ms = new Date(v.updated_at || v.created_at).getTime();
          if (ms > bestMs) {
            const num = Number(v.value);
            if (!isNaN(num)) {
              bestMs = ms;
              bestValue = num;
            }
          }
        }
        if (bestValue != null) {
          employeeValues.set(employeeId, bestValue);
        }
      });
    return employeeValues;
  }

  /**
   * Helper method để tính section values từ employee values
   * Tính tổng actual_value của tất cả employees trong section
   */
  calculateSectionValues(
    assignments: KPIAssignment[],
    employeeValues: Map<number, number>,
  ): Map<number, number> {
    const sectionValues = new Map<number, number>();
    const sectionEmployeeMap = new Map<number, number[]>();
    assignments
      .filter((a) => a.assigned_to_employee && !a.deleted_at)
      .forEach((assignment) => {
        const employeeId = assignment.assigned_to_employee!;
        const sectionId = assignment.employee?.sectionId;
        if (sectionId) {
          if (!sectionEmployeeMap.has(sectionId)) {
            sectionEmployeeMap.set(sectionId, []);
          }
          const sectionData = sectionEmployeeMap.get(sectionId)!;
          if (employeeValues.has(employeeId)) {
            const empValue = employeeValues.get(employeeId)!;
            sectionData.push(empValue);
          }
        }
      });
    sectionEmployeeMap.forEach((values, sectionId) => {
      const sectionValue =
        values.length > 0
          ? values.reduce((sum, val) => sum + val, 0)
          : 0;
      sectionValues.set(sectionId, sectionValue);
    });
    return sectionValues;
  }

  /**
   * Helper method để tính department values
   * - Nếu department có sections: tổng actual_value của các sections
   * - Nếu department không có sections: tổng actual_value của các employees trong department
   */
  calculateDepartmentValues(
    assignments: KPIAssignment[],
    sectionValues: Map<number, number>,
    employeeValues: Map<number, number>,
  ): Map<number, number> {
    const departmentValues = new Map<number, number>();
    const departmentSectionMap = new Map<number, number[]>();
    const departmentEmployeeMap = new Map<number, number[]>();
    const directDepartmentAssignments = new Set<number>();

    // Lấy tất cả department assignments trực tiếp
    assignments
      .filter(
        (a) =>
          a.assigned_to_department &&
          !a.assigned_to_section &&
          !a.assigned_to_employee &&
          !a.deleted_at,
      )
      .forEach((assignment) => {
        const departmentId = assignment.assigned_to_department!;
        directDepartmentAssignments.add(departmentId);
      });

    // Nhóm sections theo department
    assignments
      .filter((a) => a.assigned_to_section && !a.deleted_at)
      .forEach((assignment) => {
        const sectionId = assignment.assigned_to_section!;
        const departmentId = assignment.section?.department?.id;

        if (departmentId && sectionValues.has(sectionId)) {
          if (!departmentSectionMap.has(departmentId)) {
            departmentSectionMap.set(departmentId, []);
          }

          const deptData = departmentSectionMap.get(departmentId)!;
          const sectionValue = sectionValues.get(sectionId)!;
          deptData.push(sectionValue);
        }
      });

    // Nhóm employees theo department (cho trường hợp department không có sections)
    assignments
      .filter((a) => a.assigned_to_employee && !a.deleted_at)
      .forEach((assignment) => {
        const employeeId = assignment.assigned_to_employee!;
        const departmentId =
          assignment.employee?.departmentId ??
          assignment.employee?.section?.department?.id;

        if (departmentId && employeeValues.has(employeeId)) {
          // Chỉ thêm vào departmentEmployeeMap nếu department không có sections
          if (!departmentSectionMap.has(departmentId)) {
            if (!departmentEmployeeMap.has(departmentId)) {
              departmentEmployeeMap.set(departmentId, []);
            }

            const deptEmployeeData = departmentEmployeeMap.get(departmentId)!;
            const empValue = employeeValues.get(employeeId)!;
            deptEmployeeData.push(empValue);
          }
        }
      });

    // Tính giá trị cho từng department
    // Ưu tiên: nếu có sections thì dùng tổng section values, nếu không thì dùng tổng employee values
    const allDepartmentIds = new Set([
      ...departmentSectionMap.keys(),
      ...departmentEmployeeMap.keys(),
      ...directDepartmentAssignments,
    ]);

    allDepartmentIds.forEach((departmentId) => {
      let departmentValue = 0;

      if (departmentSectionMap.has(departmentId)) {
        // Department có sections: tổng actual_value của các sections
        const sectionValuesList = departmentSectionMap.get(departmentId)!;
        departmentValue =
          sectionValuesList.length > 0
            ? sectionValuesList.reduce((sum, val) => sum + val, 0)
            : 0;
      } else if (departmentEmployeeMap.has(departmentId)) {
        // Department không có sections: tổng actual_value của các employees
        const employeeValuesList = departmentEmployeeMap.get(departmentId)!;
        departmentValue =
          employeeValuesList.length > 0
            ? employeeValuesList.reduce((sum, val) => sum + val, 0)
            : 0;
      } else if (directDepartmentAssignments.has(departmentId)) {
        // Department assignment trực tiếp nhưng không có sections/employees
        // Trong trường hợp này, giá trị sẽ là 0 (không có data để tính)
        departmentValue = 0;
      }

      departmentValues.set(departmentId, departmentValue);
    });

    return departmentValues;
  }

  /**
   * Calculate the total actual value for a section by summing approved values
   * from all employee assignments in that section for a specific KPI.
   *
   * @param kpiId - The KPI ID
   * @param sectionId - The section ID
   * @returns The total actual value (sum of employee approved values)
   */
  async calculateSectionActualValue(
    kpiId: number,
    sectionId: number,
  ): Promise<number> {
    // Query to get ALL employee assignments belonging to this section for this KPI
    const employeeAssignments = await this.kpiAssignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValues')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .where('assignment.kpi_id = :kpiId', { kpiId })
      .andWhere('assignment.assigned_to_employee IS NOT NULL')
      .andWhere('assignment.assigned_to_section IS NULL')
      .andWhere('employee.sectionId = :sectionId', { sectionId })
      .andWhere('assignment.deleted_at IS NULL')
      .getMany();

    // Calculate total from approved values
    let total = 0;
    employeeAssignments.forEach((assignment) => {
      if (assignment.kpiValues && assignment.kpiValues.length > 0) {
        const approved = assignment.kpiValues
          .filter((v) => v.status === KpiValueStatus.APPROVED)
          .sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at).getTime() -
              new Date(a.updated_at || a.created_at).getTime(),
          );

        if (approved.length > 0 && approved[0].value != null) {
          const value = Number(approved[0].value);
          if (!isNaN(value)) {
            total += value;
          }
        }
      }
    });

    return total;
  }

  /**
   * Batch calculate actual values for multiple KPI-section pairs.
   * This is more efficient than calling calculateSectionActualValue multiple times.
   *
   * @param kpiSectionPairs - Array of { kpiId, sectionId } pairs
   * @returns Map of "kpiId-sectionId" => actual value
   */
  async batchCalculateSectionActualValues(
    kpiSectionPairs: Array<{ kpiId: number; sectionId: number }>,
  ): Promise<Map<string, number>> {
    if (kpiSectionPairs.length === 0) {
      return new Map();
    }

    const kpiIds = [...new Set(kpiSectionPairs.map((p) => p.kpiId))];
    const sectionIds = [...new Set(kpiSectionPairs.map((p) => p.sectionId))];

    // Single query to get all relevant employee assignments
    const employeeAssignments = await this.kpiAssignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValues')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .where('assignment.kpi_id IN (:...kpiIds)', { kpiIds })
      .andWhere('assignment.assigned_to_employee IS NOT NULL')
      .andWhere('assignment.assigned_to_section IS NULL')
      .andWhere('employee.sectionId IN (:...sectionIds)', { sectionIds })
      .andWhere('assignment.deleted_at IS NULL')
      .getMany();

    // Group assignments by kpiId-sectionId and calculate totals
    const resultMap = new Map<string, number>();

    // Initialize all pairs with 0
    kpiSectionPairs.forEach(({ kpiId, sectionId }) => {
      resultMap.set(`${kpiId}-${sectionId}`, 0);
    });

    // Calculate totals
    employeeAssignments.forEach((assignment) => {
      if (assignment.employee?.sectionId && assignment.kpi_id) {
        const key = `${assignment.kpi_id}-${assignment.employee.sectionId}`;

        if (assignment.kpiValues && assignment.kpiValues.length > 0) {
          const approved = assignment.kpiValues
            .filter((v) => v.status === KpiValueStatus.APPROVED)
            .sort(
              (a, b) =>
                new Date(b.updated_at || b.created_at).getTime() -
                new Date(a.updated_at || a.created_at).getTime(),
            );

          if (approved.length > 0 && approved[0].value != null) {
            const value = Number(approved[0].value);
            if (!isNaN(value)) {
              const currentTotal = resultMap.get(key) || 0;
              resultMap.set(key, currentTotal + value);
            }
          }
        }
      }
    });

    return resultMap;
  }

  /**
   * Recalculate and persist the KPI actual_value based on latest approved values.
   * Tính tổng actual_value (đơn giản hóa, bỏ công thức)
   */
  async recalculateKpiActualValue(kpiId: number): Promise<void> {
    const kpi = await this.kpisRepository.findOne({
      where: { id: kpiId },
      relations: ['formula'],
    });
    if (!kpi) {
      return;
    }
    const assignments = await this.kpiAssignmentRepository.find({
      where: { kpi_id: kpiId, deleted_at: IsNull() },
      relations: ['kpiValues'],
    });
    const latestApprovedValues: number[] = [];
    const correspondingTargets: number[] = [];
    if (assignments && assignments.length > 0) {
      for (const assignment of assignments) {
        const latestApprovedValueRecord = assignment.kpiValues
          ?.filter((v) => v.status === KpiValueStatus.APPROVED)
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )[0];
        if (latestApprovedValueRecord) {
          latestApprovedValues.push(latestApprovedValueRecord.value);
          if (assignment.targetValue != null) {
            correspondingTargets.push(assignment.targetValue);
          }
        }
      }
    }
    const numericValues = latestApprovedValues
      .map((v) => (v != null ? Number(v) : 0))
      .filter((v) => !isNaN(v));
    const newActualValue =
      numericValues.length > 0
        ? numericValues.reduce((sum, val) => sum + val, 0)
        : null;
    const finalActualValue =
      newActualValue === null ? null : parseFloat(newActualValue.toFixed(2));
    if (kpi.actual_value !== finalActualValue) {
      kpi.actual_value = finalActualValue;
      kpi.updated_at = new Date();
      await this.kpisRepository.save(kpi);
    }
  }

  @OnEvent('kpi_value.approved', { async: true })
  async handleKpiValueApproved(payload: { kpiId: number }) {
    if (!payload || typeof payload.kpiId !== 'number') {
      return;
    }
    await this.recalculateKpiActualValue(payload.kpiId);
  }
}
