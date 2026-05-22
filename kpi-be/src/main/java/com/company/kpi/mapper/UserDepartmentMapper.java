package com.company.kpi.mapper;

import com.company.kpi.response.admin.AdminEmployeeCandidateResponse;
import com.company.kpi.response.leader.LeaderMemberInfoDTO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface UserDepartmentMapper {

    List<LeaderMemberInfoDTO> findLeaderMemberListInfo(UUID leaderId);

    List<LeaderMemberInfoDTO> findLeaderMemberListByYear(@Param("leaderId") UUID leaderId,
                                                         @Param("cycleId") UUID cycleId);

    // ── Thêm từ AdminMapper ───────────────────────────────────────────────────
    void insertUserDepartment(@Param("userId") UUID userId,
                              @Param("departmentId") UUID departmentId,
                              @Param("supervisorId") UUID supervisorId);

    void deletePrimaryDepartment(@Param("userId") UUID userId);

    UUID getDepartmentIdByUserId(@Param("userId") UUID userId);

    /** Phòng ban chính ({@code user_departments.is_primary = true}) của user. */
    UUID findPrimaryDepartmentIdByUserId(@Param("userId") UUID userId);

    List<AdminEmployeeCandidateResponse> findLeaderAssignableMembersInDepartment(
            @Param("departmentId") UUID departmentId);

    int updateSupervisorForUsersInDepartment(
            @Param("departmentId") UUID departmentId,
            @Param("supervisorId") UUID supervisorId,
            @Param("memberIds") List<UUID> memberIds);

    int countUsersInDepartment(
            @Param("departmentId") UUID departmentId,
            @Param("userId") UUID userId);

    List<UUID> findMemberIdsSupervisedByLeader(
            @Param("leaderId") UUID leaderId,
            @Param("departmentId") UUID departmentId);

    /** Gỡ supervisor leader khỏi member trong phòng (trả về supervisor = PM của phòng). */
    int resetSupervisorForLeaderInDepartment(
            @Param("departmentId") UUID departmentId,
            @Param("leaderId") UUID leaderId);
}
