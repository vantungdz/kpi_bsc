/**
 * 11 KPI cá nhân (PM Dashboard — demo theo prototype evd.html), đồng bộ sheet NV 834 trong pmManager.mock.
 */
import {
  MOCK_PM_EMPLOYEES,
  flattenKpiItems,
  type PmManagerKpiItem,
} from '@/data/pmManager.mock'
import type { MemberKpiEvaluationStatus } from '@/types/kpi'
import { isReadonlyKpiYear } from '@/utils/kpi-year'

export type PmPersonalKpiCase = 'monthly' | 'project_metrics' | 'general' | 'upload_only'

export interface PmPersonalKpiDisplayRow {
  lineId: string
  index: number
  code: string
  title: string
  caseType: PmPersonalKpiCase
  caseLabel: string
  caseBadgeClass: string
  targetSummary: string
  targetHint: string
  weight: number
  evidenceStatus: 'submitted' | 'missing' | 'pending'
  selfScore: number
  evidenceDrawerName: string
  evidenceTargetDesc: string
  groupBanner?: string
  evidence: PmManagerKpiItem['evidence']
  evaluationStatus: MemberKpiEvaluationStatus
  pmScore: number | null
  certificateOutcomeNote?: string
}

const CASE_FOR_LINE: Record<string, PmPersonalKpiCase> = {
  a1a: 'project_metrics',
  a2a: 'monthly',
  a3a: 'project_metrics',
  a4: 'general',
  a5a: 'general',
  a6: 'general',
  a7: 'general',
  b1: 'general',
  b2: 'general',
  b3: 'upload_only',
  b4: 'upload_only',
}

const EVAL_STATUS_BY_LINE_ID: Record<string, MemberKpiEvaluationStatus> = {
  a1a: 'pending_approval',
  a2a: 'revision',
  a3a: 'overdue',
  a4: 'pending_approval',
  a5a: 'not_started',
  a6: 'approved',
  a7: 'approved',
  b1: 'revision',
  b2: 'not_started',
  b3: 'overdue',
  b4: 'pending_approval',
}

const PM_SCORE_BY_LINE_ID: Record<string, number | null> = {
  a1a: null,
  a2a: null,
  a3a: null,
  a4: null,
  a5a: null,
  a6: null,
  a7: null,
  b1: null,
  b2: null,
  b3: null,
  b4: null,
}

const BADGE_FOR_LINE: Record<string, string> = {
  a1a: 'bg-indigo-100 text-indigo-800',
  a2a: 'bg-blue-100 text-blue-700',
  a3a: 'bg-purple-100 text-purple-700',
  a4: 'bg-amber-100 text-amber-800',
  a5a: 'bg-cyan-100 text-cyan-800',
  a6: 'bg-slate-200 text-slate-800',
  a7: 'bg-teal-100 text-teal-700',
  b1: 'bg-emerald-100 text-emerald-800',
  b2: 'bg-emerald-100 text-emerald-700',
  b3: 'bg-pink-100 text-pink-700',
  b4: 'bg-rose-100 text-rose-700',
}

function parseCodeFromTitle(title: string): string {
  const t = title.trim().split(/\s+/)
  return t[0] ?? title
}

function shortTitleWithoutCode(title: string): string {
  const i = title.indexOf(' ')
  return i === -1 ? title : title.slice(i + 1).trim()
}

function targetSummaryFromTarget(target: string): string {
  return target.replace(/^Target:\s*/i, '').replace(/^Mục tiêu:\s*/i, '').trim()
}

function evidenceStatusFromScore(score: number): 'submitted' | 'missing' | 'pending' {
  if (score >= 4) return 'submitted'
  if (score >= 3) return 'pending'
  return 'missing'
}

function itemToRow(item: PmManagerKpiItem): PmPersonalKpiDisplayRow {
  const code = parseCodeFromTitle(item.title)
  const caseType = CASE_FOR_LINE[item.id] ?? 'general'
  const zone = item.index <= 7 ? '(A)' : '(B)'
  const caseLabel = `${zone} ${code}`

  return {
    lineId: item.id,
    index: item.index,
    code,
    title: item.title,
    caseType,
    caseLabel,
    caseBadgeClass: BADGE_FOR_LINE[item.id] ?? 'bg-slate-100 text-slate-700',
    targetSummary: targetSummaryFromTarget(item.target),
    targetHint: `${item.evidenceButtonLabel} · ${item.evidence.title}`,
    weight: item.weight,
    evidenceStatus: evidenceStatusFromScore(item.selfScore),
    selfScore: item.selfScore,
    evidenceDrawerName: shortTitleWithoutCode(item.title),
    evidenceTargetDesc: item.target.trim(),
    groupBanner:
      item.index === 1
        ? '(A) Hiệu suất, Cải tiến & Năng lực chuyên môn'
        : item.index === 8
          ? '(B) Mục tiêu đào tạo & phát triển'
          : undefined,
    evidence: item.evidence,
    evaluationStatus: EVAL_STATUS_BY_LINE_ID[item.id] ?? 'not_started',
    pmScore: PM_SCORE_BY_LINE_ID[item.id] ?? null,
    certificateOutcomeNote:
      item.id === 'b3'
        ? 'Thực tế nộp minh chứng: JLPT N2 (12/2024). Sheet đăng ký: TOEIC 700 / JLPT N3 — đính kèm scan / link tra cứu.'
        : undefined,
  }
}

const demoEmp =
  MOCK_PM_EMPLOYEES.find((e) => flattenKpiItems(e).length >= 11) ?? MOCK_PM_EMPLOYEES[0]

const BASE_ROWS: PmPersonalKpiDisplayRow[] = demoEmp.groups
  .flatMap((g) => g.items)
  .map(itemToRow)

export function getPmPersonalKpiDisplayRows(year: number): PmPersonalKpiDisplayRow[] {
  if (isReadonlyKpiYear(year)) {
    return BASE_ROWS.map((r) => ({
      ...r,
      evidenceStatus: 'submitted' as const,
      selfScore: Math.max(4, r.selfScore),
      evaluationStatus: 'approved' as const,
      pmScore:
        r.pmScore ??
        Math.min(5, Math.round((Math.max(4, r.selfScore) + 0.08) * 100) / 100),
      certificateOutcomeNote:
        r.lineId === 'b3'
          ? 'Đã chốt: JLPT N2 (minh chứng đã xác minh). Mục tiêu đăng ký trên sheet: TOEIC 700 / JLPT N3.'
          : undefined,
    }))
  }
  return BASE_ROWS.map((r) => ({ ...r }))
}
