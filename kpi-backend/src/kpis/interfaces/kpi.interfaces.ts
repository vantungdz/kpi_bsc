import { Kpi } from '../entities/kpi.entity';
import { KPIAssignment } from '../../kpi-assessments/entities/kpi-assignment.entity';

export interface AssignmentWithLatestValue extends KPIAssignment {
  latest_actual_value?: number | null;
  latest_value_timestamp?: Date | null;
  latest_value_status?: string | null;
}

export interface KpiWithSectionActuals extends Kpi {
  actuals_by_section_id?: { [sectionId: number]: number | null };
  latest_value_timestamp?: Date | null;
}

export interface KpiDetailWithProcessedAssignments extends Kpi {
  assignments: AssignmentWithLatestValue[];
}
