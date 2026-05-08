export interface GmReportLevelDef {
  code: string
  label: string
  min: number | string
  max: number | string
  pitch: number | string
}

export interface GmReportYearSeries {
  year: number
  counts: number[]
}

export interface GmReportTopPerformer {
  userId: string
  fullName: string
  roleCode: string
  sectionName: string
  levelCode: string
  score: number | string
}

export interface GmReportLevelDistributionData {
  levels: GmReportLevelDef[]
  years: GmReportYearSeries[]
  topPerformers: GmReportTopPerformer[]
  totalCount: number
}

export interface GmReportSectionSeries {
  id: string
  label: string
  counts: number[]
}

export interface GmReportSectionBellSummary {
  avgCompany: number | string | null
  bestSectionName: string
  worstSectionName: string
  topGroupCount: number
  topGroupPercent: number | string
  totalCount: number
}

export interface GmReportSectionBellCurveData {
  levelLabels: string[]
  sections: GmReportSectionSeries[]
  summary: GmReportSectionBellSummary
}

export interface GmReportSectionScore {
  sectionId: string
  sectionName: string
  averageScore: number | string
}

export interface GmReportRadarSeries {
  sectionId: string
  sectionName: string
  data: (number | string)[]
}

export interface GmReportRadarPayload {
  dimensions: string[]
  series: GmReportRadarSeries[]
}

export interface GmReportSectionAnalyticsData {
  sectionAverages: GmReportSectionScore[]
  radar: GmReportRadarPayload
}

export interface GmReportComplianceStatus {
  completed: number
  pendingApproval: number
  missingEvidence: number
  total: number
  percentComplete: number
}

export interface GmReportComplianceBottleneck {
  userId: string
  fullName: string
  roleCode: string
  sectionName: string
  reason: string
  severity: 'info' | 'warning' | 'critical'
  delayLabel: string
}

export interface GmReportComplianceData {
  status: GmReportComplianceStatus
  bottlenecks: GmReportComplianceBottleneck[]
}
