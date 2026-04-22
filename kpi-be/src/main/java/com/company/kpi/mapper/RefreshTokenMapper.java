package com.company.kpi.mapper;

import com.company.kpi.entity.RefreshToken;
import org.apache.ibatis.annotations.*;

import java.util.UUID;

@Mapper
public interface RefreshTokenMapper {

    @Insert("INSERT INTO refresh_tokens(user_id, token, expires_at) " +
            "VALUES(#{userId}, #{token}, #{expiresAt})")
    void insert(RefreshToken token);

    @Select("SELECT * FROM refresh_tokens WHERE token = #{token} AND revoked = false")
    RefreshToken findByToken(String token);

    @Update("UPDATE refresh_tokens SET revoked = true WHERE token = #{token}")
    void revoke(String token);

    @Delete("DELETE FROM refresh_tokens WHERE user_id = #{userId} AND revoked = true")
    void deleteRevokedByUserId(UUID userId);
}
