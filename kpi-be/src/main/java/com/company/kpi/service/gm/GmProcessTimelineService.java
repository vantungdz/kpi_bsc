package com.company.kpi.service.gm;

import com.company.kpi.aggregate.GmTimelineIssueRow;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.response.gm.GmProcessTimelineResponse;
import com.company.kpi.response.gm.GmTimelineIssueBucketDto;
import com.company.kpi.response.gm.GmTimelineIssueDetailDto;
import com.company.kpi.response.gm.GmTimelinePhaseData;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Xây dựng dữ liệu Process Timeline cho GM dashboard.
 *
 * <p>Logic phân loại:
 * <ul>
 *   <li>Phase SETTING  (401-406): lấy từ {@code listTimelineAssignments}</li>
 *   <li>Phase MID-YEAR (501-502): lấy từ {@code listTimelineAssignments};
 *       "not_submitted" thêm từ {@code listInProgressWithinPhaseWindow} với statuses=[405], phase="mid"</li>
 *   <li>Phase YEAR-END (601-602): lấy từ {@code listTimelineAssignments};
 *       "not_submitted" thêm từ {@code listInProgressWithinPhaseWindow} với statuses=[405,503], phase="yearEnd"</li>
 * </ul>
 *
 * <p>Bottleneck mapping:
 * <pre>
 *   401 → Member   | 402 → PM     | 403 → GM | 404 → Member | 406 → PM
 *   501 → PM       | 502 → GM
 *   601 → PM       | 602 → GM
 *   not_submitted  → Member
 * </pre>
 */
@Service
@RequiredArgsConstructor
public class GmProcessTimelineService {

    // ── Setting phase ──────────────────────────────────────────────────────────
    private static final int STATUS_DRAFT            = 401;
    private static final int STATUS_WAITING_PM       = 402;
    private static final int STATUS_WAITING_GM       = 403;
    private static final int STATUS_PENDING_ACCEPT   = 404;
    private static final int STATUS_ACCEPTED         = 405;
    private static final int STATUS_REJECTED         = 406;

    // ── Mid-year phase ─────────────────────────────────────────────────────────
    private static final int STATUS_MID_WAITING_PM   = 501;
    private static final int STATUS_MID_WAITING_GM   = 502;
    private static final int STATUS_MID_COMPLETED    = 503;

    // ── Year-end phase ─────────────────────────────────────────────────────────
    private static final int STATUS_END_WAITING_PM   = 601;
    private static final int STATUS_END_WAITING_GM   = 602;

    // ── Issue type IDs (khớp với FE GmIssueTypeId) ────────────────────────────
    private static final String ISSUE_PENDING       = "pending_approval";
    private static final String ISSUE_PENDING_ACCEPT = "pending_acceptance";
    private static final String ISSUE_NOT_SUBMITTED = "not_submitted";
    private static final String ISSUE_MISSING_EV    = "missing_evidence";

    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final KpiCycleMapper kpiCycleMapper;

