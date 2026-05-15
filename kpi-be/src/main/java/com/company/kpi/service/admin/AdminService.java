package com.company.kpi.service.admin;

import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.DepartmentMapper;
import com.company.kpi.mapper.RankMapper;
import com.company.kpi.mapper.JobTitleMapper;
import com.company.kpi.mapper.UserDepartmentMapper;
import com.company.kpi.mapper.UserRoleMapper;
import com.company.kpi.mapper.EmailTemplateMapper;
import com.company.kpi.request.admin.CreateAdminKpiCycleRequest;
import com.company.kpi.request.admin.NotifyRequest;
import com.company.kpi.request.admin.UpdateAdminKpiCyclePhaseDatesRequest;
import com.company.kpi.request.admin.SaveEmailTemplateRequest;
import com.company.kpi.request.admin.SaveEmployeeRequest;
import com.company.kpi.service.EmailService;
import com.company.kpi.service.EmailTemplateBuilder;
import com.company.kpi.response.admin.AdminKpiCycleResponse;
import com.company.kpi.response.admin.AdminCampaignResponse;
import com.company.kpi.response.admin.AdminCampaignResponse.CampaignStats;
import com.company.kpi.response.admin.AdminEmailTemplateResponse;
import com.company.kpi.response.admin.AdminEmployeeProgressResponse;
import com.company.kpi.response.admin.AdminEmployeeResponse;
import com.company.kpi.response.admin.AdminJobTitleResponse;
import com.company.kpi.response.admin.AdminRankResponse;
import com.company.kpi.response.admin.AdminSectionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final KpiCycleMapper kpiCycleMapper;
    private final UserMapper userMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final DepartmentMapper departmentMapper;
    private final RankMapper rankMapper;
    private final JobTitleMapper jobTitleMapper;
    private final UserDepartmentMapper userDepartmentMapper;
    private final UserRoleMapper userRoleMapper;
    private final EmailTemplateMapper emailTemplateMapper;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final EmailTemplateBuilder emailTemplateBuilder;
    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    // ── Campaigns ─────────────────────────────────────────────────────────────

    // ── KPI cycles (kỳ đánh giá) ─────────────────────────────────────────────

    public List<AdminKpiCycleResponse> listKpiCyclesForAdmin() {
        return kpiCycleMapper.selectAllCyclesForAdmin().stream()
                .map(this::toAdminKpiCycleResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public AdminKpiCycleResponse createKpiCycle(CreateAdminKpiCycleRequest req, UUID actorId) {
        if (kpiCycleMapper.findByYear(req.getYear()).isPresent()) {
            throw AppException.badRequest("Năm đánh giá " + req.getYear() + " đã tồn tại.");
        }

        assertYmdOrder("Thiết lập mục tiêu", req.getGoalSettingStartDate(), req.getGoalSettingEndDate());
        assertYmdOrder("Đánh giá 1H", req.getMidYearStartDate(), req.getMidYearEndDate());
        assertYmdOrder("Đánh giá 2H", req.getEndYearStartDate(), req.getEndYearEndDate());

        boolean activateNow = Boolean.TRUE.equals(req.getActivateImmediately());
        if (activateNow && kpiCycleMapper.countOpenCycles() > 0) {
            throw AppException.badRequest(
                    "Đang có một năm đánh giá đang mở (201). Không thể kích hoạt năm mới ngay lập tức. "
                            + "Vui lòng đóng kỳ hiện tại trước, hoặc tạo năm mới ở trạng thái đóng rồi mở sau.");
        }

        UUID newId = UUID.randomUUID();
        int statusCode = activateNow ? Constants.CycleStatus.OPEN : Constants.CycleStatus.CLOSED;
        String name = req.getName().trim();

        kpiCycleMapper.insertKpiCycle(
                newId,
                req.getYear(),
                name,
                req.getGoalSettingStartDate(),
                req.getGoalSettingEndDate(),
                req.getMidYearStartDate(),
                req.getMidYearEndDate(),
                req.getEndYearStartDate(),
                req.getEndYearEndDate(),
                statusCode,
                actorId,
                actorId);
        ensureKpiAssignmentsPartition(newId);

        return kpiCycleMapper.findById(newId)
                .map(this::toAdminKpiCycleResponse)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá vừa tạo."));
    }

    @Transactional
    public AdminKpiCycleResponse updateKpiCycleStatus(UUID id, int statusCode, UUID actorId) {
        if (statusCode != Constants.CycleStatus.OPEN && statusCode != Constants.CycleStatus.CLOSED) {
            throw AppException.badRequest("status_code chỉ được là 201 (mở) hoặc 202 (đóng).");
        }
        KpiCycle cycle = kpiCycleMapper.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá."));

        if (statusCode == Constants.CycleStatus.OPEN) {
            if (Objects.equals(cycle.getStatusCode(), Constants.CycleStatus.OPEN)) {
                return toAdminKpiCycleResponse(cycle);
            }
            if (kpiCycleMapper.countOtherOpenCycles(id) > 0) {
                throw AppException.badRequest(
                        "Đã có một năm đánh giá đang mở (201). Vui lòng đóng năm đó trước khi mở năm khác.");
            }
            kpiCycleMapper.updateCycleStatus(id, Constants.CycleStatus.OPEN, actorId);
        } else {
            if (Objects.equals(cycle.getStatusCode(), Constants.CycleStatus.CLOSED)) {
                return toAdminKpiCycleResponse(cycle);
            }
            kpiCycleMapper.updateCycleStatus(id, Constants.CycleStatus.CLOSED, actorId);
        }

        return kpiCycleMapper.findById(id)
                .map(this::toAdminKpiCycleResponse)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá."));
    }

    @Transactional
    public AdminKpiCycleResponse updateKpiCyclePhaseDates(
            UUID id,
            UpdateAdminKpiCyclePhaseDatesRequest req,
            UUID actorId) {
        String phase = req.getPhase() == null ? "" : req.getPhase().trim().toLowerCase();
        if (!"goal_setting".equals(phase) && !"mid_year".equals(phase) && !"end_year".equals(phase)) {
            throw AppException.badRequest("phase phải là goal_setting, mid_year hoặc end_year.");
        }
        kpiCycleMapper.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá."));

        String label = switch (phase) {
            case "goal_setting" -> "Thiết lập mục tiêu";
            case "mid_year" -> "Đánh giá 1H";
            case "end_year" -> "Đánh giá 2H";
            default -> "Giai đoạn";
        };
        assertYmdOrder(label, req.getStartDate(), req.getEndDate());

        int updated = kpiCycleMapper.updateCyclePhaseDates(id, phase, req.getStartDate(), req.getEndDate(), actorId);
        if (updated == 0) {
            throw AppException.notFound("Không tìm thấy kỳ đánh giá hoặc đã bị xóa.");
        }
        return kpiCycleMapper.findById(id)
                .map(this::toAdminKpiCycleResponse)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá."));
    }

    private void ensureKpiAssignmentsPartition(UUID cycleId) {
        String suffix = cycleId.toString().replace("-", "");
        String physical = "kpi_assignments_" + suffix;
        String sql = String.format(
                "CREATE TABLE IF NOT EXISTS %s PARTITION OF kpi_assignments FOR VALUES IN ('%s'::uuid)",
                physical,
                cycleId);
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception e) {
            log.error("Không tạo được partition kpi_assignments cho cycle_id={}", cycleId, e);
            throw new AppException("Không tạo được partition dữ liệu cho kỳ đánh giá mới.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private static void assertYmdOrder(String label, String startYmd, String endYmd) {
        if (startYmd == null || endYmd == null || startYmd.isBlank() || endYmd.isBlank()) {
            throw AppException.badRequest(label + ": ngày không hợp lệ.");
        }
        LocalDate s = LocalDate.parse(startYmd, DateTimeFormatter.ISO_LOCAL_DATE);
        LocalDate e = LocalDate.parse(endYmd, DateTimeFormatter.ISO_LOCAL_DATE);
        if (e.isBefore(s)) {
            throw AppException.badRequest(label + ": ngày kết thúc phải sau hoặc cùng ngày bắt đầu.");
        }
    }

    /**
     * Chuẩn hóa mốc thời gian trả về API theo offset VN (+07).
     * Tránh chuỗi dạng {@code ...Z} khiến client múi UTC hiển thị/lấy ngày lùi 1 ngày so với lịch VN.
     */
    private static OffsetDateTime toApiOffsetInVietnam(OffsetDateTime t) {
        if (t == null) {
            return null;
        }
        return t.toInstant().atZone(VIETNAM).toOffsetDateTime();
    }

    private AdminKpiCycleResponse toAdminKpiCycleResponse(KpiCycle c) {
        return AdminKpiCycleResponse.builder()
                .id(c.getId())
                .year(c.getYear())
                .name(c.getName())
                .goalSettingStart(toApiOffsetInVietnam(c.getGoalSettingStart()))
                .goalSettingEnd(toApiOffsetInVietnam(c.getGoalSettingEnd()))
                .midYearStart(toApiOffsetInVietnam(c.getMidYearStart()))
                .midYearEnd(toApiOffsetInVietnam(c.getMidYearEnd()))
                .endYearStart(toApiOffsetInVietnam(c.getEndYearStart()))
                .endYearEnd(toApiOffsetInVietnam(c.getEndYearEnd()))
                .statusCode(c.getStatusCode())
                .build();
    }

    public List<AdminCampaignResponse> getCampaigns() {
        List<KpiCycle> cycles = kpiCycleMapper.getCycles();
        int totalEmployees    = userMapper.countTotalActiveEmployees();
        int currentYear       = LocalDate.now().getYear();

        return cycles.stream().map(cycle -> {
            UUID cycleId = cycle.getId();

            int completed  = kpiAssignmentMapper.countCompletedByCycleId(cycleId);
            int pending    = kpiAssignmentMapper.countPendingByCycleId(cycleId);
            int overdue    = kpiAssignmentMapper.countOverdueByCycleId(cycleId);
            int notStarted = Math.max(0, totalEmployees - completed - pending - overdue);

            CampaignStats stats = CampaignStats.builder()
                    .total(totalEmployees)
                    .completed(completed)
                    .pending(pending)
                    .notStarted(notStarted)
                    .overdue(overdue)
                    .build();

            return AdminCampaignResponse.builder()
                    .id(cycleId.toString())
                    .label(buildLabel(cycle))
                    .period(derivePeriod(cycle, currentYear))
                    .status(deriveStatus(cycle, currentYear))
                    .startDate(cycle.getGoalSettingEnd() != null
                            ? DATE_FMT.format(cycle.getGoalSettingEnd()) : null)
                    .endDate(cycle.getEndYearEnd() != null
                            ? DATE_FMT.format(cycle.getEndYearEnd()) : null)
                    .stats(stats)
                    .build();
        }).collect(Collectors.toList());
    }

    /** Lấy tiến độ nhân viên theo period string (current / future / past_YYYY) */
    public List<AdminEmployeeProgressResponse> getEmployeeProgress(String period) {
        UUID cycleId = resolveCycleIdByPeriod(period);
        if (cycleId == null) {
            return List.of();
        }
        return userMapper.getEmployeeProgressByCycleId(cycleId);
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    /**
     * Gửi email thông báo / nhắc nhở trong một chiến dịch.
     *
     * <p>{@code type=single}: một nhân viên ({@code employeeId}).</p>
     * <p>{@code type=all}: toàn bộ active, hoặc chỉ {@code employeeIds} nếu danh sách không rỗng.</p>
     * <p>Nếu có {@code emailTemplateId} trỏ tới mẫu {@code active}, dùng subject/body từ DB (có thay biến {@code {{...}}}).</p>
     */
    public void sendNotification(UUID cycleId, NotifyRequest req) {
        String type = req.getType() == null ? "all" : req.getType();
        String campaignLabel = resolveCampaignLabel(cycleId);
        String phase = req.getPhase() == null ? "" : req.getPhase().trim().toLowerCase();
        AdminEmailTemplateResponse tpl = resolveActiveEmailTemplate(req.getEmailTemplateId());

        if ("single".equalsIgnoreCase(type)) {
            UUID employeeId = toUuid(req.getEmployeeId());
            if (employeeId == null) {
                log.warn("[Notify] type=single nhưng employeeId không hợp lệ: {}", req.getEmployeeId());
                return;
            }
            AdminEmployeeResponse emp = userMapper.getEmployeeById(employeeId);
            if (emp == null || emp.getEmail() == null) {
                log.warn("[Notify] Không tìm thấy nhân viên hoặc email cho employeeId={}", employeeId);
                return;
            }
            Map<String, String> vars = buildTemplateVars(cycleId, campaignLabel, phase, emp, req.getMessage());
            sendOneEmployeeEmail(emp.getEmail(), tpl, vars, campaignLabel, emp.getName(), req.getMessage(), true);
            return;
        }

        String recipientType = resolveRecipientType(req);
        List<UUID> targetEmployeeIds = resolveTargetEmployeeIds(req, recipientType);
        if (!targetEmployeeIds.isEmpty()) {
            log.info("[Notify][TARGETED] cycleId={} recipientType={} phase={} → {} nhân viên",
                    cycleId, recipientType, phase, targetEmployeeIds.size());
            for (UUID eid : targetEmployeeIds) {
                AdminEmployeeResponse emp = userMapper.getEmployeeById(eid);
                if (emp == null || emp.getEmail() == null) {
                    log.warn("[Notify] Bỏ qua employeeId={} (không tìm thấy hoặc không có email)", eid);
                    continue;
                }
                Map<String, String> vars = buildTemplateVars(cycleId, campaignLabel, phase, emp, req.getMessage());
                sendOneEmployeeEmail(emp.getEmail(), tpl, vars, campaignLabel, emp.getName(), req.getMessage(), false);
            }
            return;
        }

        if (!"all".equalsIgnoreCase(recipientType)) {
            log.warn("[Notify] recipientType={} nhưng không có người nhận hợp lệ", recipientType);
            return;
        }

        List<String> emails = userMapper.getAllActiveEmployeeEmails();
        log.info("[Notify][MASS] cycleId={} phase={} → gửi mass mail đến {} nhân viên",
                cycleId, phase, emails.size());
        Map<String, String> vars = buildTemplateVars(cycleId, campaignLabel, phase, null, req.getMessage());
        String subject;
        String htmlBody;
        if (tpl != null && tpl.getSubject() != null && tpl.getBody() != null) {
            subject = emailTemplateBuilder.applyPlaceholders(tpl.getSubject(), vars, true);
            String bodyText = emailTemplateBuilder.applyPlaceholders(tpl.getBody(), vars, true);
            htmlBody = emailTemplateBuilder.plainTextToHtmlEmail(appendOptionalNote(bodyText, req.getMessage()));
        } else {
            subject = "[Thông báo KPI] Yêu cầu thực hiện Đánh giá — " + campaignLabel;
            htmlBody = emailTemplateBuilder.buildAnnounceHtml(campaignLabel, null);
        }
        emailService.sendBulkHtml(emails, subject, htmlBody);
    }

    private static String resolveRecipientType(NotifyRequest req) {
        if (req.getRecipientType() != null && !req.getRecipientType().isBlank()) {
            return req.getRecipientType().trim().toLowerCase();
        }
        if (req.getEmployeeIds() != null && !req.getEmployeeIds().isEmpty()) {
            return "individual";
        }
        if (req.getDepartmentIds() != null && !req.getDepartmentIds().isEmpty()) {
            return "department";
        }
        return "all";
    }

    private List<UUID> resolveTargetEmployeeIds(NotifyRequest req, String recipientType) {
        if ("individual".equalsIgnoreCase(recipientType)) {
            return parseEmployeeIdList(req.getEmployeeIds());
        }
        if ("department".equalsIgnoreCase(recipientType)) {
            List<UUID> deptIds = parseEmployeeIdList(req.getDepartmentIds());
            if (deptIds.isEmpty()) {
                return List.of();
            }
            return userMapper.getActiveEmployeeIdsByDepartmentIds(deptIds);
        }
        return List.of();
    }

    private AdminEmailTemplateResponse resolveActiveEmailTemplate(String templateIdStr) {
        UUID id = toUuid(templateIdStr);
        if (id == null) {
            return null;
        }
        AdminEmailTemplateResponse t = emailTemplateMapper.getEmailTemplateById(id);
        if (t == null || t.getStatus() == null || !"active".equalsIgnoreCase(t.getStatus())) {
            return null;
        }
        return t;
    }

    private List<UUID> parseEmployeeIdList(List<String> raw) {
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        List<UUID> out = new ArrayList<>();
        for (String s : raw) {
            UUID u = toUuid(s);
            if (u != null) {
                out.add(u);
            }
        }
        return out;
    }

    private Map<String, String> buildTemplateVars(
            UUID cycleId,
            String campaignLabel,
            String phase,
            AdminEmployeeResponse emp,
            String customMessage) {
        Map<String, String> m = new HashMap<>();
        m.put("Employee_Name", emp != null && emp.getName() != null ? emp.getName() : "Anh/Chị");
        m.put("Employee_Code", emp != null && emp.getCode() != null ? emp.getCode() : "—");
        m.put("Section_Name", emp != null && emp.getSection() != null ? emp.getSection() : "—");
        m.put("KPI_Period", campaignLabel != null ? campaignLabel : "Kỳ hiện tại");
        m.put("Phase_Name", resolvePhaseLabel(phase));
        m.put("Deadline_Date", resolvePhaseDeadline(cycleId, phase));
        m.put("System_URL", "—");
        m.put("Missing_Count", "—");
        m.put("Manager_Comment", customMessage != null && !customMessage.isBlank() ? customMessage : "—");
        return m;
    }

    private static String resolvePhaseLabel(String phase) {
        if (phase == null || phase.isBlank()) {
            return "—";
        }
        return switch (phase) {
            case "goal_setting" -> "Thiết lập mục tiêu";
            case "mid_year" -> "Đánh giá 1H";
            case "end_year" -> "Đánh giá 2H";
            default -> phase;
        };
    }

    private String resolvePhaseDeadline(UUID cycleId, String phase) {
        if (cycleId == null || phase == null || phase.isBlank()) {
            return "—";
        }
        return kpiCycleMapper.findById(cycleId)
                .map(cycle -> {
                    OffsetDateTime end = switch (phase) {
                        case "goal_setting" -> cycle.getGoalSettingEnd();
                        case "mid_year" -> cycle.getMidYearEnd();
                        case "end_year" -> cycle.getEndYearEnd();
                        default -> null;
                    };
                    if (end == null) {
                        return "—";
                    }
                    return end.atZoneSameInstant(VIETNAM).toLocalDate().format(DATE_FMT);
                })
                .orElse("—");
    }

    private void sendOneEmployeeEmail(
            String toEmail,
            AdminEmailTemplateResponse tpl,
            Map<String, String> vars,
            String campaignLabel,
            String employeeName,
            String customMessage,
            boolean isRemindStyleFallback) {
        String subject;
        String htmlBody;
        if (tpl != null && tpl.getSubject() != null && tpl.getBody() != null) {
            subject = emailTemplateBuilder.applyPlaceholders(tpl.getSubject(), vars, true);
            String bodyText = emailTemplateBuilder.applyPlaceholders(tpl.getBody(), vars, true);
            htmlBody = emailTemplateBuilder.plainTextToHtmlEmail(appendOptionalNote(bodyText, customMessage));
        } else if (isRemindStyleFallback) {
            subject = "[Nhắc nhở KPI] Vui lòng hoàn thành đánh giá — " + campaignLabel;
            htmlBody = emailTemplateBuilder.buildRemindHtml(employeeName, "chưa hoàn thành", campaignLabel);
        } else {
            subject = "[Thông báo KPI] Yêu cầu thực hiện Đánh giá — " + campaignLabel;
            htmlBody = emailTemplateBuilder.buildAnnounceHtml(campaignLabel, employeeName);
        }
        emailService.sendHtml(toEmail, subject, htmlBody);
    }

    private static String appendOptionalNote(String body, String note) {
        if (note == null || note.isBlank()) {
            return body;
        }
        return body + "\n\n---\nGhi chú từ Admin:\n" + note;
    }

    /** Tìm label của campaign theo cycleId */
    private String resolveCampaignLabel(UUID cycleId) {
        if (cycleId == null) return "Kỳ đánh giá hiện tại";
        return kpiCycleMapper.getCycles().stream()
                .filter(c -> cycleId.equals(c.getId()))
                .map(this::buildLabel)
                .findFirst()
                .orElse("Kỳ đánh giá KPI");
    }

    // ── Sections & Ranks ──────────────────────────────────────────────────────

    public List<AdminSectionResponse> getSections() {
        return departmentMapper.getSections();
    }

    public List<AdminRankResponse> getRanks() {
        return rankMapper.getRanks();
    }

    public List<AdminJobTitleResponse> getJobTitles() {
        return jobTitleMapper.getJobTitles();
    }

    // ── Employees ─────────────────────────────────────────────────────────────

    public List<AdminEmployeeResponse> getEmployees() {
        return userMapper.getEmployees();
    }

    public AdminEmployeeResponse createEmployee(SaveEmployeeRequest req) {
        UUID newId = UUID.randomUUID();
        String hash = (req.getPassword() != null && !req.getPassword().isBlank())
                ? passwordEncoder.encode(req.getPassword())
                : passwordEncoder.encode("Abc@12345");

        UUID jobTitleId = resolveJobTitleId(req);
        boolean isActive = !"inactive".equalsIgnoreCase(req.getStatus());

        userMapper.insertEmployee(newId, req.getCode(), req.getEmail(),
                hash, req.getName(), jobTitleId, isActive);

        UUID deptId = toUuid(req.getSectionId());
        if (deptId != null) {
            UUID supervisorId = departmentMapper.getManagerIdByDepartmentId(deptId);
            userDepartmentMapper.insertUserDepartment(newId, deptId, supervisorId);
        }
        userRoleMapper.assignMemberRole(newId);

        return userMapper.getEmployeeById(newId);
    }

    public AdminEmployeeResponse updateEmployee(UUID id, SaveEmployeeRequest req) {
        UUID jobTitleId = resolveJobTitleId(req);
        boolean isActive = !"inactive".equalsIgnoreCase(req.getStatus());

        userMapper.updateEmployee(id, req.getName(), req.getEmail(), jobTitleId, isActive);

        UUID deptId = toUuid(req.getSectionId());
        if (deptId != null) {
            userDepartmentMapper.deletePrimaryDepartment(id);
            UUID supervisorId = departmentMapper.getManagerIdByDepartmentId(deptId);
            userDepartmentMapper.insertUserDepartment(id, deptId, supervisorId);
        }

        return userMapper.getEmployeeById(id);
    }

    /** Ưu tiên jobTitleId; fallback sang rankCode (tương thích UI cũ). */
    private UUID resolveJobTitleId(SaveEmployeeRequest req) {
        if (req == null) return null;
        UUID jobTitleId = toUuid(req.getJobTitleId());
        if (jobTitleId != null) return jobTitleId;
        if (req.getRankCode() == null || req.getRankCode().isBlank()) return null;
        String id = jobTitleMapper.findJobTitleIdByRankCode(req.getRankCode());
        return toUuid(id);
    }

    // ── Email Templates ───────────────────────────────────────────────────────

    public List<AdminEmailTemplateResponse> getEmailTemplates() {
        return emailTemplateMapper.getEmailTemplates();
    }

    public AdminEmailTemplateResponse createEmailTemplate(SaveEmailTemplateRequest req, UUID createdBy) {
        UUID newId = UUID.randomUUID();
        String mode = normalizeSendMode(req.getMode());
        String group = normalizeTemplateGroup(req.getGroup());
        emailTemplateMapper.insertEmailTemplate(newId, req.getName(), req.getSubject(), req.getBody(),
                req.getStatus(), mode, group, createdBy);
        return emailTemplateMapper.getEmailTemplateById(newId);
    }

    public AdminEmailTemplateResponse updateEmailTemplate(UUID id, SaveEmailTemplateRequest req, UUID updatedBy) {
        String mode = normalizeSendMode(req.getMode());
        String group = normalizeTemplateGroup(req.getGroup());
        emailTemplateMapper.updateEmailTemplate(id, req.getName(), req.getSubject(), req.getBody(),
                req.getStatus(), mode, group, updatedBy);
        return emailTemplateMapper.getEmailTemplateById(id);
    }

    @Transactional
    public void deleteEmailTemplate(UUID id, UUID updatedBy) {
        int n = emailTemplateMapper.softDeleteEmailTemplate(id, updatedBy);
        if (n == 0) {
            throw AppException.notFound("Không tìm thấy mẫu email hoặc đã bị xóa.");
        }
    }

    private static String normalizeSendMode(String mode) {
        if (mode == null || mode.isBlank()) {
            return "manual";
        }
        return mode;
    }

    private static String normalizeTemplateGroup(String group) {
        if (group == null || group.isBlank()) {
            return "launch";
        }
        return group;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildLabel(KpiCycle cycle) {
        Integer sc = cycle.getStatusCode();
        String statusNote = (sc != null && sc == 201) ? "(Đang diễn ra)" : "(Đã kết thúc)";
        return "Kỳ đánh giá " + cycle.getYear() + " " + statusNote;
    }

    /** Chuyển đổi cycle thành period string để frontend nhận dạng */
    private String derivePeriod(KpiCycle cycle, int currentYear) {
        Integer sc = cycle.getStatusCode();
        if (cycle.getYear() == currentYear && sc != null && sc == 201) {
            return "current";
        }
        if (cycle.getYear() > currentYear) {
            return "future";
        }
        return "past_" + cycle.getYear();
    }

    /** status_code 201 = OPEN → active; 202 = CLOSED → archived */
    private String deriveStatus(KpiCycle cycle, int currentYear) {
        if (cycle.getYear() > currentYear) return "upcoming";
        Integer sc = cycle.getStatusCode();
        if (sc != null && sc == 202) return "archived";
        return "active";
    }

    /** Tìm cycleId từ period string */
    private UUID resolveCycleIdByPeriod(String period) {
        if (period == null) return null;
        int currentYear = LocalDate.now().getYear();
        List<KpiCycle> cycles = kpiCycleMapper.getCycles();

        if ("current".equals(period)) {
            return cycles.stream()
                    .filter(c -> c.getYear() == currentYear
                            && c.getStatusCode() != null
                            && c.getStatusCode() == 201)
                    .map(KpiCycle::getId)
                    .findFirst().orElse(
                            cycles.stream()
                                    .filter(c -> c.getYear() == currentYear)
                                    .map(KpiCycle::getId)
                                    .findFirst().orElse(null)
                    );
        }
        if ("future".equals(period)) {
            return cycles.stream()
                    .filter(c -> c.getYear() > currentYear)
                    .map(KpiCycle::getId)
                    .findFirst().orElse(null);
        }
        // past_YYYY
        if (period.startsWith("past_")) {
            String yearStr = period.substring(5);
            try {
                int year = Integer.parseInt(yearStr);
                return cycles.stream()
                        .filter(c -> c.getYear() == year)
                        .map(KpiCycle::getId)
                        .findFirst().orElse(null);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private UUID toUuid(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
