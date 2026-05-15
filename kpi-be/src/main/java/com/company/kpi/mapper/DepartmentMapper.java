package com.company.kpi.mapper;

import com.company.kpi.aggregate.DeptMemberJoinRow;
import com.company.kpi.aggregate.DeptTeamKpiJoinRow;
import com.company.kpi.response.gm.GmDepartmentResponse;
import com.company.kpi.response.gm.GmDepartmentMemberCandidateResponse;
import com.company.kpi.response.admin.AdminSectionResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface DepartmentMapper {

    List<GmDepartmentResponse> selectAllActive();

    GmDepartmentResponse selectActiveById(@Param("id") UUID id);

    int insertDepartment(
            @Param("id") UUID id,
            @Param("name") String name,
            @Param("parentId") UUID parentId,
            @Param("managerId") UUID managerId,
            @Param("actorId") UUID actorId);

    int updateDepartment(
            @Param("id") UUID id,
            @Param("name") String name,
            @Param("parentId") UUID parentId,
            @Param("managerId") UUID managerId,
            @Param("actorId") UUID actorId);

    int softDeleteDepartment(@Param("id") UUID id, @Param("actorId") UUID actorId);

    int countActiveChildren(@Param("parentId") UUID parentId);

    List<DeptMemberJoinRow> selectMembersForDepartments(@Param("departmentIds") List<UUID> departmentIds);

    List<DeptTeamKpiJoinRow> selectTeamKpisForDepartments(
            @Param("departmentIds") List<UUID> departmentIds, @Param("year") int year);

    List<GmDepartmentMemberCandidateResponse> selectMemberCandidatesForDepartment(
            @Param("departmentId") UUID departmentId,
            @Param("query") String query,
            @Param("rankCodes") List<String> rankCodes);

    int countUserDepartmentMembership(@Param("departmentId") UUID departmentId, @Param("userId") UUID userId);

    int countDepartmentsForUser(@Param("userId") UUID userId);

    int insertUserDepartment(
            @Param("userId") UUID userId,
            @Param("departmentId") UUID departmentId,
            @Param("supervisorId") UUID supervisorId,
            @Param("isPrimary") boolean isPrimary);

    int deleteUserDepartment(@Param("departmentId") UUID departmentId, @Param("userId") UUID userId);

    /** Xóa mọi membership của user trừ phòng {@code keepDepartmentId} (dùng khi “chuyển” sang phòng mới). */
    int deleteUserDepartmentsExcept(@Param("userId") UUID userId, @Param("keepDepartmentId") UUID keepDepartmentId);

    /** Xóa toàn bộ membership của user khi xóa nhân viên khỏi hệ thống. */
    int deleteUserDepartmentsByUser(@Param("userId") UUID userId);

    int countActiveDepartmentsManagedByUser(@Param("userId") UUID userId);

    /** Phòng active mà user đang là {@code MANAGER_ID}, ngoại trừ một phòng (thường là phòng đích). */
    List<UUID> selectActiveDepartmentIdsManagedByUserExcept(
            @Param("userId") UUID userId, @Param("excludeDepartmentId") UUID excludeDepartmentId);

    int countPrimaryDepartmentsForUser(@Param("userId") UUID userId);

    /** Gán {@code is_primary = false} cho mọi dòng {@code user_departments} của user. */
    int clearPrimaryFlagsForUser(@Param("userId") UUID userId);

    /** Một {@code department_id} ổn định (ORDER BY) để đặt primary khi user còn ≥1 phòng. */
    UUID selectDepartmentIdForPrimaryPromotion(@Param("userId") UUID userId);

    int setPrimaryUserDepartment(
            @Param("userId") UUID userId, @Param("departmentId") UUID departmentId, @Param("isPrimary") boolean isPrimary);

    // ── Thêm từ AdminMapper ───────────────────────────────────────────────────
    List<AdminSectionResponse> getSections();

    /** Lấy manager_id (PM) của phòng ban (departments.manager_id). */
    UUID getManagerIdByDepartmentId(@Param("departmentId") UUID departmentId);
}

