package com.company.kpi.util;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MemberEvaluationVisibilityTest {

    private static final String EVIDENCES_WITH_SNAPSHOT =
            "{\"actual\":\"95%\",\"approvedMidYearSnapshot\":"
                    + "{\"selfScore\":3,\"actual\":\"70%\",\"capturedAt\":\"2026-05-26T10:00:00+07:00\"}}";

    @Test
    void canSupervisorViewMemberSelfEvaluation_pmSees601() {
        assertTrue(MemberEvaluationVisibility.canSupervisorViewMemberSelfEvaluation(601, false));
        assertFalse(MemberEvaluationVisibility.canSupervisorViewMemberSelfEvaluation(601, true));
    }

    @Test
    void canPmOwnViewPortfolioEvaluation_includes601() {
        assertTrue(MemberEvaluationVisibility.canPmOwnViewPortfolioEvaluation(601));
    }

    @Test
    void resolvePmTableSelfScore_601_usesSnapshotNotLiveMid() {
        BigDecimal score =
                MemberEvaluationVisibility.resolvePmTableSelfScore(
                        601, new BigDecimal("5"), new BigDecimal("5"), EVIDENCES_WITH_SNAPSHOT);
        assertEquals(0, new BigDecimal("3").compareTo(score));
    }

    @Test
    void resolvePmTableSelfScore_601_withSnapshot_neverUsesEndScore() {
        BigDecimal score =
                MemberEvaluationVisibility.resolvePmTableSelfScore(
                        601, new BigDecimal("3"), new BigDecimal("9"), EVIDENCES_WITH_SNAPSHOT);
        assertEquals(0, new BigDecimal("3").compareTo(score));
    }

    @Test
    void resolvePmTableActual_601_usesSnapshotActual() {
        String actual =
                MemberEvaluationVisibility.resolvePmTableActual(601, EVIDENCES_WITH_SNAPSHOT);
        assertEquals("70%", actual);
    }

    @Test
    void resolvePmTableSelfScore_602_usesEndYearScore() {
        BigDecimal score =
                MemberEvaluationVisibility.resolvePmTableSelfScore(
                        602, new BigDecimal("3"), new BigDecimal("5"), EVIDENCES_WITH_SNAPSHOT);
        assertEquals(0, new BigDecimal("5").compareTo(score));
    }

    @Test
    void resolveGmTableSelfScore_602_usesSnapshot() {
        BigDecimal score =
                MemberEvaluationVisibility.resolveGmTableSelfScore(
                        602, new BigDecimal("3"), new BigDecimal("5"), EVIDENCES_WITH_SNAPSHOT);
        assertEquals(0, new BigDecimal("3").compareTo(score));
    }

    @Test
    void canDiagnosticsShowMemberActual_includes601And602() {
        assertTrue(MemberEvaluationVisibility.canDiagnosticsShowMemberActual(503));
        assertTrue(MemberEvaluationVisibility.canDiagnosticsShowMemberActual(601));
        assertTrue(MemberEvaluationVisibility.canDiagnosticsShowMemberActual(602));
        assertTrue(MemberEvaluationVisibility.canDiagnosticsShowMemberActual(603));
        assertFalse(MemberEvaluationVisibility.canDiagnosticsShowMemberActual(501));
        assertFalse(MemberEvaluationVisibility.canDiagnosticsShowMemberActual(604));
    }

    @Test
    void resolveGmTableSelfScore_603_usesEndYearScore() {
        BigDecimal score =
                MemberEvaluationVisibility.resolveGmTableSelfScore(
                        603, new BigDecimal("3"), new BigDecimal("5"), EVIDENCES_WITH_SNAPSHOT);
        assertEquals(0, new BigDecimal("5").compareTo(score));
    }
}
