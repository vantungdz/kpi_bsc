package com.company.kpi.controller.common;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.common.util.JwtUtil;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.common.AssigneeTargetScaleUpdateRequest;
import com.company.kpi.response.common.AssigneeTargetScaleUpdateResponse;
import com.company.kpi.service.common.AssigneeTargetScaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * API dùng chung cho assignee (PM / Leader / Member) sửa target & thang điểm trên assignment.
 */
@RestController
@RequestMapping("/v1/common/assignments")
@RequiredArgsConstructor
public class AssigneeTargetScaleController extends BaseController {

    private final AssigneeTargetScaleService assigneeTargetScaleService;
    private final JwtUtil jwtUtil;

    @PutMapping("/{assignmentId}/assignee-target-scale")
    public ResponseEntity<BaseResponse<AssigneeTargetScaleUpdateResponse>> updateAssigneeTargetAndScale(
            @PathVariable UUID assignmentId,
            @Valid @RequestBody AssigneeTargetScaleUpdateRequest request,
            Authentication authentication) {
        UUID userId = jwtUtil.resolveUserId(authentication);
        return success(
                assigneeTargetScaleService.updateAssigneeTargetAndScale(assignmentId, userId, request));
    }
}
