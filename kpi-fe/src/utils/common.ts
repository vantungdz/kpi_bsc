import {
  KpiCycleResponse,
  SubmitButtonState,
} from '@/types/shared/kpi-cycle.type';

export const generateInitials = (fullName?: string) => {
  if (!fullName) return 'U';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Function returns the state of the submit button based on the current KPI cycle, the user's status code, and the current date.
 */
export function getSubmitButtonState(
  kpiCycle: KpiCycleResponse,
  statusCode: number,
  currentDateInput: string | number | Date = new Date(),
): SubmitButtonState {
  const now = new Date(currentDateInput).getTime();

  const phases = [
    {
      isDone: statusCode >= 405, // isGoalSettingDone
      actionType: 'GOAL_SETTING' as const,
      text: 'Approve KPI',
      startDate: kpiCycle.goalSettingStart,
      errNoConfig: 'The system has not configured the goal setting time',
      errEarly: 'It is not yet time to set goals',
    },
    {
      isDone: statusCode >= 503 && statusCode !== 601 && statusCode !== 602, // isMidYearDone
      actionType: 'MID_YEAR' as const,
      text: 'Mid-Year Review',
      startDate: kpiCycle.midYearStart,
      errNoConfig: 'The system has not configured the mid-year review time',
      errEarly: 'It is not yet time for the mid-year review',
    },
    {
      isDone: statusCode >= 603, // isEndYearDone
      actionType: 'END_YEAR' as const,
      text: 'End-Year Review',
      startDate: kpiCycle.endYearStart,
      errNoConfig: 'The system has not configured the end-year review time',
      errEarly: 'It is not yet time for the end-year review',
    },
  ];

  // 2. Find the first phase that is not done
  const activePhase = phases.find((phase) => !phase.isDone);

  // If all phases are done (activePhase = undefined) -> Return default state
  if (!activePhase) {
    return {
      show: false,
      disabled: true,
      text: '',
      actionType: 'COMPLETED',
    };
  }

  // 3. Initialize the basic state for the current phase
  const state: SubmitButtonState = {
    show: true,
    actionType: activePhase.actionType,
    text: activePhase.text,
    disabled: false,
  };

  // 4. Apply the ONLY time check logic
  if (!activePhase.startDate) {
    state.show = false;
    state.disabled = true;
    state.reason = activePhase.errNoConfig;
  } else if (now < new Date(activePhase.startDate).getTime()) {
    state.show = false;
    state.disabled = true;
    state.reason = activePhase.errEarly;
  }

  return state;
}
