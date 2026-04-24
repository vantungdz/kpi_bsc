package com.company.kpi.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.UUID;

@Mapper
public interface UserRoleMapper {
    void assignMemberRole(@Param("userId") UUID userId);
}
