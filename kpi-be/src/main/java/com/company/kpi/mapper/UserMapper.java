package com.company.kpi.mapper;

import java.util.Optional;
import java.util.UUID;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import com.company.kpi.entity.User;

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
}
