import { describe, expect, it } from 'vitest'
import { KPI_STATUS } from '@/config/constants'
import {
  canDiagnosticsShowMemberActual,
  canPmOwnViewPortfolioEvaluation,
  canSupervisorViewMemberSelfEvaluation,
  resolveGmDiagnosticsActual,
  resolveGmDiagnosticsSelfScore,
  resolveGmTableSelfScore,
  resolvePmTableActual,
  resolvePmTableSelfScore,
} from './memberEvaluationVisibility'

const EVIDENCES_WITH_SNAPSHOT = JSON.stringify({
  actual: '95%',
  approvedMidYearSnapshot: {
    selfScore: 3,
    actual: '70%',
    capturedAt: '2026-05-26T10:00:00+07:00',
  },
})

describe('memberEvaluationVisibility PM table 601', () => {
  it('PM can view member evaluation at 601', () => {
    expect(canSupervisorViewMemberSelfEvaluation(KPI_STATUS.SECOND_WAITING_PM_APPROVAL, 'pm')).toBe(
      true,
    )
    expect(canSupervisorViewMemberSelfEvaluation(KPI_STATUS.SECOND_WAITING_PM_APPROVAL, 'gm')).toBe(
      false,
    )
  })

  it('canPmOwnViewPortfolioEvaluation includes 601', () => {
    expect(canPmOwnViewPortfolioEvaluation(KPI_STATUS.SECOND_WAITING_PM_APPROVAL)).toBe(true)
  })

  it('resolvePmTableSelfScore at 601 uses snapshot not live mid/end', () => {
    expect(
      resolvePmTableSelfScore(
        KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
        5,
        5,
        EVIDENCES_WITH_SNAPSHOT,
      ),
    ).toBe(3)
  })

  it('resolvePmTableActual at 601 uses snapshot actual', () => {
    expect(resolvePmTableActual(KPI_STATUS.SECOND_WAITING_PM_APPROVAL, EVIDENCES_WITH_SNAPSHOT)).toBe(
      '70%',
    )
  })

  it('resolvePmTableSelfScore at 602 uses end year score', () => {
    expect(
      resolvePmTableSelfScore(
        KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
        3,
        5,
        EVIDENCES_WITH_SNAPSHOT,
      ),
    ).toBe(5)
  })

  it('canDiagnosticsShowMemberActual includes 601 and 602', () => {
    expect(canDiagnosticsShowMemberActual(KPI_STATUS.SECOND_WAITING_PM_APPROVAL)).toBe(true)
    expect(canDiagnosticsShowMemberActual(KPI_STATUS.SECOND_WAITING_GM_APPROVAL)).toBe(true)
    expect(canDiagnosticsShowMemberActual(KPI_STATUS.FIRST_WAITING_PM_APPROVAL)).toBe(false)
  })

  it('resolveGmDiagnosticsSelfScore at 601 uses snapshot', () => {
    expect(
      resolveGmDiagnosticsSelfScore(
        KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
        5,
        5,
        EVIDENCES_WITH_SNAPSHOT,
      ),
    ).toBe(3)
  })

  it('resolveGmDiagnosticsActual at 602 uses snapshot actual', () => {
    expect(
      resolveGmDiagnosticsActual(KPI_STATUS.SECOND_WAITING_GM_APPROVAL, EVIDENCES_WITH_SNAPSHOT),
    ).toBe('70%')
  })

  it('resolveGmTableSelfScore at 602 uses snapshot', () => {
    expect(
      resolveGmTableSelfScore(
        KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
        3,
        5,
        EVIDENCES_WITH_SNAPSHOT,
      ),
    ).toBe(3)
  })
})
