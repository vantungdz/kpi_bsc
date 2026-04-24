package com.company.kpi.controller.admin;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.admin.NotifyRequest;
import com.company.kpi.request.admin.SaveEmailTemplateRequest;
import com.company.kpi.request.admin.SaveEmployeeRequest;
import com.company.kpi.response.admin.AdminCampaignResponse;
import com.company.kpi.response.admin.AdminEmailTemplateResponse;
import com.company.kpi.response.admin.AdminEmployeeProgressResponse;
import com.company.kpi.response.admin.AdminEmployeeResponse;
import com.company.kpi.response.admin.AdminJobTitleResponse;
import com.company.kpi.response.admin.AdminRankResponse;
import com.company.kpi.response.admin.AdminSectionResponse;
import com.company.kpi.service.admin.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Admin endpoints:
 *   GET  /api/v1/admin/campaigns
 *   GET  /api/v1/admin/campaigns/progress?period=current
 *   POST /api/v1/admin/campaigns/{id}/notify
 *   GET  /api/v1/admin/employees
 *   POST /api/v1/admin/employees
 *   PUT  /api/v1/admin/employees/{id}
 *   GET  /api/v1/admin/email-templates
 *   POST /api/v1/admin/email-templates
 *   PUT  /api/v1/admin/email-templates/{id}
 */
@RestController
@RequestMapping("/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController extends BaseController {

    private final AdminService adminService;

    // ── Campaigns ─────────────────────────────────────────────────────────────

    @GetMapping("/campaigns")
    public ResponseEntity<BaseResponse<List<AdminCampaignResponse>>> getCampaigns() {
        return success(adminService.getCampaigns());
    }

    @GetMapping("/campaigns/progress")
    public ResponseEntity<BaseResponse<List<AdminEmployeeProgressResponse>>> getProgress(
            @RequestParam(defaultValue = "current") String period) {
        return success(adminService.getEmployeeProgress(period));
    }

    /**
     * Gửi email thông báo / nhắc nhở trong một chiến dịch.
     * Body: { type: "all" | "single", employeeId?: UUID, message?: string }
     */
    @PostMapping("/campaigns/{id}/notify")
    public ResponseEntity<BaseResponse<Void>> sendNotify(
            @PathVariable UUID id,
            @RequestBody(required = false) NotifyRequest req) {
        adminService.sendNotification(id, req != null ? req : new NotifyRequest());
        return success();
    }

    // ── Sections & Ranks ──────────────────────────────────────────────────────

    @GetMapping("/sections")
    public ResponseEntity<BaseResponse<List<AdminSectionResponse>>> getSections() {
        return success(adminService.getSections());
    }

    @GetMapping("/ranks")
    public ResponseEntity<BaseResponse<List<AdminRankResponse>>> getRanks() {
        return success(adminService.getRanks());
    }

    @GetMapping("/job-titles")
    public ResponseEntity<BaseResponse<List<AdminJobTitleResponse>>> getJobTitles() {
        return success(adminService.getJobTitles());
    }

    // ── Employees ─────────────────────────────────────────────────────────────

    @GetMapping("/employees")
    public ResponseEntity<BaseResponse<List<AdminEmployeeResponse>>> getEmployees() {
        return success(adminService.getEmployees());
    }

    @PostMapping("/employees")
    public ResponseEntity<BaseResponse<AdminEmployeeResponse>> createEmployee(
            @RequestBody SaveEmployeeRequest req) {
        return created(adminService.createEmployee(req));
    }

    @PutMapping("/employees/{id}")
    public ResponseEntity<BaseResponse<AdminEmployeeResponse>> updateEmployee(
            @PathVariable UUID id,
            @RequestBody SaveEmployeeRequest req) {
        return success(adminService.updateEmployee(id, req));
    }

    // ── Email Templates ───────────────────────────────────────────────────────

    @GetMapping("/email-templates")
    public ResponseEntity<BaseResponse<List<AdminEmailTemplateResponse>>> getEmailTemplates() {
        return success(adminService.getEmailTemplates());
    }

    @PostMapping("/email-templates")
    public ResponseEntity<BaseResponse<AdminEmailTemplateResponse>> createEmailTemplate(
            @RequestBody SaveEmailTemplateRequest req,
            Authentication auth) {
        UUID userId = toUUID(auth.getName());
        return created(adminService.createEmailTemplate(req, userId));
    }

    @PutMapping("/email-templates/{id}")
    public ResponseEntity<BaseResponse<AdminEmailTemplateResponse>> updateEmailTemplate(
            @PathVariable UUID id,
            @RequestBody SaveEmailTemplateRequest req,
            Authentication auth) {
        UUID userId = toUUID(auth.getName());
        return success(adminService.updateEmailTemplate(id, req, userId));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UUID toUUID(String value) {
        try {
            return UUID.fromString(value);
        } catch (Exception e) {
            return null;
        }
    }
}
