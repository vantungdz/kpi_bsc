export interface KpiCycleResponse {
    id: string
    year: number
    name: string
    goalSettingStart: string | null
    goalSettingEnd: string | null
    midYearStart: string | null
    midYearEnd: string | null
    endYearStart: string | null
    endYearEnd: string | null
    activePhase: string | null
}

export interface SubmitButtonState {
  show: boolean;
  disabled: boolean;
  text: string;
  reason?: string;
  actionType: 'GOAL_SETTING' | 'MID_YEAR' | 'END_YEAR' | 'COMPLETED';
}