import type {
  GmMidYearIssuesData,
  GmPortfolioDonutData,
  GmWorkspaceCycleSnapshot,
} from '@/types/gm-workspace'

const EMPTY_TIMELINE: GmMidYearIssuesData = {
  hasOpenIssues: false,
  operationalIssueCount: 0,
  totalDistinctEmployeesAffected: 0,
  pendingKpisLine: '0 issues',
  popoverTitle: '0 issues',
  issueGroups: [],
}

const EMPTY_PORTFOLIO: GmPortfolioDonutData = {
  centerTotal: 0,
  centerSubtitle: '—',
  circles: [],
  legend: [],
}

/** Snapshot tối thiểu khi không còn mock theo chu kỳ — departments/members lấy từ API. */
export const EMPTY_GM_WORKSPACE_CYCLE_SNAPSHOT: GmWorkspaceCycleSnapshot = {
  departments: [],
  portfolioDonut: EMPTY_PORTFOLIO,
  midYearIssues: EMPTY_TIMELINE,
  settingIssues: EMPTY_TIMELINE,
  yearEndIssues: EMPTY_TIMELINE,
  hierarchyKpis: [],
  membersDetails: [],
  inactivePendingKpis: [],
  personalKpiRows: [],
}
