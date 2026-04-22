import type { PmKpiDashboard, PmTeamMember } from '@/types/kpi'
import { MOCK_PM_EMPLOYEES } from '@/data/pmManager.mock'
import { isReadonlyKpiYear } from '@/utils/kpi-year'

function parseDisplayScore(s: string | null): number | null {
  if (s == null || s.trim() === '' || s === '—') return null
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Đồng bộ danh sách team với mock PM Manager để demo nhất quán */
function buildPmTeamForYear(year: number): PmTeamMember[] {
  const locked = isReadonlyKpiYear(year)
  return MOCK_PM_EMPLOYEES.map((emp) => {
    const self = parseDisplayScore(emp.selfScoreDisplay)
    const pending = emp.status === 'pending_pm'
    const approved = emp.status === 'approved'

    if (locked) {
      const pm =
        self != null ? Math.min(5, Math.round((self + 0.08) * 100) / 100) : 4.0
      return {
        id: emp.id,
        name: emp.name,
        rank: emp.rank,
        sheetStatus: 'approved',
        selfScore: self,
        pmScore: pm,
        awaitingPmReview: false,
      }
    }

    return {
      id: emp.id,
      name: emp.name,
      rank: emp.rank,
      sheetStatus: pending ? 'submitted' : emp.status === 'self_scoring' ? 'draft' : 'approved',
      selfScore: self,
      pmScore:
        approved && self != null
          ? Math.min(5, Math.round((self + 0.12) * 100) / 100)
          : null,
      awaitingPmReview: pending,
    }
  })
}

export function getMockPmKpiDashboard(year = new Date().getFullYear()): PmKpiDashboard {
  const locked = isReadonlyKpiYear(year)
  return {
    year,
    phase: 'year_end',
    teamMembers: buildPmTeamForYear(year),
    mySheet: {
      id: 'sheet-pm-1',
      userId: 'u-pm-1',
      userName: 'Nguyễn Văn PM',
      rank: 'R6',
      year,
      phase: 'year_end',
      items: [
        {
          id: 'item-pm-c1',
          code: 'C.1',
          name: 'Gross Profit Achievement',
          description: 'Tỷ lệ lợi nhuận gộp của section',
          target: 'GP >= 32%',
          weight: 35,
          group: 'C',
          evidenceStatus: 'submitted',
          selfScore: 4,
          pmScore: null,
          leaderScore: null,
        },
        {
          id: 'item-pm-a1',
          code: 'A.1',
          name: 'Team Efficiency',
          description: 'Hiệu suất tổng thể của team',
          target: 'TE >= 3.0',
          weight: 30,
          group: 'A',
          evidenceStatus: 'submitted',
          selfScore: 3,
          pmScore: null,
          leaderScore: null,
        },
        {
          id: 'item-pm-b1',
          code: 'B.1',
          name: 'People Development',
          description: 'Phát triển đội ngũ, tỷ lệ thăng cấp',
          target: 'PD >= 3.0',
          weight: 20,
          group: 'B',
          evidenceStatus: locked ? 'submitted' : 'missing',
          selfScore: locked ? 4 : null,
          pmScore: null,
          leaderScore: null,
        },
        {
          id: 'item-pm-a2',
          code: 'A.7',
          name: 'Security Compliance',
          description: 'Tuân thủ bảo mật thông tin',
          target: 'No major violations',
          weight: 15,
          group: 'A',
          evidenceStatus: 'submitted',
          selfScore: 5,
          pmScore: null,
          leaderScore: null,
        },
      ],
      totalWeight: 100,
      evidenceCount: locked ? 4 : 3,
      evidenceTotalCount: 4,
      status: locked ? 'approved' : 'draft',
    },
  }
}