    public GmProcessTimelineResponse getTimeline(UUID cycleId) {
        kpiCycleMapper.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + cycleId));

        List<GmTimelineIssueRow> allRows = kpiAssignmentMapper.listTimelineAssignments(cycleId);

        // not_submitted: ASM đang ở 405 trong window mid-year
        List<GmTimelineIssueRow> midNotSubmitted =
                kpiAssignmentMapper.listInProgressWithinPhaseWindow(
                        cycleId, List.of(STATUS_ACCEPTED), "mid");

        // not_submitted: ASM đang ở 405 hoặc 503 trong window year-end
        List<GmTimelineIssueRow> yearEndNotSubmitted =
                kpiAssignmentMapper.listInProgressWithinPhaseWindow(
                        cycleId, List.of(STATUS_ACCEPTED, STATUS_MID_COMPLETED), "yearEnd");

        GmProcessTimelineResponse response = new GmProcessTimelineResponse();
        response.setSetting(buildSettingPhase(allRows));
        response.setMidYear(buildMidYearPhase(allRows, midNotSubmitted));
        response.setYearEnd(buildYearEndPhase(allRows, yearEndNotSubmitted));
        return response;
    }

    // ── Phase builders ─────────────────────────────────────────────────────────

    private GmTimelinePhaseData buildSettingPhase(List<GmTimelineIssueRow> allRows) {
        Map<String, GmTimelineIssueBucketDto> buckets = new LinkedHashMap<>();

        for (GmTimelineIssueRow row : allRows) {
            int code = row.getStatusCode();
            // 405 (Đã chốt) không phải là issue của quá trình Setting
            if (code < 401 || code > 406 || code == STATUS_ACCEPTED) continue;

            GmTimelineIssueDetailDto detail = buildDetail(row,
                    bottleneckForSetting(code),
                    reasonForSetting(code));
            switch (code) {
                // 401 INACTIVE: KPI mới tạo/chưa kích hoạt -> chưa hoàn tất luồng submit.
                case STATUS_DRAFT:
                // 406 REJECTED: đã bị từ chối -> cần chỉnh sửa và submit lại.
                case STATUS_REJECTED:
                    addToBucket(buckets, ISSUE_NOT_SUBMITTED, "KPIs Chưa Submit",
                            "bg-orange-100 text-orange-600", detail);
                    break;
                // 402/403: chờ PM/GM duyệt. 404: chờ Member Accept -> vẫn là trạng thái pending.
                case STATUS_WAITING_PM:
                case STATUS_WAITING_GM:
                    addToBucket(buckets, ISSUE_PENDING, "KPIs Pending Approval",
                            "bg-orange-100 text-orange-600", detail);
                    break;
                case STATUS_PENDING_ACCEPT:
                    addToBucket(buckets, ISSUE_PENDING_ACCEPT, "KPIs Chờ Member Accept",
                            "bg-orange-100 text-orange-600", detail);
                    break;
                default:
                    break;
            }
        }

        return buildPhaseData(buckets, "KPI Setting");
    }

    private GmTimelinePhaseData buildMidYearPhase(
            List<GmTimelineIssueRow> allRows,
            List<GmTimelineIssueRow> notSubmitted) {

        Map<String, GmTimelineIssueBucketDto> buckets = new LinkedHashMap<>();

        // not_submitted từ window query
        for (GmTimelineIssueRow row : notSubmitted) {
            addToBucket(buckets, ISSUE_NOT_SUBMITTED, "KPIs Chưa Submit",
                    "bg-orange-100 text-orange-600",
                    buildDetail(row, "Member", "Đang trong kỳ Mid-Year nhưng chưa nộp evidence"));
        }

        for (GmTimelineIssueRow row : allRows) {
            int code = row.getStatusCode();
            if (code != STATUS_MID_WAITING_PM && code != STATUS_MID_WAITING_GM) continue;

            // 501 + evidences=null → missing_evidence
            if (code == STATUS_MID_WAITING_PM && row.getEvidences() == null) {
                addToBucket(buckets, ISSUE_MISSING_EV, "KPIs Thiếu Evidence",
                        "bg-rose-100 text-rose-600",
                        buildDetail(row, "Member", "Đã nộp nhưng thiếu file đính kèm"));
            }

            // pending: 501 → PM, 502 → GM
            String bottleneck = (code == STATUS_MID_WAITING_PM) ? "PM" : "GM";
            String reason     = (code == STATUS_MID_WAITING_PM)
                    ? "PM chưa review evidence giữa kỳ"
                    : "GM chưa chốt điểm giữa kỳ";
            addToBucket(buckets, ISSUE_PENDING, "KPIs Pending Approval",
                    "bg-orange-100 text-orange-600",
                    buildDetail(row, bottleneck, reason));
        }

        return buildPhaseData(buckets, "Mid-Year Review");
    }

    private GmTimelinePhaseData buildYearEndPhase(
            List<GmTimelineIssueRow> allRows,
            List<GmTimelineIssueRow> notSubmitted) {

        Map<String, GmTimelineIssueBucketDto> buckets = new LinkedHashMap<>();

        for (GmTimelineIssueRow row : notSubmitted) {
            addToBucket(buckets, ISSUE_NOT_SUBMITTED, "KPIs Chưa Submit",
                    "bg-orange-100 text-orange-600",
                    buildDetail(row, "Member", "Đang trong kỳ Year-End nhưng chưa nộp evidence"));
        }

        for (GmTimelineIssueRow row : allRows) {
            int code = row.getStatusCode();
            if (code != STATUS_END_WAITING_PM && code != STATUS_END_WAITING_GM) continue;

            String bottleneck = (code == STATUS_END_WAITING_PM) ? "PM" : "GM";
            String reason     = (code == STATUS_END_WAITING_PM)
                    ? "PM chưa chấm điểm Final"
                    : "GM chưa chốt điểm Final";
            addToBucket(buckets, ISSUE_PENDING, "KPIs Pending Approval",
                    "bg-orange-100 text-orange-600",
                    buildDetail(row, bottleneck, reason));
        }

        return buildPhaseData(buckets, "Year-End Review");
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private GmTimelineIssueDetailDto buildDetail(
            GmTimelineIssueRow row, String bottleneck, String reason) {
        GmTimelineIssueDetailDto d = new GmTimelineIssueDetailDto();
        d.setKpi(row.getKpiName());
        d.setMember(row.getMemberName());
        d.setPm(row.getPmName());
        d.setLeader(null); // V1: chưa join cấp leader
        d.setBottleneck(bottleneck);
        d.setReason(reason);
        return d;
    }

    private void addToBucket(
            Map<String, GmTimelineIssueBucketDto> buckets,
            String id, String title, String iconClass,
            GmTimelineIssueDetailDto detail) {
        GmTimelineIssueBucketDto bucket = buckets.computeIfAbsent(id, k -> {
            GmTimelineIssueBucketDto b = new GmTimelineIssueBucketDto();
            b.setId(id);
            b.setTitle(title);
            b.setIconClass(iconClass);
            return b;
        });
        bucket.getItems().add(detail);
    }

    private GmTimelinePhaseData buildPhaseData(
            Map<String, GmTimelineIssueBucketDto> buckets, String phaseLabel) {
        GmTimelinePhaseData phase = new GmTimelinePhaseData();
        List<GmTimelineIssueBucketDto> list = new ArrayList<>(buckets.values());
        phase.setIssueDetails(list);

        int totalIssues = list.stream()
                .mapToInt(b -> b.getItems().size())
                .sum();
        phase.setHasOpenIssues(totalIssues > 0);
        phase.setPendingKpisLine(totalIssues + " KPI chưa hoàn thành");
        phase.setPopoverTitle(totalIssues + " issues — " + phaseLabel);
        return phase;
    }

    // ── Setting bottleneck/reason helpers ──────────────────────────────────────

    private String bottleneckForSetting(int code) {
        return switch (code) {
            case STATUS_DRAFT, STATUS_PENDING_ACCEPT -> "Member";
            case STATUS_WAITING_GM                   -> "GM";
            default                                   -> "PM"; // 402, 406
        };
    }

    private String reasonForSetting(int code) {
        return switch (code) {
            case STATUS_DRAFT          -> "Draft chưa được submit lên PM";
            case STATUS_WAITING_PM     -> "PM chưa duyệt đề xuất";
            case STATUS_WAITING_GM     -> "Chờ GM duyệt tạo mới";
            case STATUS_PENDING_ACCEPT -> "Member chưa bấm Accept";
            case STATUS_REJECTED       -> "KPI bị từ chối — cần xử lý lại";
            default                    -> "Đang chờ duyệt";
        };
    }
}
