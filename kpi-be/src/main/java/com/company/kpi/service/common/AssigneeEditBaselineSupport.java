package com.company.kpi.service.common;

import com.company.kpi.response.gm.GmApprovedKpiQueueItemResponse;
import com.company.kpi.response.pm.PmMemberKpiApprovalItemResponse;
import com.company.kpi.service.kpi.KpiScoringRulesService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * Chốt và so sánh baseline assignee (target / scoring) cho drawer PM/GM duyệt.
 */
@Component
@RequiredArgsConstructor
public class AssigneeEditBaselineSupport {

    private final KpiScoringRulesService kpiScoringRulesService;

    public void enrichApprovedQueueItem(GmApprovedKpiQueueItemResponse row) {
        if (row == null) {
            return;
        }
        DiffResult d =
                computeDiff(
                        row.getTargetValue(),
                        row.getBaselineTargetValue(),
                        row.getTargetDescription(),
                        row.getBaselineScoringDescription());
        row.setTargetChanged(d.targetChanged());
        row.setScoringChanged(d.scoringChanged());
        row.setAssigneeHasEdits(d.assigneeHasEdits());
        if (d.baselineScoringDisplay() != null) {
            row.setBaselineScoringDescription(d.baselineScoringDisplay());
        }
    }

    public void enrichPmApprovalItem(PmMemberKpiApprovalItemResponse row) {
        if (row == null) {
            return;
        }
        DiffResult d =
                computeDiff(
                        row.getTargetValue(),
                        row.getBaselineTargetValue(),
                        row.getTargetDescription(),
                        row.getBaselineScoringDescription());
        row.setTargetChanged(d.targetChanged());
        row.setScoringChanged(d.scoringChanged());
        row.setAssigneeHasEdits(d.assigneeHasEdits());
        if (d.baselineScoringDisplay() != null) {
            row.setBaselineScoringDescription(d.baselineScoringDisplay());
        }
    }

    private DiffResult computeDiff(
            BigDecimal currentTarget,
            BigDecimal baselineTarget,
            String currentScoringStored,
            String baselineScoringStored) {
        boolean hasBaseline =
                baselineTarget != null
                        || (baselineScoringStored != null && !baselineScoringStored.isBlank());
        boolean targetChanged =
                hasBaseline && !targetsEqual(currentTarget, baselineTarget);
        boolean scoringChanged =
                hasBaseline && !scoringTextsEqual(currentScoringStored, baselineScoringStored);
        String baselineDisplay = null;
        if (baselineScoringStored != null && !baselineScoringStored.isBlank()) {
            String raw = scoringRawText(baselineScoringStored);
            baselineDisplay = raw.isBlank() ? baselineScoringStored.trim() : raw;
        }
        return new DiffResult(
                targetChanged,
                scoringChanged,
                targetChanged || scoringChanged,
                baselineDisplay);
    }

    public String scoringRawText(String storedJsonOrText) {
        if (storedJsonOrText == null || storedJsonOrText.isBlank()) {
            return "";
        }
        String raw = kpiScoringRulesService.parseForApi(storedJsonOrText).getRawInput();
        return raw == null ? "" : raw.trim();
    }

    private boolean targetsEqual(BigDecimal current, BigDecimal baseline) {
        if (baseline == null) {
            return current == null;
        }
        if (current == null) {
            return false;
        }
        return current.stripTrailingZeros().compareTo(baseline.stripTrailingZeros()) == 0;
    }

    private boolean scoringTextsEqual(String currentStored, String baselineStored) {
        String a = scoringRawText(currentStored);
        String b = scoringRawText(baselineStored);
        if (a.isEmpty() && b.isEmpty()) {
            return Objects.equals(
                    normalizeLoose(currentStored), normalizeLoose(baselineStored));
        }
        return a.equals(b);
    }

    private static String normalizeLoose(String s) {
        return s == null ? "" : s.replaceAll("\\s+", " ").trim();
    }

    private record DiffResult(
            boolean targetChanged,
            boolean scoringChanged,
            boolean assigneeHasEdits,
            String baselineScoringDisplay) {}
}
