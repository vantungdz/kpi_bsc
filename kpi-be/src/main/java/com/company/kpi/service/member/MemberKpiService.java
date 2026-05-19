    package com.company.kpi.service.member;
    import org.slf4j.Logger;
    import org.slf4j.LoggerFactory;
    import com.company.kpi.common.Constants;
    import com.company.kpi.common.constant.Constant;
    import com.company.kpi.entity.KpiCycle;
    import com.company.kpi.entity.User;
    import com.company.kpi.entity.UserKpiSummary;
    import com.company.kpi.mapper.KpiAssignmentMapper;
    import com.company.kpi.mapper.KpiCycleMapper;
    import com.company.kpi.mapper.KpiLibraryMapper;
    // import com.company.kpi.mapper.ReferenceDataMapper;
    import com.company.kpi.mapper.UserKpiSummaryMapper;
    import com.company.kpi.mapper.UserMapper;
    import com.company.kpi.request.member.CreateIndividualKpiRequest;
    import com.company.kpi.request.member.MemberSheetItemUpdateRequest;
    import com.company.kpi.request.member.SaveDraftRequest;
    import com.company.kpi.request.member.SubmitEvalRequest;
    import com.company.kpi.request.member.SubmitMemberSheetRequest;
    import com.company.kpi.response.member.MemberFeedbackSubmitResponse;
    import com.company.kpi.response.member.MemberKpiAssignmentDTO;
    import com.company.kpi.response.member.MemberKpiDashboardResponse;
    import com.company.kpi.response.member.MemberKpiDashboardResponse.MemberKpiItemPayload;
    import com.company.kpi.response.member.MemberKpiDashboardResponse.MemberKpiSheetPayload;
    import com.company.kpi.response.pm.KpiSheetResponse;
    import com.company.kpi.service.kpi.KpiAssignmentSnapshotService;
    import com.company.kpi.service.kpi.KpiScoringRulesService;
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
    import java.math.RoundingMode;
    import java.time.OffsetDateTime;
    import java.time.Year;
    import java.util.ArrayList;
    import java.util.List;
    import java.util.Map;
    import java.util.Objects;
    import java.util.Optional;
    import java.util.UUID;
    import java.util.regex.Matcher;
    import java.util.regex.Pattern;

    /**
     * Member KPI — đồng bộ luồng trong {@code document/db/README.md} và schema {@code document/db/init-db.sql}:
     * <ul>
     *   <li><b>Flow 2</b> {@code target_setup}: chỉ bulk ASM {@code 404→405} (xác nhận KPI PM giao). Mid/end: thêm điều kiện điểm + {@code 501}/{@code 601}.</li>
     *   <li><b>Flow 3</b> Bottom-up: {@link #createIndividualKpi} → ASM {@code 402}.</li>
     *   <li><b>Flow 5</b> (member): phase theo {@code kpi_cycles} time windows; submit sheet → {@code 501}/{@code 601}; đã nộp phase suy ra từ ASM trên {@code kpi_assignments} (không bảng submissions).</li>
     * </ul>
     * Flow 4 (xin đổi target / {@code update_payload}) chưa có mã ASM trong {@code init-db.sql} — không triển khai ở đây.
     */
    @Slf4j
    @Service
    @RequiredArgsConstructor
    public class MemberKpiService {

        private static final int KPI_TYPE_PROMOTION = 103;
        private static final int KPI_TYPE_INDIVIDUAL = 101;
        private static final int KPI_TYPE_TEAM = 102;
        /** GM nộp KPI cá nhân — giữa kỳ (đã chốt 1st half). */
        private static final int ASM_GM_FIRST_HALF_DONE = 503;
        /** GM nộp KPI cá nhân — kết thúc vòng đời assignment. */
        private static final int ASM_CYCLE_COMPLETED = 603;
        private static final int KPI_UNIT_POINT = 903;
        /** README Flow 3 — member tạo KPI chờ PM */
        private static final int ASM_MEMBER_CREATED_PENDING_PM = 402;
        private static final int ASM_MEMBER_CREATED_PENDING_GM = 403;
        private static final int ASM_PENDING_ACCEPTANCE = 404;
        private static final int ASM_FEEDBACK_IN_PROGRESS = 407;
        private static final int ASM_ACCEPTED = 405;
        private static final int CALC_RULE_SUM = 801;
        private static final int CALC_RULE_AVERAGE = 802;
        private static final int CALC_RULE_COMMENT = 803;
        private static final int CALC_TYPE_PLAN_OVER_ACTUAL = 702;
        private static final String INACTIVE_REASON_USER_RESIGNED = "USER_RESIGNED";
        private static final Pattern FIRST_NUMERIC_TOKEN = Pattern.compile("-?\\d+(?:\\.\\d+)?");
        private static final BigDecimal BD_ZERO = BigDecimal.ZERO;
        private static final BigDecimal BD_HUNDRED = new BigDecimal("100");
        private static final Logger log = LoggerFactory.getLogger(MemberKpiService.class);

        /** ASM_STATUS labels — đồng bộ document/db/init-db.sql */
        private static final Map<Integer, String> ASM_STATUS_LABEL = Map.ofEntries(
                Map.entry(401, "Newly Created KPI (Inactive)"),
                Map.entry(402, "Pending PM Approval"),
                Map.entry(403, "Pending GM Approval"),
                Map.entry(404, "Pending Member Acceptance"),
                Map.entry(407, "Feedback Pending PM/GM Review"),
                Map.entry(405, "Goal Confirmed (In Progress)"),
                Map.entry(406, "Rejected"),
                Map.entry(501, "Member Submitted Mid-Year Evidence, Pending PM Approval"),
                Map.entry(502, "PM Approved Mid-Year, Pending GM Score"),
                Map.entry(503, "GM Finalized Mid-Year Score"),
                Map.entry(601, "Pending PM Final Score"),
                Map.entry(602, "Pending GM Final Score"),
                Map.entry(603, "Fully Closed (Lifecycle Completed)"));

        private final KpiCycleMapper kpiCycleMapper;
        private final UserMapper userMapper;
        private final UserKpiSummaryMapper userKpiSummaryMapper;
        private final KpiAssignmentMapper kpiAssignmentMapper;
        private final KpiLibraryMapper kpiLibraryMapper;
        // private final ReferenceDataMapper referenceDataMapper;
        private final ObjectMapper objectMapper;
        private final KpiScoringRulesService kpiScoringRulesService;
        private final KpiAssignmentSnapshotService kpiAssignmentSnapshotService;

        // /** Form tạo KPI: {@code kpi_categories} + CALC_RULE 801–804 từ {@code sys_status_codes}. */
        // public MemberKpiFormMetaResponse getFormMeta() {
        //     return MemberKpiFormMetaResponse.builder()
        //             .kpiCategories(referenceDataMapper.listKpiCategories())
        //             .calcRules(referenceDataMapper.listCalcRules801To804())
        //             .build();
        // }

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
            List<MemberKpiAssignmentDTO> rows = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycle.getId());
            OffsetDateTime accountCreatedAt = user.getCreatedAt();
            String phase = resolveDashboardPhase(cycle, rows, accountCreatedAt);
            String phaseLabel = Constant.PHASE_LABEL_MAP.getOrDefault(phase, StringUtils.EMPTY);
            MemberKpiSheetPayload sheet = buildSheet(user, y, phase, rows);
            List<String> pending = computePendingAssignmentIds(phase, rows);
            OffsetDateTime now = OffsetDateTime.now();
            boolean canSubmit = computeCanSubmit(cycle, phase, rows, pending, now, accountCreatedAt);
            log.info("Dashboard for user {} in year {}: phase={}, pendingCount={}, canSubmit={}", userId, y, phase, pending.size(), canSubmit);
            Optional<UserKpiSummary> summaryOpt = userKpiSummaryMapper.findByUserIdAndCycleId(userId, cycle.getId());
            UserKpiSummary summary = summaryOpt.orElse(null);

            return MemberKpiDashboardResponse.builder()
                    .year(y)
                    .accountCreatedAt(accountCreatedAt != null ? accountCreatedAt.toString() : null)
                    .phase(phase)
                    .phaseLabel(phaseLabel)
                    .sheet(sheet)
                    .pendingItems(pending)
                    .canSubmit(canSubmit)
                    .evaluationComments(summary != null ? summary.getEvaluationComments() : null)
                    .evaluationCommentsPromotion(summary != null ? summary.getEvaluationCommentsPromotion() : null)
                    .evaluationSupervisorComments(summary != null ? summary.getEvaluationSupervisorComments() : null)
                    .evaluationSupervisorCommentsPromotion(summary != null ? summary.getEvaluationSupervisorCommentsPromotion() : null)
                    .build();
        }

        public KpiSheetResponse updateSheetItem(UUID assignmentId, UUID userId, MemberSheetItemUpdateRequest request) {
            MemberKpiAssignmentDTO row = kpiAssignmentMapper.findByIdAndUser(assignmentId, userId);
            if (row == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found");
            }
            rejectIfResignedAssignment(row);
            /* README Flow 3: KPI member tạo chờ PM/GM */
            if (Objects.equals(row.getStatusCode(), ASM_MEMBER_CREATED_PENDING_PM)
                || Objects.equals(row.getStatusCode(), ASM_MEMBER_CREATED_PENDING_GM)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Proposed KPI is pending PM/GM approval — cannot be edited");
            }
            UUID cycleId = row.getCycleId();
            KpiCycle cycle = kpiCycleMapper.findById(cycleId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cycle not found"));
            List<MemberKpiAssignmentDTO> allRows = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycleId);
            User sheetUser = userMapper.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
            String phase = resolveDashboardPhase(cycle, allRows, sheetUser.getCreatedAt());
            Double mid = null;
            Double end = null;
            Integer autoScore = computeAutoSelfScoreFromEvidences(row, request.getEvidences());
            if (autoScore != null) {
                double v = autoScore.doubleValue();
                if (Constant.MID_YEAR_PHASE.equals(phase)) {
                    mid = v;
                } else if (Constant.END_YEAR_PHASE.equals(phase)) {
                    end = v;
                } else if (Constant.TARGET_SETUP_PHASE.equals(phase)) {
                    /* Giai đoạn thiết lập: vẫn lưu điểm nháp vào end_self_score để UI/leader API hiển thị. */
                    end = v;
                }
            } else if (request.getSelfScore() != null) {
                double v = request.getSelfScore().doubleValue();
                if (Constant.MID_YEAR_PHASE.equals(phase)) {
                    mid = v;
                } else if (Constant.END_YEAR_PHASE.equals(phase)) {
                    end = v;
                } else if (Constant.TARGET_SETUP_PHASE.equals(phase)) {
                    // Giữ hành vi nhất quán với auto-score: lưu nháp self score để refresh vẫn thấy.
                    end = v;
                }
            }
            int n = kpiAssignmentMapper.patchMemberAssignment(
                    assignmentId,
                    cycleId,
                    userId,
                    mid,
                    end,
                    request.getEvidences(),
                    null);
            if (n == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not update assignment");
            }
            return reloadSheetResponse(userId, row.getCycleId());
        }

        @Transactional
        public MemberFeedbackSubmitResponse submitFeedback(UUID assignmentId, UUID userId, String feedbackComment) {
            MemberKpiAssignmentDTO row = kpiAssignmentMapper.findByIdAndUser(assignmentId, userId);
            if (row == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found");
            }
            rejectIfResignedAssignment(row);
            Integer status = row.getStatusCode();
            if (!Objects.equals(status, ASM_PENDING_ACCEPTANCE) && !Objects.equals(status, ASM_FEEDBACK_IN_PROGRESS)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "KPI is not in a state that allows sending feedback");
            }
            String normalized = StringUtils.trimToEmpty(feedbackComment);
            if (StringUtils.isBlank(normalized)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Feedback cannot be empty");
            }
            int n = kpiAssignmentMapper.submitAssignmentFeedback(
                    assignmentId,
                    row.getCycleId(),
                    userId,
                    normalized,
                    ASM_FEEDBACK_IN_PROGRESS);
            if (n == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot send feedback for this KPI");
            }
            MemberKpiAssignmentDTO refreshed = kpiAssignmentMapper.findByIdAndUser(assignmentId, userId);
            String roleCode = refreshed != null ? refreshed.getFeedbackTargetRoleCode() : null;
            return MemberFeedbackSubmitResponse.builder()
                    .feedbackTargetRoleCode(roleCode)
                    .assignmentStatusName(feedback407StatusLabel(roleCode))
                    .build();
        }

        private static String feedback407StatusLabel(String feedbackTargetRoleCode) {
            if (StringUtils.isNotBlank(feedbackTargetRoleCode)
                    && "GM".equalsIgnoreCase(feedbackTargetRoleCode.trim())) {
                return "Feedback Pending GM Review";
            }
            return "Feedback Pending PM Review";
        }

        private static void rejectIfAnyResignedAssignment(List<MemberKpiAssignmentDTO> rows) {
            if (rows != null && rows.stream().anyMatch(MemberKpiService::isResignedAssignment)) {
                throw resignedAssignmentException();
            }
        }

        private static void rejectIfResignedAssignment(MemberKpiAssignmentDTO row) {
            if (isResignedAssignment(row)) {
                throw resignedAssignmentException();
            }
        }

        private static boolean isResignedAssignment(MemberKpiAssignmentDTO row) {
            return row != null
                    && StringUtils.equalsIgnoreCase(
                            StringUtils.trimToEmpty(row.getInactiveReason()),
                            INACTIVE_REASON_USER_RESIGNED);
        }

        private static ResponseStatusException resignedAssignmentException() {
            return new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User has resigned; KPI submission or editing is no longer allowed.");
        }

        /** Cập nhật evidences — có kiểm tra assignment thuộc member. */
        public void submitEvaluation(SubmitEvalRequest request, UUID userId) {
            MemberKpiAssignmentDTO row = kpiAssignmentMapper.findByIdAndUser(request.getAssignmentId(), userId);
            if (row == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found");
            }
            rejectIfResignedAssignment(row);
            if (Objects.equals(row.getStatusCode(), ASM_MEMBER_CREATED_PENDING_PM)
                || Objects.equals(row.getStatusCode(), ASM_MEMBER_CREATED_PENDING_GM)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Proposed KPI is pending approval — cannot submit evidence");
            }
            kpiAssignmentMapper.patchMemberAssignment(
                    request.getAssignmentId(),
                    row.getCycleId(),
                    userId,
                    null,
                    null,
                    request.getEvidence(),
                    null);
        }

        public KpiSheetResponse saveDraft(SaveDraftRequest request, UUID userId) {
            int y = request.getYear();
            Optional<KpiCycle> c = kpiCycleMapper.findByYear(y);
            if (c.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cycle not found for year " + y);
            }
            return reloadSheetResponse(userId, c.get().getId());
        }

        public void deleteSelfCreatedKpi(UUID assignmentId, UUID userId) {
            MemberKpiAssignmentDTO row = kpiAssignmentMapper.findByIdAndUser(assignmentId, userId);
            if (row == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found");
            }
            rejectIfResignedAssignment(row);
            int n = kpiAssignmentMapper.softDeleteSelfCreatedAssignment(assignmentId, userId);
            if (n == 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "KPI cannot be deleted (only self-created KPIs in pending/awaiting/rejected status are eligible)");
            }
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
            boolean promotionSubmit = isPromotionSubmit(request);
            Optional<KpiCycle> opt = kpiCycleMapper.findByYear(y);
            if (opt.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cycle not found");
            }
            KpiCycle cycle = opt.get();
            if (!Objects.equals(cycle.getStatusCode(), Constants.CycleStatus.OPEN)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "KPI cycle is not open for submissions");
            }
            User submitUser = userMapper.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
            String phase = getCurrentPhase(cycle);
            OffsetDateTime now = OffsetDateTime.now();
            List<MemberKpiAssignmentDTO> rowsSnapshot = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycle.getId());
            List<MemberKpiAssignmentDTO> scopedRowsSnapshot = filterRowsBySubmitType(rowsSnapshot, promotionSubmit);
            if (scopedRowsSnapshot.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No KPI rows available for submit scope");
            }
            rejectIfAnyResignedAssignment(scopedRowsSnapshot);
            String submitPhase = resolveSubmitPhaseForSubmission(cycle, phase, now, scopedRowsSnapshot, submitUser.getCreatedAt());
            if (submitPhase == null) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Submissions are not open for the current phase (outside time window)");
                }
            if (assignmentsIndicatePhaseAlreadyDone(submitPhase, scopedRowsSnapshot)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Already submitted for this phase in this cycle");
                }

            if (Constant.TARGET_SETUP_PHASE.equals(submitPhase)) {
                List<String> pendingTs = computePendingAssignmentIds(submitPhase, scopedRowsSnapshot);
                if (!pendingTs.isEmpty()) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Incomplete KPI rows: " + pendingTs.size());
                }
                int updated = 0;
                for (MemberKpiAssignmentDTO row : scopedRowsSnapshot) {
                    Integer currentStatus = row.getStatusCode();
                    if (!Objects.equals(currentStatus, ASM_PENDING_ACCEPTANCE)
                            && !Objects.equals(currentStatus, 406)
                            && !Objects.equals(currentStatus, ASM_FEEDBACK_IN_PROGRESS)) {
                        continue;
                    }
                    boolean hasFeedback = StringUtils.isNotBlank(row.getFeedbackComment());
                    // target_setup submit: 404/406 -> 402 (chờ PM duyệt), 407 giữ nguyên
                    int nextStatus = (Objects.equals(currentStatus, ASM_PENDING_ACCEPTANCE)
                            || Objects.equals(currentStatus, 406))
                            ? ASM_MEMBER_CREATED_PENDING_PM
                            : (hasFeedback ? ASM_FEEDBACK_IN_PROGRESS : ASM_ACCEPTED);
                    if (Objects.equals(currentStatus, nextStatus)) {
                        updated++;
                        continue;
                    }
                    updated += kpiAssignmentMapper.patchMemberAssignment(
                            row.getAssignmentId(),
                            cycle.getId(),
                            userId,
                            null,
                            null,
                            row.getEvidences(),
                            nextStatus);
                }
                if (updated == 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No target-setup assignments eligible to accept");
                }
                persistEmployeeEvaluationComment(cycle.getId(), userId, request.getEvaluationComments(), promotionSubmit);
                return;
            }

            kpiAssignmentMapper.updateKpiStatuses(userId, cycle.getId(), ASM_ACCEPTED, promotionSubmit, ASM_PENDING_ACCEPTANCE, false);
            List<MemberKpiAssignmentDTO> rows = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycle.getId());
            List<MemberKpiAssignmentDTO> scopedRows = filterRowsBySubmitType(rows, promotionSubmit);
            if (Constant.END_YEAR_PHASE.equals(submitPhase)) {
                backfillEndSelfScoreFromMidSelfScore(cycle.getId(), userId, scopedRows);
            }
            List<String> pending = computePendingAssignmentIds(submitPhase, scopedRows);
                if (!pending.isEmpty()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incomplete KPI rows: " + pending.size());
                }
            if (Constant.MID_YEAR_PHASE.equals(submitPhase)) {
                    int n = kpiAssignmentMapper.updateKpiStatuses(userId, cycle.getId(), 501, promotionSubmit, ASM_ACCEPTED, false);
                    if (n == 0) {
                        throw new ResponseStatusException(
                                HttpStatus.BAD_REQUEST, "No mid-year assignments eligible to submit");
                    }
            } else if (Constant.END_YEAR_PHASE.equals(submitPhase)) {
                    int n405 = kpiAssignmentMapper.updateKpiStatuses(userId, cycle.getId(), 601, promotionSubmit, ASM_ACCEPTED, false);
                    int n503 = kpiAssignmentMapper.updateKpiStatuses(userId, cycle.getId(), 601, promotionSubmit, 503, false);
                    int n = n405 + n503;
                    if (n == 0) {
                        throw new ResponseStatusException(
                                HttpStatus.BAD_REQUEST, "No end-year assignments eligible to submit");
                    }
                }
            persistEmployeeEvaluationComment(cycle.getId(), userId, request.getEvaluationComments(), promotionSubmit);
            }

        /**
         * Tab KPI cá nhân (GM): sau khi lưu Actual / điểm tự đánh giá từng dòng, GM bấm «Gửi» để khóa đợt.
         * Giữa kỳ: {@code 405→503}; cuối kỳ: {@code 503→603}. Khác {@link #submitMemberSheet} (member: 405→501 / →601).
         */
        @Transactional
        public void submitGmPersonalEvaluation(UUID userId, UUID cycleId, boolean promotionSubmit) {
            Optional<KpiCycle> opt = kpiCycleMapper.findById(cycleId);
            if (opt.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cycle not found");
            }
            KpiCycle cycle = opt.get();
            if (!Objects.equals(cycle.getStatusCode(), Constants.CycleStatus.OPEN)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "KPI cycle is not open for submissions");
            }
            List<MemberKpiAssignmentDTO> rows = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycleId);
            if (rows == null || rows.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No KPI assignments in this cycle");
            }
            User gmUser = userMapper.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
            String phase = getCurrentPhase(cycle);
            OffsetDateTime now = OffsetDateTime.now();
            String submitPhase = resolveSubmitPhaseForSubmission(cycle, phase, now, rows, gmUser.getCreatedAt());
            if (submitPhase == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Submissions are not open for the current phase (outside time window)");
            }
            if (Constant.TARGET_SETUP_PHASE.equals(submitPhase)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Not yet in the mid-year or year-end evaluation window");
            }

            List<MemberKpiAssignmentDTO> personal = filterRowsBySubmitType(filterGmPersonalSheetRows(rows), promotionSubmit);
            rejectIfAnyResignedAssignment(personal);

            if (Constant.MID_YEAR_PHASE.equals(submitPhase)) {
                if (assignmentsIndicatePhaseAlreadyDone(submitPhase, personal)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Mid-year evaluation already submitted for this cycle");
                }
                List<MemberKpiAssignmentDTO> targets =
                        personal.stream().filter(r -> Objects.equals(r.getStatusCode(), ASM_ACCEPTED)).toList();
                if (targets.isEmpty()) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "No personal KPIs at status 405 eligible for mid-year submission");
                }
                validateGmPersonalMidYearReady(targets);
                int n = kpiAssignmentMapper.updateKpiStatuses(userId, cycleId, ASM_GM_FIRST_HALF_DONE, promotionSubmit, ASM_ACCEPTED, false);
                if (n == 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to update mid-year status");
                }
                return;
            }

            if (Constant.END_YEAR_PHASE.equals(submitPhase)) {
                boolean has405 = personal.stream().anyMatch(r -> Objects.equals(r.getStatusCode(), ASM_ACCEPTED));
                if (has405) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Please submit mid-year evaluation first (there are KPIs still at status 405)");
                }
                if (assignmentsIndicatePhaseAlreadyDone(submitPhase, personal)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Year-end evaluation already submitted for this cycle");
                }
                List<MemberKpiAssignmentDTO> targets = personal.stream()
                        .filter(r -> Objects.equals(r.getStatusCode(), ASM_GM_FIRST_HALF_DONE))
                        .toList();
                if (targets.isEmpty()) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "No KPIs at status 503 eligible for year-end submission");
                }
                validateGmPersonalEndYearReady(targets);
                int n =
                        kpiAssignmentMapper.updateKpiStatuses(userId, cycleId, ASM_CYCLE_COMPLETED, promotionSubmit, ASM_GM_FIRST_HALF_DONE, false);
                if (n == 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to update year-end status");
                }
                return;
            }

            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid submission phase");
        }

        private static List<MemberKpiAssignmentDTO> filterGmPersonalSheetRows(List<MemberKpiAssignmentDTO> rows) {
            return rows.stream().filter(MemberKpiService::isGmPersonalKpiType).toList();
        }

        private static boolean isGmPersonalKpiType(MemberKpiAssignmentDTO r) {
            Integer tc = r.getTypeCode();
            return Objects.equals(tc, KPI_TYPE_INDIVIDUAL)
                    || Objects.equals(tc, KPI_TYPE_TEAM)
                    || Objects.equals(tc, KPI_TYPE_PROMOTION);
        }

        private static boolean hasGmPersonalMeaningfulEvidences(String evidences) {
            if (StringUtils.isBlank(evidences)) {
                return false;
            }
            String t = evidences.trim();
            return !"{}".equals(t) && !"null".equalsIgnoreCase(t);
        }

        /** Điểm giữa kỳ: ưu tiên {@code mid_self_score}; có thể tạm nằm ở {@code end_self_score} khi lưu trong giai đoạn thiết lập. */
        private static boolean hasGmPersonalMidYearScore(MemberKpiAssignmentDTO r) {
            return r.getMidSelfScore() != null || r.getEndSelfScore() != null;
        }

        private static void validateGmPersonalMidYearReady(List<MemberKpiAssignmentDTO> targets) {
            boolean incomplete = targets.stream()
                    .anyMatch(r -> !hasGmPersonalMidYearScore(r) || !hasGmPersonalMeaningfulEvidences(r.getEvidences()));
            if (incomplete) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Please enter Actual results and self-evaluation scores (mid-year) for all personal KPIs before submitting");
            }
        }

        private static void validateGmPersonalEndYearReady(List<MemberKpiAssignmentDTO> targets) {
            boolean incomplete = targets.stream()
                    .anyMatch(r -> r.getEndSelfScore() == null || !hasGmPersonalMeaningfulEvidences(r.getEvidences()));
            if (incomplete) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Please enter Actual results and self-evaluation scores (year-end) for all KPIs at status 503 before submitting");
            }
        }

        private static boolean isPromotionSubmit(SubmitMemberSheetRequest request) {
            return "PROMOTION".equalsIgnoreCase(request.getKpiType());
        }

        private static List<MemberKpiAssignmentDTO> filterRowsBySubmitType(
                List<MemberKpiAssignmentDTO> rows,
                boolean promotionSubmit) {
            if (rows == null || rows.isEmpty()) {
                return List.of();
            }
            if (promotionSubmit) {
                return rows.stream()
                        .filter(r -> Objects.equals(r.getTypeCode(), KPI_TYPE_PROMOTION))
                        .toList();
            }
            return rows.stream()
                    .filter(r -> !Objects.equals(r.getTypeCode(), KPI_TYPE_PROMOTION))
                    .toList();
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
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing job_title_id on user — cannot create assignment");
            }
            Optional<KpiCycle> cycleOpt = kpiCycleMapper.findByYear(req.getCycleYear());
            if (cycleOpt.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No KPI cycle found for year " + req.getCycleYear());
            }
            KpiCycle cycle = cycleOpt.get();
            if (!Objects.equals(cycle.getStatusCode(), Constants.CycleStatus.OPEN)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "KPI cycle is not open — cannot create proposed KPI");
            }

            UUID masterId = UUID.randomUUID();
            String code = null;
            String targetDescription = buildMemberTargetDescription(req);

            int m = kpiLibraryMapper.insertKpiMaster(
                    masterId,
                    code,
                    StringUtils.trimToEmpty(req.getKpiName()),
                    req.getCategoryId(),
                    KPI_TYPE_INDIVIDUAL,
                    req.getCalculationRuleCode(),
                    req.getCalculationTypeCode(),
                    KPI_UNIT_POINT,
                    false,
                    userId);
            if (m != 1) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create kpi_master");
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
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create kpis_information");
            }

            UUID assignmentId = UUID.randomUUID();
            int ka = kpiLibraryMapper.insertMemberKpiAssignment(
                    assignmentId,
                    cycle.getId(),
                    kpiInfoId,
                    userId,
                    user.getJobTitleId(),
                    BigDecimal.ONE,
                    ASM_PENDING_ACCEPTANCE,
                    userId);
            if (ka != 1) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create kpi_assignments");
            }
            kpiAssignmentSnapshotService.createSnapshotForAssignment(assignmentId, userId);
            return assignmentId;
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
                    .accountCreatedAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null)
                    .phase(Constant.TARGET_SETUP_PHASE)
                    .phaseLabel(Constant.PHASE_LABEL_MAP.get(Constant.TARGET_SETUP_PHASE))
                    .sheet(sheet)
                    .pendingItems(List.of())
                    .canSubmit(false)
                    .evaluationComments(null)
                    .evaluationCommentsPromotion(null)
                    .evaluationSupervisorComments(null)
                    .evaluationSupervisorCommentsPromotion(null)
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
            Double pmScore = resolveDisplayedManagerFinalScore(phase, row);

            EvidencesParsed ev = parseEvidences(row.getEvidences());

            String evidenceStatus = deriveEvidenceStatus(row.getEvidences(), ev);
            boolean hasFeedback = StringUtils.isNotBlank(row.getFeedbackComment());
            String evaluationStatus = deriveEvaluationStatus(row, selfScore, pmScore, evidenceStatus, hasFeedback);

            String target = buildTargetDisplay(row);
            Integer sc = row.getStatusCode();
            String ftr = row.getFeedbackTargetRoleCode();
            String statusName = sc != null ? ASM_STATUS_LABEL.getOrDefault(sc, "Code " + sc) : null;
            if (sc != null && sc == ASM_FEEDBACK_IN_PROGRESS) {
                statusName = feedback407StatusLabel(ftr);
            }
            MemberWorkflowUi workflow = MemberWorkflowUi.from(evaluationStatus, sc, ftr);

            var b = MemberKpiItemPayload.builder()
                    .id(row.getAssignmentId().toString())
                    .kpiInformationId(row.getKpiInformationId() != null ? row.getKpiInformationId().toString() : null)
                    .code(Optional.ofNullable(row.getMasterCode()).orElse(""))
                    .name(Optional.ofNullable(row.getMasterName()).orElse(""))
                    .description(Optional.ofNullable(row.getObjective()).orElse(""))
                    .target(target)
                    .targetDescription(Optional.ofNullable(row.getTargetDescription()).orElse(""))
                    .assignmentTargetValue(row.getAssignmentTargetValue())
                    .kpiTemplateTargetValue(row.getKpiInfoTargetValue())
                    .statusCode(sc)
                    .assignmentStatusName(statusName)
                    .weight(row.getWeight())
                    .group(group)
                    .categoryId(row.getCategoryId() != null ? row.getCategoryId().toString() : null)
                    .categoryName(row.getCategoryName())
                    .calculationRuleCode(row.getCalculationRuleCode())
                    .calculationTypeCode(row.getCalculationTypeCode())
                    .unitCode(row.getUnitCode())
                    .unitName(row.getUnitName())
                    .evidencesJson(row.getEvidences())
                    .evaluationStatus(evaluationStatus)
                    .evidenceStatus(evidenceStatus)
                    .evidenceFormCase(evidenceFormCase)
                    .evidenceNote(ev.textNote)
                    .memberFeedback(ev.memberFeedback)
                    .leaderFeedback(ev.leaderFeedback)
                    .feedbackComment(Optional.ofNullable(row.getFeedbackComment()).orElse(""))
                    .updateReason(Optional.ofNullable(row.getUpdateReason()).orElse(""))
                    .createdByCurrentUser(Boolean.TRUE.equals(row.getCreatedByCurrentUser()))
                    .createdByRoleCode(Optional.ofNullable(row.getCreatedByRoleCode()).orElse(""))
                    .gmComment(ev.gmComment)
                    .certificateOutcomeNote(ev.certificateOutcomeNote)
                    .selfScore(selfScore)
                    .pmScore(pmScore)
                    .leaderScore(null)
                    .result(ev.result)
                    .actual(ev.actual)
                    .planActualRecords(ev.planActualRecords)
                    .waTimeRecords(ev.waTimeRecords)
                    .canViewEvidence(workflow.canViewEvidence())
                    .canEditEvidence(workflow.canEditEvidence())
                    .canEditScore(workflow.canEditScore())
                    .evidenceTooltip(workflow.evidenceTooltip())
                    .evaluationState(workflow.evaluationState())
                    .feedbackTargetRoleCode(ftr)
                    .assignmentCreatedAt(
                            row.getAssignmentCreatedAt() != null ? row.getAssignmentCreatedAt().toString() : null);

            return b.build();
        }

        private Double resolveSelfScoreForPhase(String phase, MemberKpiAssignmentDTO row) {
            if (Constant.MID_YEAR_PHASE.equals(phase)) {
                return row.getMidSelfScore();
            }
            if (Constant.END_YEAR_PHASE.equals(phase)) {
                // year_end: nếu chưa có end_self_score thì giữ điểm giữa kỳ để không mất khi refresh.
                return row.getEndSelfScore() != null ? row.getEndSelfScore() : row.getMidSelfScore();
            }
            // target_setup: hiển thị bản nháp nếu có
            if (row.getMidSelfScore() != null) {
                return row.getMidSelfScore();
            }
            return row.getEndSelfScore();
        }

        /**
         * Điểm cột «chấm PM/GM» trên dashboard member: ưu tiên GM, sau đó PM
         * (đồng bộ với báo cáo GM / bảng Leader {@code endGm ?? endPm}).
         */
        private static Double resolveDisplayedManagerFinalScore(String phase, MemberKpiAssignmentDTO row) {
            if (Constant.TARGET_SETUP_PHASE.equals(phase)) {
                return null;
            }
            if (!Constant.MID_YEAR_PHASE.equals(phase) && !Constant.END_YEAR_PHASE.equals(phase)) {
                return null;
            }
            if (row.getEndGmScore() != null) {
                return row.getEndGmScore();
            }
            return row.getEndPmScore();
        }

        /**
         * Cột Chỉ tiêu trên lưới: ưu tiên {@code kpis_information.target_description} (thường có HTML),
         * nếu trống mới ghép số target + objective ngắn.
         */
        private String buildTargetDisplay(MemberKpiAssignmentDTO row) {
            Double tv = row.getAssignmentTargetValue() != null ? row.getAssignmentTargetValue() : row.getKpiInfoTargetValue();
            String unitName = StringUtils.trimToEmpty(row.getUnitName());
            if (tv != null) {
                String numeric = BigDecimal.valueOf(tv).stripTrailingZeros().toPlainString();
                return StringUtils.isNotBlank(unitName) ? numeric + " " + unitName : numeric;
            }
            if (StringUtils.isNotBlank(row.getTargetDescription())) {
                return row.getTargetDescription();
            }
            StringBuilder sb = new StringBuilder();
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
                String evidenceStatus,
                boolean hasFeedback) {
            if (pmScore != null) {
                return "approved";
            }
            if (hasFeedback && Objects.equals(row.getStatusCode(), ASM_FEEDBACK_IN_PROGRESS)) {
                return "feedback";
            }
            if (selfScore != null && "submitted".equals(evidenceStatus)) {
                return "pending_approval";
            }
            if (selfScore != null || "submitted".equals(evidenceStatus)) {
                return "pending_approval";
            }
            return "not_started";
        }

        private record MemberWorkflowUi(
                boolean canViewEvidence,
                boolean canEditEvidence,
                boolean canEditScore,
                String evidenceTooltip,
                String evaluationState) {

            static MemberWorkflowUi from(String evaluationStatus, Integer statusCode, String feedbackTargetRoleCode) {
                boolean pendingProposal = statusCode != null && (statusCode == 402 || statusCode == 403);
                boolean pendingAccept = statusCode != null && statusCode == 404;
                boolean firstHalfCompleted = statusCode != null && statusCode == 503;
                boolean submittedRound = statusCode != null
                        && (statusCode == 501
                                || statusCode == 502
                                || statusCode == 601
                                || statusCode == 602
                                || statusCode == 603);
                boolean approvedEval = "approved".equals(evaluationStatus);
                boolean canViewEvidence = !pendingProposal;
                boolean canEditEvidence =
                        canViewEvidence
                                && !pendingAccept
                                && (!submittedRound || firstHalfCompleted);
                boolean canEditScore = canEditEvidence;
                String tooltip = buildEvidenceTooltip(
                        canViewEvidence, canEditEvidence, approvedEval, pendingProposal, pendingAccept, submittedRound);
                String evalStateVi = memberEvaluationStateVi(evaluationStatus, feedbackTargetRoleCode);
                return new MemberWorkflowUi(canViewEvidence, canEditEvidence, canEditScore, tooltip, evalStateVi);
            }

            private static String buildEvidenceTooltip(
                    boolean canViewEvidence,
                    boolean canEditEvidence,
                    boolean approvedEval,
                    boolean pendingProposal,
                    boolean pendingAccept,
                    boolean submittedRound) {
                if (!canViewEvidence) {
                    if (approvedEval) {
                        return "Approved — read-only";
                    }
                    if (pendingProposal) {
                        return "Pending PM/GM approval for proposed KPI";
                    }
                    if (pendingAccept) {
                        return "Can view & send feedback";
                    }
                    return "Cannot open evidence";
                }
                if (!canEditEvidence && submittedRound) {
                    return "View evidence details (submitted)";
                }
                return "Self-evaluation & evidence";
            }

            private static String memberEvaluationStateVi(String evaluationStatus, String feedbackTargetRoleCode) {
                if (evaluationStatus == null) {
                    return null;
                }
                return switch (evaluationStatus) {
                    case "not_started" -> "Not Evaluated";
                    case "pending_approval" -> "Pending Approval";
                    case "approved" -> "Approved";
                    case "revision" -> "Revision Required";
                    case "overdue" -> "Overdue";
                    case "feedback" -> feedback407StatusLabel(feedbackTargetRoleCode);
                    default -> null;
                };
            }
        }

        /**
         * Pending = chưa thể hoàn tất submit.
         * <ul>
         *   <li>{@code target_setup}: bỏ qua validation điểm self để xác nhận KPI PM ({@code 404→405}).</li>
         *   <li>{@code mid_year}/{@code year_end}: {@code 402}/{@code 403} luôn chặn.</li>
         *   <li>{@code mid_year}: không bắt buộc điểm self trước nộp.</li>
         *   <li>{@code year_end}: thiếu {@code end_self_score}.</li>
         * </ul>
         */
        private List<String> computePendingAssignmentIds(String phase, List<MemberKpiAssignmentDTO> rows) {
            List<String> pending = new ArrayList<>();
            for (MemberKpiAssignmentDTO row : rows) {
                if (Constant.TARGET_SETUP_PHASE.equals(phase)) {
                    continue;
                }
                /* Flow 3: chờ duyệt đề xuất */
                if (Objects.equals(row.getStatusCode(), ASM_MEMBER_CREATED_PENDING_PM)
                    || Objects.equals(row.getStatusCode(), ASM_MEMBER_CREATED_PENDING_GM)
                    || Objects.equals(row.getStatusCode(), 406)) {
                    pending.add(row.getAssignmentId().toString());
                    continue;
                }
                if (Constant.MID_YEAR_PHASE.equals(phase)) {
                    continue;
                }

                if (Constant.END_YEAR_PHASE.equals(phase)) {
                    if (row.getEndSelfScore() == null && row.getMidSelfScore() == null) {
                        pending.add(row.getAssignmentId().toString());
                    }
                }
            }
            return pending;
        }

        private void backfillEndSelfScoreFromMidSelfScore(
                UUID cycleId,
                UUID userId,
                List<MemberKpiAssignmentDTO> rows) {
            if (rows == null || rows.isEmpty()) {
                return;
            }
            for (MemberKpiAssignmentDTO row : rows) {
                if (row == null || row.getAssignmentId() == null) {
                    continue;
                }
                if (row.getEndSelfScore() != null || row.getMidSelfScore() == null) {
                    continue;
                }
                kpiAssignmentMapper.patchMemberAssignment(
                        row.getAssignmentId(),
                        cycleId,
                        userId,
                        null,
                        row.getMidSelfScore(),
                        null,
                        null);
                row.setEndSelfScore(row.getMidSelfScore());
            }
        }

        private void persistEmployeeEvaluationComment(UUID cycleId, UUID userId, String rawComment, boolean promotionSubmit) {
            String comment = StringUtils.trimToNull(rawComment);
            if (promotionSubmit) {
                int updated = userKpiSummaryMapper.updateEvaluationCommentsPromotion(userId, cycleId, comment, userId);
                if (updated > 0) {
                    return;
                }
                userKpiSummaryMapper.insertEvaluationComments(
                        UUID.randomUUID(),
                        userId,
                        cycleId,
                        null,
                        comment,
                        userId,
                        userId);
            } else {
                int updated = userKpiSummaryMapper.updateEvaluationComments(userId, cycleId, comment, userId);
                if (updated > 0) {
                    return;
                }
                userKpiSummaryMapper.insertEvaluationComments(
                        UUID.randomUUID(),
                        userId,
                        cycleId,
                        comment,
                        null,
                        userId,
                        userId);
            }
        }

        /**
         * Đồng bộ ý nghĩa backfill Flyway V4 (trước đây ghi vào {@code kpi_member_sheet_phase_submissions}).
         */
        private static boolean assignmentsIndicatePhaseAlreadyDone(String phase, List<MemberKpiAssignmentDTO> rows) {
            if (rows == null || rows.isEmpty()) {
                return false;
            }
            if (Constant.TARGET_SETUP_PHASE.equals(phase)) {
                return rows.stream().noneMatch(r ->
                        Objects.equals(r.getStatusCode(), ASM_PENDING_ACCEPTANCE)
                                || Objects.equals(r.getStatusCode(), 406)
                                || Objects.equals(r.getStatusCode(), ASM_FEEDBACK_IN_PROGRESS));
            }
            if (Constant.MID_YEAR_PHASE.equals(phase)) {
                return rows.stream()
                        .map(MemberKpiAssignmentDTO::getStatusCode)
                        .filter(Objects::nonNull)
                        .anyMatch(sc -> sc == 501 || sc == 502 || sc == 503);
            }
            if (Constant.END_YEAR_PHASE.equals(phase)) {
                return rows.stream()
                        .map(MemberKpiAssignmentDTO::getStatusCode)
                        .filter(Objects::nonNull)
                        .anyMatch(sc -> sc == 601 || sc == 602 || sc == 603);
            }
            return false;
        }

        private boolean computeCanSubmit(
                KpiCycle cycle,
                String phase,
                List<MemberKpiAssignmentDTO> rows,
                List<String> pending,
                OffsetDateTime now,
                OffsetDateTime accountCreatedAt) {
            if (rows.isEmpty()) {
                return false;
            }
            if (!Objects.equals(cycle.getStatusCode(), Constants.CycleStatus.OPEN)) {
                return false;
            }
            String submitPhase = resolveSubmitPhaseForSubmission(cycle, phase, now, rows, accountCreatedAt);
            if (submitPhase == null) {
                    return false;
                }
            if (assignmentsIndicatePhaseAlreadyDone(submitPhase, rows)) {
                    return false;
                }
                List<String> submitPhasePending = computePendingAssignmentIds(submitPhase, rows);
                return submitPhasePending.isEmpty();
            }

        /**
         * Resolve phase dùng cho submit:
         * <ul>
     *   <li>Nếu còn ASM {@code 404} (PENDING_ACCEPTANCE) thì luôn ưu tiên submit {@code target_setup}
     *       (hỗ trợ member nộp muộn đầu năm, vẫn ghi nhận ở phase target).</li>
     *   <li>Nếu chưa nộp vòng mid-year và còn ASM {@code 405} (user không phải onboard sau {@code mid_year_end})
     *       thì cho phép nộp muộn ở {@code mid_year}. User tạo sau hết giữa kỳ → không ép nộp 1H, chờ cửa sổ cuối kỳ.</li>
     *   <li>Nếu không có {@code 404}: ưu tiên phase đang mở cửa sổ thời gian.</li>
     *   <li>Ngoài cửa sổ và không đủ điều kiện nộp muộn: không cho submit.</li>
         * </ul>
         */
        private static String resolveSubmitPhaseForSubmission(
                KpiCycle cycle,
                String currentPhase,
                OffsetDateTime now,
                List<MemberKpiAssignmentDTO> rows,
                OffsetDateTime accountCreatedAt) {
        if (hasLateTargetSetupSubmitCandidate(cycle, now, rows)) {
            return Constant.TARGET_SETUP_PHASE;
        }
        if (hasLateMidYearSubmitCandidate(cycle, now, rows, accountCreatedAt)) {
            return Constant.MID_YEAR_PHASE;
        }
            if (isWithinPhaseSubmitWindow(cycle, currentPhase, now)) {
                return currentPhase;
            }
            return null;
        }

    private static boolean hasLateTargetSetupSubmitCandidate(
            KpiCycle cycle,
            OffsetDateTime now,
            List<MemberKpiAssignmentDTO> rows) {
        if (cycle.getGoalSettingStart() == null || now.isBefore(cycle.getGoalSettingStart())) {
            return false;
        }
            if (rows == null || rows.isEmpty()) {
                return false;
            }
            return rows.stream()
                    .map(MemberKpiAssignmentDTO::getStatusCode)
                    .anyMatch(sc -> Objects.equals(sc, ASM_PENDING_ACCEPTANCE) || Objects.equals(sc, 406));
        }

    private static boolean hasLateMidYearSubmitCandidate(
            KpiCycle cycle,
            OffsetDateTime now,
            List<MemberKpiAssignmentDTO> rows,
            OffsetDateTime accountCreatedAt) {
        if (lateOnboardUserForCycle(accountCreatedAt, cycle)) {
            return false;
        }
        if (cycle.getMidYearEnd() == null || !now.isAfter(cycle.getMidYearEnd())) {
            return false;
        }
        if (rows == null || rows.isEmpty()) {
            return false;
        }
        if (assignmentsIndicatePhaseAlreadyDone(Constant.MID_YEAR_PHASE, rows)) {
            return false;
        }
        boolean hasFinalSubmission = rows.stream()
                .map(MemberKpiAssignmentDTO::getStatusCode)
                .filter(Objects::nonNull)
                .anyMatch(sc -> sc == 601 || sc == 602 || sc == 603);
        if (hasFinalSubmission) {
            return false;
        }
        return rows.stream().anyMatch(row -> Objects.equals(row.getStatusCode(), ASM_ACCEPTED));
    }

        /**
         * {@code users.created_at} sau {@code kpi_cycles.mid_year_end} → không còn lộ trình nộp giữa kỳ
         * (đồng bộ FE timeline Year-End only).
         */
        private static boolean lateOnboardUserForCycle(OffsetDateTime accountCreatedAt, KpiCycle cycle) {
            if (accountCreatedAt == null || cycle == null || cycle.getMidYearEnd() == null) {
                return false;
            }
            return accountCreatedAt.isAfter(cycle.getMidYearEnd());
        }

        /**
         * Dashboard phase ưu tiên theo ASM status để đồng bộ UI:
         * <ul>
         *   <li>Nếu còn {@code 404} ⇒ hiển thị {@code target_setup}.</li>
         *   <li>Nếu đã có {@code 601..603} ⇒ hiển thị {@code year_end}.</li>
         *   <li>Nếu đã có {@code 501..503} ⇒ hiển thị {@code mid_year}.</li>
         *   <li>Không suy ra được thì fallback theo time windows.</li>
         * </ul>
         */
        private String resolveDashboardPhase(KpiCycle cycle, List<MemberKpiAssignmentDTO> rows, OffsetDateTime accountCreatedAt) {
            if (rows != null && !rows.isEmpty()) {
                boolean hasPendingAcceptance = rows.stream()
                        .map(MemberKpiAssignmentDTO::getStatusCode)
                        .anyMatch(sc ->
                                Objects.equals(sc, ASM_PENDING_ACCEPTANCE)
                                        || Objects.equals(sc, 406)
                                        || Objects.equals(sc, ASM_FEEDBACK_IN_PROGRESS));
                if (hasPendingAcceptance) {
                    return Constant.TARGET_SETUP_PHASE;
                }
                boolean hasYearEndSubmission = rows.stream()
                        .map(MemberKpiAssignmentDTO::getStatusCode)
                        .filter(Objects::nonNull)
                        .anyMatch(sc -> sc == 601 || sc == 602 || sc == 603);
                if (hasYearEndSubmission) {
                    return Constant.END_YEAR_PHASE;
                }
                boolean hasMidYearSubmission = rows.stream()
                        .map(MemberKpiAssignmentDTO::getStatusCode)
                        .filter(Objects::nonNull)
                        .anyMatch(sc -> sc == 501 || sc == 502 || sc == 503);
                if (hasMidYearSubmission) {
                    return Constant.MID_YEAR_PHASE;
                }
                if (hasLateMidYearSubmitCandidate(cycle, OffsetDateTime.now(), rows, accountCreatedAt)) {
                    return Constant.MID_YEAR_PHASE;
                }
            }
            return getCurrentPhase(cycle);
        }

        /** Inclusive window: {@code start <= t <= end} (OffsetDateTime). */
        private static boolean isInclusiveWithin(OffsetDateTime t, OffsetDateTime start, OffsetDateTime end) {
            if (start == null || end == null) {
                return false;
            }
            return !t.isBefore(start) && !t.isAfter(end);
        }

        private static boolean isWithinPhaseSubmitWindow(KpiCycle cycle, String phase, OffsetDateTime now) {
            if (Constant.TARGET_SETUP_PHASE.equals(phase)) {
                return isInclusiveWithin(now, cycle.getGoalSettingStart(), cycle.getGoalSettingEnd());
            }
            if (Constant.MID_YEAR_PHASE.equals(phase)) {
                return isInclusiveWithin(now, cycle.getMidYearStart(), cycle.getMidYearEnd());
            }
            if (Constant.END_YEAR_PHASE.equals(phase)) {
                return isInclusiveWithin(now, cycle.getEndYearStart(), cycle.getEndYearEnd());
            }
            return false;
        }

        /**
         * Điểm tự đánh giá tự tính khi lưu minh chứng (CALC_RULE 801/802/803 + DSL trong {@code target_description}),
         * đồng bộ JSON evidences với FE {@code EvaluationEvidenceDrawer} / {@code memberKpiHelpers}.
         */
        private Integer computeAutoSelfScoreFromEvidences(MemberKpiAssignmentDTO row, String evidencesJson) {
            Integer rule = row.getCalculationRuleCode();
            if (rule == null || StringUtils.isBlank(evidencesJson)) {
                return null;
            }
            String trimmed = evidencesJson.trim();
            if (!trimmed.startsWith("{")) {
                return null;
            }
            try {
                JsonNode root = objectMapper.readTree(trimmed);
                BigDecimal metric = null;
                if (Objects.equals(rule, CALC_RULE_COMMENT) || Objects.equals(rule, CALC_RULE_SUM)) {
                    metric = metricForCommentRule803(root);
                } else if (Objects.equals(rule, CALC_RULE_AVERAGE)) {
                    metric = metricForAverageRule802(root, row.getCalculationTypeCode());
                }
                if (metric == null) {
                    return null;
                }
                return kpiScoringRulesService.resolveScore(metric, row.getTargetDescription());
            } catch (Exception ex) {
                log.debug("computeAutoSelfScoreFromEvidences skipped: {}", ex.toString());
                return null;
            }
        }

        private static BigDecimal metricForCommentRule803(JsonNode root) {
            JsonNode a = root.get("actual");
            if (a == null || a.isNull()) {
                return null;
            }
            String s = a.isNumber() ? a.numberValue().toString() : a.asText("");
            return parseFirstBigDecimal(s);
        }

        /**
         * Trung bình tỉ lệ % theo từng dòng plan/actual; 701 = Actual/Plan×100, 702 = Plan/Actual×100 (giống FE).
         */
        private static BigDecimal metricForAverageRule802(JsonNode root, Integer calculationTypeCode) {
            if (!root.has("planActualRecords") || !root.get("planActualRecords").isArray()) {
                return null;
            }
            boolean planOverActual = Objects.equals(calculationTypeCode, CALC_TYPE_PLAN_OVER_ACTUAL);
            List<BigDecimal> ratios = new ArrayList<>();
            for (JsonNode x : root.get("planActualRecords")) {
                String planStr = planCellFromRecord(x);
                String actualStr = actualCellFromRecord(x);
                BigDecimal plan = parseFirstBigDecimal(planStr);
                BigDecimal actual = parseFirstBigDecimal(actualStr);
                if (plan == null || actual == null) {
                    continue;
                }
                if (planOverActual) {
                    if (actual.compareTo(BD_ZERO) == 0) {
                        continue;
                    }
                    ratios.add(
                            plan.divide(actual, 8, RoundingMode.HALF_UP).multiply(BD_HUNDRED));
                } else {
                    if (plan.compareTo(BD_ZERO) == 0) {
                        continue;
                    }
                    ratios.add(
                            actual.divide(plan, 8, RoundingMode.HALF_UP).multiply(BD_HUNDRED));
                }
            }
            if (ratios.isEmpty()) {
                return null;
            }
            BigDecimal sum = BD_ZERO;
            for (BigDecimal r : ratios) {
                sum = sum.add(r);
            }
            return sum.divide(BigDecimal.valueOf(ratios.size()), 8, RoundingMode.HALF_UP);
        }

        private static String planCellFromRecord(JsonNode x) {
            if (x != null && x.hasNonNull("total")) {
                return textNodeOrEmpty(x.get("total"));
            }
            return x != null && x.hasNonNull("plan") ? x.get("plan").asText() : "";
        }

        private static String actualCellFromRecord(JsonNode x) {
            if (x != null && x.hasNonNull("completed")) {
                return textNodeOrEmpty(x.get("completed"));
            }
            return x != null && x.hasNonNull("actual") ? x.get("actual").asText() : "";
        }

        private static String textNodeOrEmpty(JsonNode n) {
            if (n == null || n.isNull()) {
                return "";
            }
            return n.isNumber() ? n.numberValue().toString() : n.asText("");
        }

        /** Số đầu tiên trong chuỗi (hỗ trợ "90%", "3,2") — cùng ý tưởng FE {@code parseNumericFromField}. */
        private static BigDecimal parseFirstBigDecimal(String s) {
            if (StringUtils.isBlank(s)) {
                return null;
            }
            String norm = s.trim().replace(',', '.').replace('\u00a0', ' ');
            Matcher m = FIRST_NUMERIC_TOKEN.matcher(norm);
            if (!m.find()) {
                return null;
            }
            try {
                return new BigDecimal(m.group());
            } catch (NumberFormatException e) {
                return null;
            }
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
                if (n.hasNonNull("memberFeedback")) {
                    e.memberFeedback = n.get("memberFeedback").asText();
                }
                if (n.hasNonNull("leaderFeedback")) {
                    e.leaderFeedback = n.get("leaderFeedback").asText();
                }
                if (n.hasNonNull("gmComment")) {
                    e.gmComment = n.get("gmComment").asText();
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
            String memberFeedback;
            String leaderFeedback;
            String gmComment;
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
            List<MemberKpiAssignmentDTO> rows = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycleId);
            String phase = resolveDashboardPhase(cycle, rows, user.get().getCreatedAt());
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
                            .canViewEvidence(it.isCanViewEvidence())
                            .canEditEvidence(it.isCanEditEvidence())
                            .canEditScore(it.isCanEditScore())
                            .evidenceTooltip(it.getEvidenceTooltip())
                            .evaluationState(it.getEvaluationState())
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

        /**
         * Current KPI phase from {@code kpi_cycles} time windows: active only when {@code start <= now <= end}.
         * Outside all windows: before first start → goal setup; after last end → year end; gaps → next segment label.
         */
        private String getCurrentPhase(KpiCycle cycle) {
            OffsetDateTime now = OffsetDateTime.now();
            if (isInclusiveWithin(now, cycle.getGoalSettingStart(), cycle.getGoalSettingEnd())) {
                return Constant.TARGET_SETUP_PHASE;
            }
            if (isInclusiveWithin(now, cycle.getMidYearStart(), cycle.getMidYearEnd())) {
                return Constant.MID_YEAR_PHASE;
            }
            if (isInclusiveWithin(now, cycle.getEndYearStart(), cycle.getEndYearEnd())) {
                return Constant.END_YEAR_PHASE;
            }
            if (cycle.getGoalSettingStart() != null && now.isBefore(cycle.getGoalSettingStart())) {
                return Constant.TARGET_SETUP_PHASE;
            }
            if (cycle.getEndYearEnd() != null && now.isAfter(cycle.getEndYearEnd())) {
                return Constant.END_YEAR_PHASE;
            }
            if (cycle.getGoalSettingEnd() != null
                    && cycle.getMidYearStart() != null
                    && now.isAfter(cycle.getGoalSettingEnd())
                    && now.isBefore(cycle.getMidYearStart())) {
                return Constant.MID_YEAR_PHASE;
            }
            if (cycle.getMidYearEnd() != null
                    && cycle.getEndYearStart() != null
                    && now.isAfter(cycle.getMidYearEnd())
                    && now.isBefore(cycle.getEndYearStart())) {
                return Constant.END_YEAR_PHASE;
            }
            return Constant.END_YEAR_PHASE;
        }

    }
