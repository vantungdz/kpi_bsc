import {
  KpiCycleResponse,
  SubmitButtonState,
} from '@/types/shared/kpi-cycle.type';
import { KPI_STATUS } from '@/config/constants';

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

  // PENDING_ACCEPTANCE (404): GM đã approve, member cần accept → luôn show button dù date window đã qua
  const GOAL_SETTING_PENDING_STATUSES = [404, 406];
  // 402/403: đã nộp target setup và đang chờ duyệt -> ẩn nút submit
  const GOAL_SETTING_SUBMITTED_STATUSES = [402, 403];
  // Goal setting được xem là hoàn tất khi đã submit/chốt (trừ trạng thái bị từ chối 406).
  const GOAL_SETTING_DONE_STATUSES = [402, 403, 405, 501, 502, 503, 601, 602, 603];
  // 501/502: đã nộp mid-year, đang chờ PM/GM duyệt → ẩn nút submit
  const MID_YEAR_SUBMITTED_STATUSES = [501, 502];
  // 601/602: đã nộp end-year, đang chờ PM/GM duyệt → ẩn nút submit
  const END_YEAR_SUBMITTED_STATUSES = [601, 602];

  const phases = [
    {
      isDone: GOAL_SETTING_DONE_STATUSES.includes(statusCode),
      actionType: 'GOAL_SETTING' as const,
      text: 'Accept KPI',
      startDate: kpiCycle.goalSettingStart,
      endDate:   kpiCycle.goalSettingEnd,
      errNoConfig: 'The system has not configured the goal setting time',
      errEarly: 'It is not yet time to set goals',
      errLate:  'Goal setting period has ended',
      bypassDateCheck: GOAL_SETTING_PENDING_STATUSES.includes(statusCode),
      forceHide: GOAL_SETTING_SUBMITTED_STATUSES.includes(statusCode),
    },
    {
      // Mid-year chỉ "done" khi đã có submission mốc giữa năm.
      // Nếu quá hạn nhưng còn status 405 thì vẫn cho nộp trễ mid-year.
      isDone: statusCode >= 503 && statusCode !== 601 && statusCode !== 602,
      actionType: 'MID_YEAR' as const,
      text: 'Mid-Year Review',
      startDate: kpiCycle.midYearStart,
      endDate:   kpiCycle.midYearEnd,
      errNoConfig: 'The system has not configured the mid-year review time',
      errEarly: 'It is not yet time for the mid-year review',
      errLate:  'Mid-year review period has ended',
      bypassDateCheck: statusCode === 405 && (kpiCycle.midYearEnd ? now > new Date(kpiCycle.midYearEnd).getTime() : false),
      forceHide: MID_YEAR_SUBMITTED_STATUSES.includes(statusCode),
    },
    {
      isDone: statusCode >= 603, // isEndYearDone
      actionType: 'END_YEAR' as const,
      text: 'End-Year Review',
      startDate: kpiCycle.endYearStart,
      endDate:   kpiCycle.endYearEnd,
      errNoConfig: 'The system has not configured the end-year review time',
      errEarly: 'It is not yet time for the end-year review',
      errLate:  'End-year review period has ended',
      bypassDateCheck: false,
      forceHide: END_YEAR_SUBMITTED_STATUSES.includes(statusCode),
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

  // 4. Ẩn nút khi user đã submit phase này nhưng đang chờ PM/GM duyệt (501/502 hoặc 601/602)
  if (activePhase.forceHide) {
    state.show = false;
    state.disabled = true;
    return state;
  }

  // 5. Apply time window check: hide if not configured, too early, or past deadline.
  //    Skip this check when the user is in a "pending acceptance" state that requires action regardless of date.
  if (!activePhase.bypassDateCheck) {
    if (!activePhase.startDate) {
      state.show = false;
      state.disabled = true;
      state.reason = activePhase.errNoConfig;
    } else if (now < new Date(activePhase.startDate).getTime()) {
      state.show = false;
      state.disabled = true;
      state.reason = activePhase.errEarly;
    } else if (activePhase.endDate && now > new Date(activePhase.endDate).getTime()) {
      state.show = false;
      state.disabled = true;
      state.reason = activePhase.errLate;
    }
  }

  return state;
}

/**
 * PM tab KPI Portfolio — một nút theo trạng thái (tab PM gộp thêm điều kiện KPI Team: mọi member được phân bổ phải đã Accept trước khi PM Accept):
 * - **404**: "Accept KPI" — luôn bật (không khóa theo cửa sổ Goal setting); bấm → 405.
 * - **405 / 503**: "Send Review" — luôn bật; trong cửa sổ Year-end → 602, Mid-year → 502; ngoài cửa sổ → mặc định 502 (tooltip giải thích).
 * - Khác: nút hiển thị nhưng tắt (nhãn Accept KPI nếu chưa tới 404, Send Review nếu đã qua 405 hoặc 503).
 *
 * Tách biệt với {@link getSubmitButtonState} (Member/Leader): hàm đó vẫn dùng goalSetting + bypass 404 theo ngày;
 * chỉ nhánh PM 404 ở đây là bỏ ràng buộc ngày.
 */
export function getPmPortfolioSubmitButtonState(
  kpiCycle: KpiCycleResponse,
  statusCode: number,
  currentDateInput: string | number | Date = new Date(),
): SubmitButtonState {
  const now = new Date(currentDateInput).getTime();
  const sc = Number(statusCode);

  if (!Number.isFinite(sc) || sc >= KPI_STATUS.COMPLETED) {
    return {
      show: false,
      disabled: true,
      text: '',
      actionType: 'COMPLETED',
    };
  }

  /** Cửa sổ Goal setting — vẫn parse để đối chiếu chu kỳ / bật lại điều kiện ngày cho PM Accept nếu cần. */
  const goalStart = kpiCycle.goalSettingStart
    ? new Date(kpiCycle.goalSettingStart).getTime()
    : null;
  const goalEnd = kpiCycle.goalSettingEnd
    ? new Date(kpiCycle.goalSettingEnd).getTime()
    : null;

  const midStart = kpiCycle.midYearStart
    ? new Date(kpiCycle.midYearStart).getTime()
    : null;
  const midEnd = kpiCycle.midYearEnd
    ? new Date(kpiCycle.midYearEnd).getTime()
    : null;
  const endStart = kpiCycle.endYearStart
    ? new Date(kpiCycle.endYearStart).getTime()
    : null;
  const endEnd = kpiCycle.endYearEnd
    ? new Date(kpiCycle.endYearEnd).getTime()
    : null;

  const inRange = (start: number | null, end: number | null): boolean => {
    if (start == null) return false;
    if (now < start) return false;
    if (end != null && now > end) return false;
    return true;
  };

  const inEnd = inRange(endStart, endEnd);
  const inMid = inRange(midStart, midEnd);
  const inGoal = inRange(goalStart, goalEnd);

  // --- Accept KPI (404) — không ràng buộc ngày; cứ 404 là cho bấm ---
  if (sc === KPI_STATUS.PENDING_ACCEPTANCE) {
    void inGoal;
    // Trước đây khóa nút khi !goalStart hoặc !inGoal — tắt theo yêu cầu PM; bật lại bằng cách bỏ early return dưới đây:
    // if (!goalStart) {
    //   return {
    //     show: true,
    //     disabled: true,
    //     text: 'Accept KPI',
    //     actionType: 'GOAL_SETTING',
    //     reason: 'Chưa cấu hình cửa sổ Goal setting trên chu kỳ.',
    //   };
    // }
    // if (!inGoal) {
    //   return {
    //     show: true,
    //     disabled: true,
    //     text: 'Accept KPI',
    //     actionType: 'GOAL_SETTING',
    //     reason: 'Chưa trong cửa sổ Goal setting.',
    //   };
    // }
    return {
      show: true,
      disabled: false,
      text: 'Accept KPI',
      actionType: 'GOAL_SETTING',
    };
  }

  // --- Send Review (405 Đang chạy, hoặc 503 Đã chốt 1st half) ---
  if (sc === KPI_STATUS.ACCEPTED || sc === KPI_STATUS.FIRST_COMPLETED) {
    if (sc === KPI_STATUS.ACCEPTED) {
      const passedMidYear = midEnd != null && Number.isFinite(midEnd) && now > midEnd;
      
      if (passedMidYear) {
        // Đã qua hạn Mid-year → Chuyển sang nộp End-year
        if (!endStart) {
          return {
            show: true,
            disabled: true,
            text: 'Send Review',
            actionType: 'END_YEAR',
            reason: 'Chưa cấu hình cửa sổ đánh giá cuối kỳ.',
          };
        }
        if (!inEnd) {
          // Chưa tới cửa sổ End-Year hoặc đã quá hạn End-Year
          return {
            show: true,
            disabled: true,
            text: 'Send Review',
            actionType: 'END_YEAR',
            reason: 'Không nằm trong khoảng thời gian đánh giá cuối kỳ.',
          };
        }
        return {
          show: true,
          disabled: false,
          text: 'Send Review',
          actionType: 'END_YEAR',
        };
      }
      
      // Chưa lố hạn Mid-year → kiểm tra Mid-year bình thường
      if (!midStart) {
        return {
          show: true,
          disabled: true,
          text: 'Send Review',
          actionType: 'MID_YEAR',
          reason: 'Chưa cấu hình cửa sổ đánh giá giữa kỳ.',
        };
      }
      if (!inMid) {
        return {
          show: true,
          disabled: true,
          text: 'Send Review',
          actionType: 'MID_YEAR',
          reason: 'Không nằm trong khoảng thời gian đánh giá giữa kỳ.',
        };
      }
      return {
        show: true,
        disabled: false,
        text: 'Send Review',
        actionType: 'MID_YEAR',
      };
    } else {
      if (!endStart) {
        return {
          show: true,
          disabled: true,
          text: 'Send Review',
          actionType: 'END_YEAR',
          reason: 'Chưa cấu hình cửa sổ đánh giá cuối kỳ.',
        };
      }
      if (!inEnd) {
        return {
          show: true,
          disabled: true,
          text: 'Send Review',
          actionType: 'END_YEAR',
          reason: 'Không nằm trong khoảng thời gian đánh giá cuối kỳ.',
        };
      }
      return {
        show: true,
        disabled: false,
        text: 'Send Review',
        actionType: 'END_YEAR',
      };
    }
  }

  // Trước 404: vẫn hiện Accept KPI (tắt)
  if (sc < KPI_STATUS.PENDING_ACCEPTANCE) {
    return {
      show: true,
      disabled: true,
      text: 'Accept KPI',
      actionType: 'GOAL_SETTING',
      reason: 'Chờ trạng thái Chờ xác nhận (404) để chấp nhận KPI.',
    };
  }

  // Sau 405: hiện Send Review (tắt)
  return {
    show: true,
    disabled: true,
    text: 'Send Review',
    actionType: 'MID_YEAR',
    reason: 'Không gửi đánh giá ở trạng thái này.',
  };
}
