package com.company.kpi.mapper;

import com.company.kpi.response.leader.LeaderMemberInfoDTO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface UserDepartmentMapper {

    List<LeaderMemberInfoDTO> findLeaderMemberListInfo(UUID leaderId);

    // ── Thêm từ AdminMapper ───────────────────────────────────────────────────
    void insertUserDepartment(@Param("userId") UUID userId,
                              @Param("departmentId") UUID departmentId,
                              @Param("supervisorId") UUID supervisorId);

    void deletePrimaryDepartment(@Param("userId") UUID userId);

    UUID getDepartmentIdByUserId(@Param("userId") UUID userId);
}
