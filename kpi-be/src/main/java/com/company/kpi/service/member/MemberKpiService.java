package com.company.kpi.service.member;

import com.company.kpi.common.constant.Constant;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.entity.User;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.KpiLibraryMapper;
import com.company.kpi.mapper.KpiCategoryMapper;
import com.company.kpi.mapper.SysStatusCodeMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.request.member.CreateIndividualKpiRequest;
import com.company.kpi.request.member.MemberSheetItemUpdateRequest;
import com.company.kpi.request.member.SaveDraftRequest;
import com.company.kpi.request.member.SubmitEvalRequest;
import com.company.kpi.request.member.SubmitMemberSheetRequest;
import com.company.kpi.response.member.MemberKpiAssignmentDTO;
import com.company.kpi.response.member.MemberKpiDashboardResponse;
import com.company.kpi.response.member.MemberKpiDashboardResponse.MemberKpiItemPayload;
import com.company.kpi.response.member.MemberKpiDashboardResponse.MemberKpiSheetPayload;
import com.company.kpi.response.member.MemberKpiFormMetaResponse;
import com.company.kpi.response.pm.KpiSheetResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Year;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Member KPI — đồng bộ luồng trong {@code document/db/README.md} và schema {@code document/db/init-db.sql}:
 * <ul>
 *   <li><b>Flow 2</b> {@code target_setup}: chỉ bulk ASM {@code 404→405} (xác nhận KPI PM giao). Mid/end: thêm điều kiện điểm + {@code 501}/{@code 601}.</li>
 *   <li><b>Flow 3</b> Bottom-up: {@link #createIndividualKpi} → ASM {@code 402}.</li>
 *   <li><b>Flow 5</b> (member): phase theo {@code kpi_cycles} deadlines; submit sheet → {@code 501}/{@code 601}.</li>
 * </ul>
 * Flow 4 (xin đổi target / {@code update_payload}) chưa có mã ASM trong {@code init-db.sql} — không triển khai ở đây.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MemberKpiService {

    private static final int KPI_TYPE_PROMOTION = 103;
    private static final int KPI_TYPE_INDIVIDUAL = 101;
    private static final int CALC_TYPE_MANUAL_RATING = 703;
    private static final int KPI_UNIT_POINT = 903;
    /** README Flow 3 — member tạo KPI chờ PM */
    private static final int ASM_MEMBER_CREATED_PENDING_PM = 402;

    /** ASM_STATUS labels — đồng bộ document/db/init-db.sql */
    private static final Map<Integer, String> ASM_STATUS_LABEL = Map.ofEntries(
            Map.entry(401, "Chưa kích hoạt"),
            Map.entry(402, "Chờ PM duyệt (tạo mới)"),
            Map.entry(403, "Chờ GM duyệt (tạo mới)"),
            Map.entry(404, "Chờ Member Accept"),
            Map.entry(405, "Đang chạy"),
            Map.entry(406, "Từ chối"),
            Map.entry(501, "Đã nộp 1st Half · Chờ PM"),
            Map.entry(502, "1st Half · Chờ GM"),
            Map.entry(503, "Đã chốt 1st Half"),
            Map.entry(601, "Final · Chờ PM"),
            Map.entry(602, "Final · Chờ GM"),
            Map.entry(603, "Đã chốt sổ"));

    private final KpiCycleMapper kpiCycleMapper;
    private final UserMapper userMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final KpiLibraryMapper kpiLibraryMapper;
    private final KpiCategoryMapper kpiCategoryMapper;
    private final SysStatusCodeMapper sysStatusCodeMapper;
    private final ObjectMapper objectMapper;

    /** Form tạo KPI: {@code kpi_categories} + CALC_RULE 801–804 từ {@code sys_status_codes}. */
    public MemberKpiFormMetaResponse getFormMeta() {
        return MemberKpiFormMetaResponse.builder()
                .kpiCategories(kpiCategoryMapper.listKpiCategories())
                .calcRules(sysStatusCodeMapper.listCalcRules801To804())
                .build();
    }

    public MemberKpiDashboardResponse getDashboard(Integer year, UUID userId) {
        int y = year != null ? year : Year.now().getValue();
        Optional<KpiCycle> optionalKpiCycle = kpiCycleMapper.findByYear(y);
        Optional<User> optionalUser = userMapper.findById(userId);
        if (optionalUser.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found");
        }
        User user = optionalUser.get();
        if (optionalKpiCycle.isEmpty()) {
            return emptyDashboard(y, user);
        }
        KpiCycle cycle = optionalKpiCycle.get();
        String phase = getCurrentPhase(cycle);
        String phaseLabel = Constant.PHASE_LABEL_MAP.getOrDefault(phase, StringUtils.EMPTY);

        List<MemberKpiAssignmentDTO> rows = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycle.getId());
        MemberKpiSheetPayload sheet = buildSheet(user, y, phase, rows);
        List<String> pending = computePendingAssignmentIds(phase, rows);
        boolean canSubmit = computeCanSubmit(phase, rows, pending);

        return MemberKpiDashboardResponse.builder()
                .year(y)
                .phase(phase)
                .phaseLabel(phaseLabel)
                .sheet(sheet)
                .pendingItems(pending)
                .canSubmit(canSubmit)
                .build();
    }

    public KpiSheetResponse updateSheetItem(UUID assignmentId, UUID userId, MemberSheetItemUpdateRequest request) {
        MemberKpiAssignmentDTO row = kpiAssignmentMapper.findByIdAndUser(assignmentId, userId);
        if (row == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found");
        }
        /* README Flow 3: KPI member tạo chờ PM/GM */
        if (Objects.equals(row.getStatusCode(), 402) || Objects.equals(row.getStatusCode(), 403)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "KPI đề xuất đang chờ PM/GM duyệt — chưa chỉnh được");
        }
        UUID cycleId = row.getCycleId();
        String phase = kpiCycleMapper.findById(cycleId)
                .map(this::getCurrentPhase)
                .orElse(Constant.END_YEAR_PHASE);
        Double mid = null;
        Double end = null;
        if (request.getSelfScore() != null) {
            double v = request.getSelfScore().doubleValue();
            if (Constant.MID_YEAR_PHASE.equals(phase)) {
                mid = v;
            } else if (Constant.END_YEAR_PHASE.equals(phase)) {
                end = v;
            }
            // target_setup: không ghi điểm vào cột — chỉ evidences
        }

        int n = kpiAssignmentMapper.patchMemberAssignment(
                assignmentId,
                cycleId,
                userId,
                mid != null ? BigDecimal.valueOf(mid) : null,
                end != null ? BigDecimal.valueOf(end) : null,
                request.getEvidences());
        if (n == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not update assignment");
        }
        return reloadSheetResponse(userId, row.getCycleId());
    }

    /** Cập nhật evidences — có kiểm tra assignment thuộc member. */
    public void submitEvaluation(SubmitEvalRequest request, UUID userId) {
        MemberKpiAssignmentDTO row = kpiAssignmentMapper.findByIdAndUser(request.getAssignmentId(), userId);
        if (row == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found");
        }
        if (Objects.equals(row.getStatusCode(), 402) || Objects.equals(row.getStatusCode(), 403)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "KPI đề xuất đang chờ duyệt — chưa nộp minh chứng");
        }
        kpiAssignmentMapper.patchMemberAssignment(
                request.getAssignmentId(),
                row.getCycleId(),
                userId,
                null,
                null,
                request.getEvidence());
    }

    public KpiSheetResponse saveDraft(SaveDraftRequest request, UUID userId) {
        int y = request.getYear();
        Optional<KpiCycle> c = kpiCycleMapper.findByYear(y);
        if (c.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cycle not found for year " + y);
        }
        return reloadSheetResponse(userId, c.get().getId());
    }

    /**
     * Flow 2 + 5:
     * <ul>
     *   <li>{@code target_setup}: bulk {@code 404→405} — xác nhận mục tiêu PM giao; không bắt điểm self.</li>
     *   <li>{@code mid_year} / {@code year_end}: sau khi accept, kiểm tra đủ điều kiện rồi {@code 501} / {@code 601}.</li>
     * </ul>
     */
    @Transactional
    public void submitMemberSheet(SubmitMemberSheetRequest request, UUID userId) {
        int y = request.getYear();
        Optional<KpiCycle> opt = kpiCycleMapper.findByYear(y);
        if (opt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cycle not found");
        }
        KpiCycle cycle = opt.get();
        String phase = getCurrentPhase(cycle);

        if (Constant.TARGET_SETUP_PHASE.equals(phase)) {
            List<MemberKpiAssignmentDTO> rowsTs = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycle.getId());
            List<String> pendingTs = computePendingAssignmentIds(phase, rowsTs);
            if (!pendingTs.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Incomplete KPI rows: " + pendingTs.size());
            }
            kpiAssignmentMapper.bulkAcceptPendingForSubmit(userId, cycle.getId());
            return;
        }

        kpiAssignmentMapper.bulkAcceptPendingForSubmit(userId, cycle.getId());
        List<MemberKpiAssignmentDTO> rows = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycle.getId());
        List<String> pending = computePendingAssignmentIds(phase, rows);
        if (!pending.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incomplete KPI rows: " + pending.size());
        }
        if (Constant.MID_YEAR_PHASE.equals(phase)) {
            kpiAssignmentMapper.submitAssignmentsForMidYear(userId, cycle.getId());
        } else if (Constant.END_YEAR_PHASE.equals(phase)) {
            kpiAssignmentMapper.submitAssignmentsForYearEnd(userId, cycle.getId());
        }
    }

    /**
     * README Flow 3: Member đề xuất KPI — {@code kpi_master} (is_global=false), {@code kpis_information},
     * {@code kpi_assignments} với ASM {@code 402}.
     */
    @Transactional
    public UUID createIndividualKpi(CreateIndividualKpiRequest req, UUID userId) {
        User user = userMapper.findById(userId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        if (user.getJobTitleId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thiếu job_title_id trên user — không tạo assignment được");
        }
        Optional<KpiCycle> cycleOpt = kpiCycleMapper.findByYear(req.getCycleYear());
        if (cycleOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không có chu kỳ KPI cho năm " + req.getCycleYear());
        }
        KpiCycle cycle = cycleOpt.get();

        UUID masterId = UUID.randomUUID();
        String code = buildIndividualMasterCode(masterId);
        String targetDescription = buildMemberTargetDescription(req);

        int m = kpiLibraryMapper.insertKpiMaster(
                masterId,
                code,
                StringUtils.trimToEmpty(req.getKpiName()),
                req.getCategoryId(),
                KPI_TYPE_INDIVIDUAL,
                req.getCalculationRuleCode(),
                CALC_TYPE_MANUAL_RATING,
                KPI_UNIT_POINT,
                false,
                userId);
        if (m != 1) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể tạo kpi_master");
        }

        UUID kpiInfoId = UUID.randomUUID();
        BigDecimal weightBd = BigDecimal.valueOf(req.getWeight());
        int ki = kpiLibraryMapper.insertKpisInformation(
                kpiInfoId,
                cycle.getId(),
                masterId,
                targetDescription,
                BigDecimal.ONE,
                weightBd,
                false,
                userId);
        if (ki != 1) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể tạo kpis_information");
        }

        UUID assignmentId = UUID.randomUUID();
        int ka = kpiLibraryMapper.insertMemberKpiAssignment(
                assignmentId,
                cycle.getId(),
                kpiInfoId,
                userId,
                user.getJobTitleId(),
                BigDecimal.ONE,
                ASM_MEMBER_CREATED_PENDING_PM,
                userId);
        if (ka != 1) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể tạo kpi_assignments");
        }
        return assignmentId;
    }

    private static String buildIndividualMasterCode(UUID masterId) {
        String hex = masterId.toString().replace("-", "");
        return "I-" + hex.substring(0, 8).toUpperCase();
    }

    private static String buildMemberTargetDescription(CreateIndividualKpiRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append(StringUtils.trimToEmpty(req.getKpiName()));
        String desc = StringUtils.trimToNull(req.getDescription());
        if (desc != null) {
            sb.append("\n").append(desc);
        }
        sb.append("\nUnit: Point");
        return sb.toString();
    }

    private MemberKpiDashboardResponse emptyDashboard(int year, User user) {
        MemberKpiSheetPayload sheet = MemberKpiSheetPayload.builder()
                .id("")
                .userId(user.getId().toString())
                .userName(Optional.ofNullable(user.getFullName()).orElse(""))
                .rank("")
                .year(year)
                .phase(Constant.TARGET_SETUP_PHASE)
                .items(List.of())
                .totalWeight(0.0)
                .evidenceCount(0)
                .evidenceTotalCount(0)
                .status("draft")
                .build();
        return MemberKpiDashboardResponse.builder()
                .year(year)
                .phase(Constant.TARGET_SETUP_PHASE)
                .phaseLabel(Constant.PHASE_LABEL_MAP.get(Constant.TARGET_SETUP_PHASE))
                .sheet(sheet)
                .pendingItems(List.of())
                .canSubmit(false)
                .build();
    }

    private MemberKpiSheetPayload buildSheet(User user, int year, String phase, List<MemberKpiAssignmentDTO> rows) {
        List<MemberKpiItemPayload> items = new ArrayList<>();
        double weightSum = 0;
        int evDone = 0;
        for (MemberKpiAssignmentDTO row : rows) {
            MemberKpiItemPayload item = toItemPayload(phase, row);
            items.add(item);
            if (item.getWeight() != null) {
                weightSum += item.getWeight();
            }
            if ("submitted".equals(item.getEvidenceStatus())) {
                evDone++;
            }
        }
        String sheetStatus = inferSheetStatus(rows);
        return MemberKpiSheetPayload.builder()
                .id(rows.isEmpty() ? "" : rows.get(0).getCycleId().toString())
                .userId(user.getId().toString())
                .userName(Optional.ofNullable(user.getFullName()).orElse(""))
                .rank(Optional.ofNullable(user.getRole()).orElse("MEMBER"))
                .year(year)
                .phase(phase)
                .items(items)
                .totalWeight(weightSum)
                .evidenceCount(evDone)
                .evidenceTotalCount(rows.size())
                .status(sheetStatus)
                .build();
    }

    private String inferSheetStatus(List<MemberKpiAssignmentDTO> rows) {
        boolean anySubmitted = rows.stream()
                .map(MemberKpiAssignmentDTO::getStatusCode)
                .filter(sc -> sc != null)
                .anyMatch(sc -> sc >= 501);
        return anySubmitted ? "submitted" : "draft";
    }

    private MemberKpiItemPayload toItemPayload(String phase, MemberKpiAssignmentDTO row) {
        String group = resolveSheetGroup(row.getMasterCode(), row.getTypeCode());
        String evidenceFormCase = resolveEvidenceFormCase(group, row.getMasterCode());

        Double selfScore = resolveSelfScoreForPhase(phase, row);
        Double pmScore = Constant.END_YEAR_PHASE.equals(phase) ? row.getEndPmScore() : null;

        EvidencesParsed ev = parseEvidences(row.getEvidences());

        String evidenceStatus = deriveEvidenceStatus(row.getEvidences(), ev);
        String evaluationStatus = deriveEvaluationStatus(row, selfScore, pmScore, evidenceStatus);

        String target = buildTargetDisplay(row);
        Integer sc = row.getStatusCode();
        String statusName = sc != null ? ASM_STATUS_LABEL.getOrDefault(sc, "Mã " + sc) : null;

        var b = MemberKpiItemPayload.builder()
                .id(row.getAssignmentId().toString())
                .code(Optional.ofNullable(row.getMasterCode()).orElse(""))
                .name(Optional.ofNullable(row.getMasterName()).orElse(""))
                .description(Optional.ofNullable(row.getObjective()).orElse(""))
                .target(target)
                .assignmentTargetValue(row.getAssignmentTargetValue())
                .kpiTemplateTargetValue(row.getKpiInfoTargetValue())
                .statusCode(sc)
                .assignmentStatusName(statusName)
                .weight(row.getWeight())
                .group(group)
                .categoryId(row.getCategoryId() != null ? row.getCategoryId().toString() : null)
                .categoryName(row.getCategoryName())
                .calculationRuleCode(row.getCalculationRuleCode())
                .evidencesJson(row.getEvidences())
                .evaluationStatus(evaluationStatus)
                .evidenceStatus(evidenceStatus)
                .evidenceFormCase(evidenceFormCase)
                .evidenceNote(ev.textNote)
                .certificateOutcomeNote(ev.certificateOutcomeNote)
                .selfScore(selfScore)
                .pmScore(pmScore)
                .leaderScore(null)
                .result(ev.result)
                .actual(ev.actual)
                .planActualRecords(ev.planActualRecords)
                .waTimeRecords(ev.waTimeRecords);

        return b.build();
    }

    private Double resolveSelfScoreForPhase(String phase, MemberKpiAssignmentDTO row) {
        if (Constant.MID_YEAR_PHASE.equals(phase)) {
            return row.getMidSelfScore();
        }
        if (Constant.END_YEAR_PHASE.equals(phase)) {
            return row.getEndSelfScore();
        }
        // target_setup: hiển thị bản nháp nếu có
        if (row.getMidSelfScore() != null) {
            return row.getMidSelfScore();
        }
        return row.getEndSelfScore();
    }

    /**
     * Cột Chỉ tiêu trên lưới: ưu tiên {@code kpis_information.target_description} (thường có HTML),
     * nếu trống mới ghép số target + objective ngắn.
     */
    private String buildTargetDisplay(MemberKpiAssignmentDTO row) {
        if (StringUtils.isNotBlank(row.getTargetDescription())) {
            return row.getTargetDescription();
        }
        Double tv = row.getAssignmentTargetValue() != null ? row.getAssignmentTargetValue() : row.getKpiInfoTargetValue();
        StringBuilder sb = new StringBuilder();
        if (tv != null) {
            sb.append(tv);
        }
        if (StringUtils.isNotBlank(row.getObjective())) {
            if (!sb.isEmpty()) {
                sb.append(" — ");
            }
            sb.append(row.getObjective());
        }
        return sb.length() > 0 ? sb.toString() : "—";
    }

    private String resolveSheetGroup(String masterCode, Integer typeCode) {
        if (typeCode != null && typeCode == KPI_TYPE_PROMOTION) {
            return "P";
        }
        if (masterCode == null || masterCode.isBlank()) {
            return "A";
        }
        char ch = Character.toUpperCase(masterCode.trim().charAt(0));
        if (ch == 'A' || ch == 'B' || ch == 'C' || ch == 'P') {
            return String.valueOf(ch);
        }
        return "A";
    }

    private String resolveEvidenceFormCase(String group, String masterCode) {
        if ("B".equals(group)) {
            return "category_b";
        }
        String u = masterCode == null ? "" : masterCode.trim().toUpperCase();
        if (u.startsWith("A.2") || u.contains("WORK AMOUNT")) {
            return "monthly";
        }
        return "general";
    }

    private String deriveEvidenceStatus(String evidencesRaw, EvidencesParsed ev) {
        if (StringUtils.isBlank(evidencesRaw) || "{}".equals(evidencesRaw.trim())) {
            return "missing";
        }
        if (StringUtils.isNotBlank(ev.textNote)
                || ev.planActualRecords != null && !ev.planActualRecords.isEmpty()
                || ev.waTimeRecords != null && !ev.waTimeRecords.isEmpty()
                || ev.hasAttachmentSignals) {
            return "submitted";
        }
        return "pending";
    }

    private String deriveEvaluationStatus(
            MemberKpiAssignmentDTO row,
            Double selfScore,
            Double pmScore,
            String evidenceStatus) {
        if (pmScore != null) {
            return "approved";
        }
        if (selfScore != null && "submitted".equals(evidenceStatus)) {
            return "pending_approval";
        }
        if (selfScore != null || "submitted".equals(evidenceStatus)) {
            return "pending_approval";
        }
        return "not_started";
    }

    /**
     * Pending = chưa thể hoàn tất submit.
     * <ul>
     *   <li>Mọi phase: {@code 402}/{@code 403} luôn chặn.</li>
     *   <li>{@code target_setup}: không bắt điểm self — dùng cho xác nhận KPI PM ({@code 404→405}).</li>
     *   <li>{@code mid_year}: thiếu {@code mid_self_score}.</li>
     *   <li>{@code year_end}: thiếu {@code end_self_score}.</li>
     * </ul>
     */
    private List<String> computePendingAssignmentIds(String phase, List<MemberKpiAssignmentDTO> rows) {
        List<String> pending = new ArrayList<>();
        for (MemberKpiAssignmentDTO row : rows) {
            /* Flow 3: chờ duyệt đề xuất */
            if (Objects.equals(row.getStatusCode(), 402) || Objects.equals(row.getStatusCode(), 403)) {
                pending.add(row.getAssignmentId().toString());
                continue;
            }
            if (Constant.TARGET_SETUP_PHASE.equals(phase)) {
                continue;
            }
            if (Constant.MID_YEAR_PHASE.equals(phase)) {
                if (row.getMidSelfScore() == null) {
                    pending.add(row.getAssignmentId().toString());
                }
            } else if (Constant.END_YEAR_PHASE.equals(phase)) {
                if (row.getEndSelfScore() == null) {
                    pending.add(row.getAssignmentId().toString());
                }
            }
        }
        return pending;
    }

    private boolean computeCanSubmit(String phase, List<MemberKpiAssignmentDTO> rows, List<String> pending) {
        if (rows.isEmpty()) {
            return false;
        }
        return pending.isEmpty();
    }

    /**
     * Parse JSON {@code kpi_assignments.evidences} — hỗ trợ {@code note}, {@code planActualRecords}
     * (ưu tiên {@code total}/{@code completed}, fallback {@code plan}/{@code actual}), URL/file đính kèm.
     */
    private EvidencesParsed parseEvidences(String json) {
        EvidencesParsed e = new EvidencesParsed();
        if (StringUtils.isBlank(json)) {
            return e;
        }
        try {
            JsonNode n = objectMapper.readTree(json);
            if (n.isTextual()) {
                e.textNote = n.asText();
                return e;
            }
            if (n.hasNonNull("note")) {
                e.textNote = n.get("note").asText();
            }
            if (StringUtils.isBlank(e.textNote) && n.hasNonNull("text")) {
                e.textNote = n.get("text").asText();
            }
            if (n.hasNonNull("certificateOutcomeNote")) {
                e.certificateOutcomeNote = n.get("certificateOutcomeNote").asText();
            }
            if (n.hasNonNull("result")) {
                e.result = n.get("result").asText();
            }
            if (n.hasNonNull("actual")) {
                e.actual = n.get("actual").asText();
            }
            if (n.has("planActualRecords") && n.get("planActualRecords").isArray()) {
                e.planActualRecords = new ArrayList<>();
                for (JsonNode x : n.get("planActualRecords")) {
                    String plan = textOrEmptyPrefer(x, "total", "plan");
                    String actual = textOrEmptyPrefer(x, "completed", "actual");
                    e.planActualRecords.add(new MemberKpiDashboardResponse.PlanActualRecord(plan, actual));
                }
            }
            if (n.has("metrics") && n.get("metrics").isObject()
                    && (e.planActualRecords == null || e.planActualRecords.isEmpty())) {
                JsonNode m = n.get("metrics");
                String totalStr = metricsNodeToString(m.get("total"));
                String completedStr = metricsNodeToString(m.get("completed"));
                if (StringUtils.isNotBlank(totalStr) || StringUtils.isNotBlank(completedStr)) {
                    e.planActualRecords = new ArrayList<>();
                    e.planActualRecords.add(
                            new MemberKpiDashboardResponse.PlanActualRecord(totalStr, completedStr));
                }
                if (StringUtils.isBlank(e.result) && StringUtils.isNotBlank(completedStr)) {
                    e.result = completedStr.trim();
                }
            }
            if (n.has("waTimeRecords") && n.get("waTimeRecords").isArray()) {
                e.waTimeRecords = new ArrayList<>();
                for (JsonNode x : n.get("waTimeRecords")) {
                    e.waTimeRecords.add(new MemberKpiDashboardResponse.WaTimeRecord(
                            textOrEmpty(x, "month"),
                            textOrEmpty(x, "spent"),
                            textOrEmpty(x, "standard")));
                }
            }
            scanAttachmentSignals(n, e);
        } catch (Exception ex) {
            e.textNote = json;
        }
        return e;
    }

    private static void scanAttachmentSignals(JsonNode n, EvidencesParsed e) {
        if (n.has("urls") && n.get("urls").isArray()) {
            for (JsonNode u : n.get("urls")) {
                if (u.isTextual() && StringUtils.isNotBlank(u.asText())) {
                    e.hasAttachmentSignals = true;
                    return;
                }
                if (u.isObject()
                        && u.hasNonNull("url")
                        && StringUtils.isNotBlank(u.get("url").asText())) {
                    e.hasAttachmentSignals = true;
                    return;
                }
            }
        }
        if (n.has("files") && n.get("files").isArray()) {
            for (JsonNode f : n.get("files")) {
                if (f != null
                        && f.isObject()
                        && (f.hasNonNull("name") || f.hasNonNull("url"))) {
                    e.hasAttachmentSignals = true;
                    return;
                }
            }
        }
    }

    private static String textOrEmpty(JsonNode x, String field) {
        return x.hasNonNull(field) ? x.get(field).asText() : "";
    }

    /** Ưu tiên primary (total / completed), fallback legacy plan / actual. */
    private static String textOrEmptyPrefer(JsonNode x, String primary, String fallback) {
        if (x.hasNonNull(primary)) {
            return x.get(primary).asText();
        }
        return textOrEmpty(x, fallback);
    }

    private static String metricsNodeToString(JsonNode node) {
        if (node == null || node.isNull()) {
            return "";
        }
        if (node.isNumber()) {
            return node.numberValue().toString();
        }
        return node.asText("");
    }

    private static final class EvidencesParsed {
        String textNote;
        String certificateOutcomeNote;
        String result;
        String actual;
        List<MemberKpiDashboardResponse.PlanActualRecord> planActualRecords;
        List<MemberKpiDashboardResponse.WaTimeRecord> waTimeRecords;
        boolean hasAttachmentSignals;
    }

    private KpiSheetResponse reloadSheetResponse(UUID userId, UUID cycleId) {
        Optional<User> user = userMapper.findById(userId);
        if (user.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found");
        }
        KpiCycle cycle = kpiCycleMapper.findById(cycleId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Cycle not found"));
        String phase = getCurrentPhase(cycle);
        List<MemberKpiAssignmentDTO> rows = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycleId);
        MemberKpiSheetPayload sheet = buildSheet(user.get(), cycle.getYear(), phase, rows);
        return toKpiSheetResponse(sheet, userId);
    }

    private KpiSheetResponse toKpiSheetResponse(MemberKpiSheetPayload sheet, UUID userId) {
        List<KpiSheetResponse.KpiItemResponse> items = new ArrayList<>();
        if (sheet.getItems() != null) {
            for (MemberKpiItemPayload it : sheet.getItems()) {
                items.add(KpiSheetResponse.KpiItemResponse.builder()
                        .id(it.getId())
                        .code(it.getCode())
                        .name(it.getName())
                        .description(it.getDescription())
                        .target(it.getTarget())
                        .weight(it.getWeight() != null ? java.math.BigDecimal.valueOf(it.getWeight()) : null)
                        .group(it.getGroup())
                        .evidenceStatus(it.getEvidenceStatus())
                        .evidenceNote(it.getEvidenceNote())
                        .selfScore(it.getSelfScore() != null ? it.getSelfScore().intValue() : null)
                        .pmScore(it.getPmScore() != null ? it.getPmScore().intValue() : null)
                        .leaderScore(null)
                        .build());
            }
        }
        return KpiSheetResponse.builder()
                .id(sheet.getId())
                .userId(userId)
                .userName(sheet.getUserName())
                .rank(sheet.getRank())
                .year(sheet.getYear())
                .phase(sheet.getPhase())
                .items(items)
                .totalWeight(sheet.getTotalWeight() != null ? java.math.BigDecimal.valueOf(sheet.getTotalWeight()) : null)
                .evidenceCount(sheet.getEvidenceCount())
                .evidenceTotalCount(sheet.getEvidenceTotalCount())
                .status(sheet.getStatus())
                .build();
    }

    private String getCurrentPhase(KpiCycle cycle) {
        java.time.OffsetDateTime now = java.time.OffsetDateTime.now();
        var goalSettingDeadline = cycle.getGoalSettingDeadline();
        var midYearDeadline = cycle.getMidYearDeadline();

        if (goalSettingDeadline != null && !now.isAfter(goalSettingDeadline)) {
            return Constant.TARGET_SETUP_PHASE;
        }

        if (midYearDeadline != null && !now.isAfter(midYearDeadline)) {
            return Constant.MID_YEAR_PHASE;
        }

        return Constant.END_YEAR_PHASE;
    }

}
