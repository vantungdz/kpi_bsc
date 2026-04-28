package com.company.kpi.service.admin;

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
import com.company.kpi.request.admin.NotifyRequest;
import com.company.kpi.request.admin.SaveEmailTemplateRequest;
import com.company.kpi.request.admin.SaveEmployeeRequest;
import com.company.kpi.service.EmailService;
import com.company.kpi.service.EmailTemplateBuilder;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
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

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    // ── Campaigns ─────────────────────────────────────────────────────────────

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
     * Xử lý gửi thông báo email cho campaign.
     *
     * type="all"    → gửi cho toàn bộ nhân viên active (mass mail)
     * type="single" → chỉ gửi cho nhân viên có employeeId trong request (remind)
     */
    public void sendNotification(UUID cycleId, NotifyRequest req) {
        String type = req.getType() == null ? "all" : req.getType();

        // Lấy tên campaign để đưa vào email template
        String campaignLabel = resolveCampaignLabel(cycleId);

        if ("single".equalsIgnoreCase(type)) {
            UUID employeeId = toUuid(req.getEmployeeId());
            if (employeeId == null) {
                log.warn("[Notify] type=single nhưng employeeId không hợp lệ: {}", req.getEmployeeId());
                return;
            }
            // Lấy thông tin nhân viên
            AdminEmployeeResponse emp = userMapper.getEmployeeById(employeeId);
            if (emp == null || emp.getEmail() == null) {
                log.warn("[Notify] Không tìm thấy nhân viên hoặc email cho employeeId={}", employeeId);
                return;
            }

            log.info("[Notify][REMIND] cycleId={} → gửi remind đến: {} ({})", cycleId, emp.getName(), emp.getEmail());
            String subject  = "[Nhắc nhở KPI] Vui lòng hoàn thành đánh giá — " + campaignLabel;
            String htmlBody = emailTemplateBuilder.buildRemindHtml(emp.getName(), "chưa hoàn thành", campaignLabel);
            emailService.sendHtml(emp.getEmail(), subject, htmlBody);

        } else {
            List<String> emails = userMapper.getAllActiveEmployeeEmails();
            log.info("[Notify][MASS] cycleId={} → gửi mass mail đến {} nhân viên", cycleId, emails.size());
            String subject  = "[Thông báo KPI] Yêu cầu thực hiện Đánh giá — " + campaignLabel;
            String htmlBody = emailTemplateBuilder.buildAnnounceHtml(campaignLabel, null);
            emailService.sendBulkHtml(emails, subject, htmlBody);
        }
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

        UUID jobTitleId = resolveJobTitleId(req.getRankCode());
        boolean isActive = !"inactive".equalsIgnoreCase(req.getStatus());

        userMapper.insertEmployee(newId, req.getCode(), req.getEmail(),
                hash, req.getName(), jobTitleId, isActive);

        UUID deptId = toUuid(req.getSectionId());
        if (deptId != null) {
            userDepartmentMapper.insertUserDepartment(newId, deptId, null);
        }
        userRoleMapper.assignMemberRole(newId);

        return userMapper.getEmployeeById(newId);
    }

    public AdminEmployeeResponse updateEmployee(UUID id, SaveEmployeeRequest req) {
        UUID jobTitleId = resolveJobTitleId(req.getRankCode());
        boolean isActive = !"inactive".equalsIgnoreCase(req.getStatus());

        userMapper.updateEmployee(id, req.getName(), req.getEmail(), jobTitleId, isActive);

        UUID deptId = toUuid(req.getSectionId());
        if (deptId != null) {
            userDepartmentMapper.deletePrimaryDepartment(id);
            userDepartmentMapper.insertUserDepartment(id, deptId, null);
        }

        return userMapper.getEmployeeById(id);
    }

    /** Tìm job_title_id từ rank code (R0, R1…) — trả về null nếu không tìm thấy */
    private UUID resolveJobTitleId(String rankCode) {
        if (rankCode == null || rankCode.isBlank()) return null;
        String id = jobTitleMapper.findJobTitleIdByRankCode(rankCode);
        return toUuid(id);
    }

    // ── Email Templates ───────────────────────────────────────────────────────

    public List<AdminEmailTemplateResponse> getEmailTemplates() {
        return emailTemplateMapper.getEmailTemplates();
    }

    public AdminEmailTemplateResponse createEmailTemplate(SaveEmailTemplateRequest req, UUID createdBy) {
        UUID newId = UUID.randomUUID();
        emailTemplateMapper.insertEmailTemplate(newId, req.getName(), req.getSubject(), req.getBody(),
                req.getStatus(), req.getMode(), req.getGroup(), createdBy);
        return emailTemplateMapper.getEmailTemplateById(newId);
    }

    public AdminEmailTemplateResponse updateEmailTemplate(UUID id, SaveEmailTemplateRequest req, UUID updatedBy) {
        emailTemplateMapper.updateEmailTemplate(id, req.getName(), req.getSubject(), req.getBody(),
                req.getStatus(), req.getMode(), req.getGroup(), updatedBy);
        return emailTemplateMapper.getEmailTemplateById(id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildLabel(KpiCycle cycle) {
        String statusNote = "201".equals(cycle.getStatus()) ? "(Đang diễn ra)" : "(Đã kết thúc)";
        return "Kỳ đánh giá " + cycle.getYear() + " " + statusNote;
    }

    /** Chuyển đổi cycle thành period string để frontend nhận dạng */
    private String derivePeriod(KpiCycle cycle, int currentYear) {
        if (cycle.getYear() == currentYear && "201".equals(cycle.getStatus())) {
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
        if ("202".equals(cycle.getStatus())) return "archived";
        return "active";
    }

    /** Tìm cycleId từ period string */
    private UUID resolveCycleIdByPeriod(String period) {
        if (period == null) return null;
        int currentYear = LocalDate.now().getYear();
        List<KpiCycle> cycles = kpiCycleMapper.getCycles();

        if ("current".equals(period)) {
            return cycles.stream()
                    .filter(c -> c.getYear() == currentYear && "201".equals(c.getStatus()))
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
