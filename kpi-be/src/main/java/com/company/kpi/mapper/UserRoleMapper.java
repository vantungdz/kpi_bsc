package com.company.kpi.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.UUID;

@Mapper
public interface UserRoleMapper {
    void assignMemberRole(@Param("userId") UUID userId);

    void deleteAllRolesForUser(@Param("userId") UUID userId);

    void assignRoleByCode(@Param("userId") UUID userId, @Param("roleCode") String roleCode);
}
