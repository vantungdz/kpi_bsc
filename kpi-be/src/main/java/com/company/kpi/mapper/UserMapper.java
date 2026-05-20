package com.company.kpi.mapper;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import com.company.kpi.aggregate.PmDashboardAggregate;
import com.company.kpi.aggregate.PmMemberOptionAggregate;
import com.company.kpi.entity.User;
import com.company.kpi.aggregate.UserJobTitlePair;
import com.company.kpi.aggregate.UserTeamHierarchyAggregate;
import com.company.kpi.response.pm.PmPortfolioGatePendingMemberResponse;
import com.company.kpi.response.admin.AdminEmployeeProgressResponse;
import com.company.kpi.response.admin.AdminEmployeeResponse;
import com.company.kpi.response.gm.GmMemberResponse;
import com.company.kpi.response.reference.DepartmentManagerOptionResponse;
import com.company.kpi.response.reference.MemberByRankOptionResponse;

@Mapper
public interface UserMapper {

    @Select("""
            SELECT
                U.ID,
                U.EMAIL,
                U.PASSWORD_HASH,
                U.FULL_NAME,
                R.CODE AS ROLE,
                U.IS_ACTIVE,
                U.CREATED_AT,
                U.UPDATED_AT
            FROM
                USERS U
                LEFT JOIN USER_ROLES UR ON U.ID = UR.USER_ID
                LEFT JOIN ROLES R ON UR.ROLE_ID = R.ID
            WHERE
                U.EMAIL = #{email}
                AND U.IS_ACTIVE = TRUE
            """)
    @Results(id = "userResultMap", value = {
            @Result(property = "id",           column = "id",            javaType = UUID.class),
            @Result(property = "email",        column = "email"),
            @Result(property = "passwordHash", column = "password_hash"),
            @Result(property = "fullName",     column = "full_name"),
            @Result(property = "role",         column = "role"),
            @Result(property = "isActive",     column = "is_active"),
            @Result(property = "createdAt",    column = "created_at"),
            @Result(property = "updatedAt",    column = "updated_at")
    })
    User findByEmail(String email);

    Optional<User> findById(UUID id);

    /**
     * Fetches a list of members (users) under a specific PM's department 
     * along with their KPI assignments for a given cycle.
     * Returns an Aggregate as it combines User and KpiAssignment data.
     */
    List<PmDashboardAggregate> findUsersWithAssignmentsByPmIdAndCycleId(
            @Param("pmId") UUID pmId,
            @Param("cycleId") UUID cycleId
    );

    List<PmMemberOptionAggregate> findMembersByPmDepartment(@Param("pmUserId") UUID pmUserId);

    /** User active có role PM — kèm tên department đang quản lý (nếu có). */
    List<DepartmentManagerOptionResponse> listActiveDepartmentManagers();

    boolean existsActiveUserWithRoleCode(@Param("userId") UUID userId, @Param("roleCode") String roleCode);

    /** User có {@code job_titles} → {@code ranks.code} = {@code rankCode}. */
    List<MemberByRankOptionResponse> listActiveUsersByRankCode(@Param("rankCode") String rankCode);

    /**
     * User active — KPI Promotion «Assign To Individuals»: phòng ban chính + cấp bậc (nếu có chức danh).
     */
    List<MemberByRankOptionResponse> listActiveUsersForPromotionAssignment();

    List<GmMemberResponse> listActiveGmMembers();

    int countTotalActiveEmployees();

    List<AdminEmployeeProgressResponse> getEmployeeProgressByCycleId(@Param("cycleId") UUID cycleId);

    AdminEmployeeResponse getEmployeeById(@Param("id") UUID id);

    List<String> getAllActiveEmployeeEmails();

    List<AdminEmployeeResponse> getEmployees();

    /** Nhân viên active (không ADMIN) thuộc ít nhất một phòng ban trong danh sách. */
    List<UUID> getActiveEmployeeIdsByDepartmentIds(@Param("departmentIds") List<UUID> departmentIds);

    void insertEmployee(
            @Param("id") UUID id,
            @Param("code") String code,
            @Param("email") String email,
            @Param("passwordHash") String passwordHash,
            @Param("fullName") String fullName,
            @Param("jobTitleId") UUID jobTitleId,
            @Param("isActive") boolean isActive);

    void updateEmployee(
            @Param("id") UUID id,
            @Param("fullName") String fullName,
            @Param("email") String email,
            @Param("jobTitleId") UUID jobTitleId,
            @Param("isActive") boolean isActive);

    int softDeleteUser(@Param("id") UUID id, @Param("actorId") UUID actorId);

    List<UUID> listExistingActiveUserIds(@Param("userIds") List<UUID> userIds);

    List<UserJobTitlePair> listUserJobTitlesByIds(@Param("userIds") List<UUID> userIds);

    List<UserTeamHierarchyAggregate> findTeamHierarchyBySupervisor(@Param("pmId") UUID pmId, @Param("cycleId") UUID cycleId);

    @Select("""
            SELECT EXISTS (
                SELECT 1
                FROM user_roles ur
                INNER JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
                WHERE ur.user_id = #{userId}
                  AND UPPER(TRIM(r.code)) = UPPER(TRIM(#{roleCode}))
            )
            """)
    boolean userHasRoleCode(@Param("userId") UUID userId, @Param("roleCode") String roleCode);

    /**
     * Member dưới PM còn KPI individual/team (không promotion) với {@code status_code} dưới 501
     * (chưa vào nhánh chờ PM giữa kỳ / cuối kỳ).
     */
    List<PmPortfolioGatePendingMemberResponse> listPmPortfolioGateBlockingMembers(
            @Param("pmId") UUID pmId,
            @Param("cycleId") UUID cycleId);
}
