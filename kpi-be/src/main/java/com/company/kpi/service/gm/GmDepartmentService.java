package com.company.kpi.service.gm;

import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.DepartmentMapper;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.aggregate.DeptMemberJoinRow;
import com.company.kpi.aggregate.DeptTeamKpiJoinRow;
import com.company.kpi.request.gm.CreateDepartmentRequest;
import com.company.kpi.request.gm.UpdateDepartmentRequest;
import com.company.kpi.request.gm.AddDepartmentMembersRequest;
import com.company.kpi.response.gm.GmDepartmentAssignedKpiResponse;
import com.company.kpi.response.gm.GmDepartmentMemberCandidateResponse;
import com.company.kpi.response.gm.GmDepartmentMemberResponse;
import com.company.kpi.response.gm.GmDepartmentResponse;
import com.company.kpi.response.gm.GmMemberResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Year;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GmDepartmentService {

    private final DepartmentMapper departmentMapper;
    private final UserMapper userMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;

    public List<GmDepartmentResponse> listDepartments(int kpiYear) {
        List<GmDepartmentResponse> list = departmentMapper.selectAllActive();
        hydrateDepartmentPayloads(list, kpiYear);
        return list;
    }

    public List<GmMemberResponse> listMembers() {
        return userMapper.listActiveGmMembers();
    }

    @Transactional
    public GmDepartmentResponse create(CreateDepartmentRequest request, UUID actorId) {
        validateParentExists(request.getParentId());
        validateManagerUser(request.getManagerId());

        UUID id = UUID.randomUUID();
        int n = departmentMapper.insertDepartment(
                id,
                request.getName().trim(),
                request.getParentId(),
                request.getManagerId(),
                actorId);
        if (n != 1) {
            throw new AppException("Failed to create department", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        GmDepartmentResponse created = departmentMapper.selectActiveById(id);
        if (created == null) {
            throw new AppException("Department not found after create", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        hydrateDepartmentPayloads(List.of(created), kpiYearDefault());
        return created;
    }

    @Transactional
    public GmDepartmentResponse update(UUID departmentId, UpdateDepartmentRequest request, UUID actorId) {
        GmDepartmentResponse existing = departmentMapper.selectActiveById(departmentId);
        if (existing == null) {
            throw AppException.notFound("Department not found");
        }
        validateParentExists(request.getParentId());
        validateManagerUser(request.getManagerId());
        validateParentNotDescendantOf(departmentId, request.getParentId());

        int n = departmentMapper.updateDepartment(
                departmentId,
                request.getName().trim(),
                request.getParentId(),
                request.getManagerId(),
                actorId);
        if (n != 1) {
            throw AppException.notFound("Department not found or already deleted");
        }
        GmDepartmentResponse updated = departmentMapper.selectActiveById(departmentId);
        hydrateDepartmentPayloads(List.of(updated), kpiYearDefault());
        return updated;
    }

    /**
     * User active chưa thuộc phòng {@code departmentId} — dùng modal thêm thành viên GM.
     */
    public List<GmDepartmentMemberCandidateResponse> listMemberCandidates(
            UUID departmentId, String query, List<String> rankCodes) {
        GmDepartmentResponse dept = departmentMapper.selectActiveById(departmentId);
        if (dept == null) {
            throw AppException.notFound("Department not found");
        }
        String q = query == null ? "" : query.trim();
        List<String> ranks =
                rankCodes == null
                        ? null
                        : rankCodes.stream()
                                .map(String::trim)
                                .filter(s -> !s.isEmpty())
                                .distinct()
                                .toList();
        if (ranks != null && ranks.isEmpty()) {
            ranks = null;
        }
        return departmentMapper.selectMemberCandidatesForDepartment(
                departmentId, q.isEmpty() ? null : q, ranks);
    }

    /**
     * Thêm user vào phòng: user được gỡ khỏi mọi phòng ban khác (chỉ còn membership phòng đích).
     * Nếu user đang là {@code MANAGER_ID} của một phòng khác thì từ chối (phải đổi manager trước).
     */
    @Transactional
    public GmDepartmentResponse addMembers(UUID departmentId, AddDepartmentMembersRequest request) {
        GmDepartmentResponse dept = departmentMapper.selectActiveById(departmentId);
        if (dept == null) {
            throw AppException.notFound("Department not found");
        }
        UUID supervisorId = dept.getManagerId();
        Set<UUID> seen = new HashSet<>();
        Set<UUID> insertedUserIds = new HashSet<>();
        for (UUID userId : request.getUserIds()) {
            if (userId == null || !seen.add(userId)) {
                continue;
            }
            userMapper
                    .findById(userId)
                    .orElseThrow(() -> AppException.badRequest("User does not exist or is inactive: " + userId));
            if (departmentMapper.countUserDepartmentMembership(departmentId, userId) > 0) {
                continue;
            }
            List<UUID> managedElsewhere =
                    departmentMapper.selectActiveDepartmentIdsManagedByUserExcept(userId, departmentId);
            if (!managedElsewhere.isEmpty()) {
                throw AppException.badRequest(
                        "User is set as manager of another department; change that department's manager before adding them here.");
            }
            departmentMapper.deleteUserDepartmentsExcept(userId, departmentId);
            int deptCount = departmentMapper.countDepartmentsForUser(userId);
            boolean isPrimary = deptCount == 0;
            int ins = departmentMapper.insertUserDepartment(userId, departmentId, supervisorId, isPrimary);
            if (ins != 1) {
                throw new AppException("Failed to add user to department", HttpStatus.INTERNAL_SERVER_ERROR);
            }
            insertedUserIds.add(userId);
        }
        for (UUID uid : insertedUserIds) {
            applyPrimaryNormalization(uid);
        }
        GmDepartmentResponse out = departmentMapper.selectActiveById(departmentId);
        hydrateDepartmentPayloads(List.of(out), kpiYearDefault());
        return out;
    }

    @Transactional
    public void removeMember(UUID departmentId, UUID userId) {
        GmDepartmentResponse dept = departmentMapper.selectActiveById(departmentId);
        if (dept == null) {
            throw AppException.notFound("Department not found");
        }
        if (dept.getManagerId() != null && dept.getManagerId().equals(userId)) {
            throw AppException.badRequest(
                    "Cannot remove the department manager from membership; change manager first.");
        }
        departmentMapper.deleteUserDepartment(departmentId, userId);
        applyPrimaryNormalization(userId);
    }

    @Transactional
    public void deleteMember(UUID userId, UUID actorId) {
        if (userId == null) {
            throw AppException.badRequest("User id is required");
        }
        userMapper
                .findById(userId)
                .orElseThrow(() -> AppException.notFound("User not found or already deleted"));
        if (departmentMapper.countActiveDepartmentsManagedByUser(userId) > 0) {
            throw AppException.badRequest(
                    "Cannot delete an employee who is manager of an active department; change manager first.");
        }
        int n = userMapper.markUserResigned(userId, actorId);
        if (n != 1) {
            throw AppException.notFound("User not found or already deleted");
        }
        kpiAssignmentMapper.markAssignmentsUserResigned(userId, actorId);
    }

    /**
     * Gọi từ service khác (proxy Spring) để bọc transaction khi sửa trong luồng đọc diagnostics.
     *
     * @return {@code true} nếu đã cập nhật DB
     */
    @Transactional
    public boolean ensurePrimaryDepartmentForUser(UUID userId) {
        return applyPrimaryNormalization(userId);
    }

    /**
     * Nếu user còn ít nhất một {@code user_departments} nhưng không có dòng {@code is_primary = true},
     * gán primary cho một phòng (ổn định theo {@code department_id}) để JOIN diagnostics không trả {@code NULL}.
     *
     * @return {@code true} nếu đã cập nhật DB
     */
    private boolean applyPrimaryNormalization(UUID userId) {
        if (userId == null) {
            return false;
        }
        int total = departmentMapper.countDepartmentsForUser(userId);
        if (total <= 0) {
            return false;
        }
        int primaryCount = departmentMapper.countPrimaryDepartmentsForUser(userId);
        if (primaryCount >= 1) {
            return false;
        }
        UUID chosen = departmentMapper.selectDepartmentIdForPrimaryPromotion(userId);
        if (chosen == null) {
            return false;
        }
        departmentMapper.clearPrimaryFlagsForUser(userId);
        int n = departmentMapper.setPrimaryUserDepartment(userId, chosen, true);
        return n >= 1;
    }

    @Transactional
    public void delete(UUID departmentId, UUID actorId) {
        GmDepartmentResponse existing = departmentMapper.selectActiveById(departmentId);
        if (existing == null) {
            throw AppException.notFound("Department not found");
        }
        int childCount = departmentMapper.countActiveChildren(departmentId);
        if (childCount > 0) {
            throw AppException.badRequest("Cannot delete department that still has sub-departments");
        }
        int n = departmentMapper.softDeleteDepartment(departmentId, actorId);
        if (n != 1) {
            throw AppException.notFound("Department not found or already deleted");
        }
    }

    private int kpiYearDefault() {
        return Year.now().getValue();
    }

    private void hydrateDepartmentPayloads(List<GmDepartmentResponse> list, int kpiYear) {
        if (list == null || list.isEmpty()) {
            return;
        }
        List<UUID> ids = list.stream().map(GmDepartmentResponse::getId).filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return;
        }
        List<DeptMemberJoinRow> mrows = departmentMapper.selectMembersForDepartments(ids);
        List<DeptTeamKpiJoinRow> krows = departmentMapper.selectTeamKpisForDepartments(ids, kpiYear);

        Map<UUID, List<GmDepartmentMemberResponse>> membersBy =
                mrows.stream()
                        .collect(
                                Collectors.groupingBy(
                                        DeptMemberJoinRow::getDepartmentId,
                                        LinkedHashMap::new,
                                        Collectors.mapping(this::toMemberResponse, Collectors.toList())));

        Map<UUID, List<GmDepartmentAssignedKpiResponse>> kpisBy =
                krows.stream()
                        .collect(
                                Collectors.groupingBy(
                                        DeptTeamKpiJoinRow::getDepartmentId,
                                        LinkedHashMap::new,
                                        Collectors.mapping(this::toAssignedKpiResponse, Collectors.toList())));

        for (GmDepartmentResponse d : list) {
            d.setKpiYear(kpiYear);
            d.setMembers(membersBy.getOrDefault(d.getId(), List.of()));
            d.setAssignedKpis(kpisBy.getOrDefault(d.getId(), List.of()));
        }
    }

    private GmDepartmentMemberResponse toMemberResponse(DeptMemberJoinRow r) {
        return GmDepartmentMemberResponse.builder()
                .userId(r.getUserId())
                .fullName(r.getFullName())
                .email(r.getEmail())
                .rankCode(r.getRankCode())
                .build();
    }

    private GmDepartmentAssignedKpiResponse toAssignedKpiResponse(DeptTeamKpiJoinRow r) {
        return GmDepartmentAssignedKpiResponse.builder()
                .assignmentId(r.getAssignmentId())
                .cycleId(r.getCycleId())
                .cycleYear(r.getCycleYear())
                .kpiInfoId(r.getKpiInfoId())
                .kpiCode(r.getKpiCode())
                .kpiName(r.getKpiName())
                .statusCode(r.getStatusCode())
                .typeCode(r.getTypeCode())
                .targetValue(r.getTargetValue())
                .weight(r.getWeight())
                .build();
    }

    private void validateParentExists(UUID parentId) {
        if (parentId == null) {
            return;
        }
        GmDepartmentResponse p = departmentMapper.selectActiveById(parentId);
        if (p == null) {
            throw AppException.badRequest("Parent department does not exist");
        }
    }

    private void validateManagerUser(UUID managerId) {
        if (managerId == null) {
            return;
        }
        userMapper
                .findById(managerId)
                .orElseThrow(() -> AppException.badRequest("Manager user does not exist or is inactive"));
    }

    private void validateParentNotDescendantOf(UUID departmentId, UUID newParentId) {
        if (newParentId == null) {
            return;
        }
        if (newParentId.equals(departmentId)) {
            throw AppException.badRequest("Department cannot be its own parent");
        }
        UUID walk = newParentId;
        int guard = 0;
        while (walk != null && guard++ < 256) {
            if (walk.equals(departmentId)) {
                throw AppException.badRequest("Invalid parent: would create a circular department hierarchy");
            }
            GmDepartmentResponse row = departmentMapper.selectActiveById(walk);
            if (row == null) {
                break;
            }
            walk = row.getParentId();
        }
    }
}

