package com.company.kpi.mapper;

import com.company.kpi.response.admin.AdminEmailTemplateResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface EmailTemplateMapper {
    List<AdminEmailTemplateResponse> getEmailTemplates();

    AdminEmailTemplateResponse getEmailTemplateById(@Param("id") UUID id);

    void insertEmailTemplate(@Param("id") UUID id,
                             @Param("name") String name,
                             @Param("subject") String subject,
                             @Param("body") String body,
                             @Param("status") String status,
                             @Param("sendMode") String sendMode,
                             @Param("templateGroup") String templateGroup,
                             @Param("createdBy") UUID createdBy);

    void updateEmailTemplate(@Param("id") UUID id,
                             @Param("name") String name,
                             @Param("subject") String subject,
                             @Param("body") String body,
                             @Param("status") String status,
                             @Param("sendMode") String sendMode,
                             @Param("templateGroup") String templateGroup,
                             @Param("updatedBy") UUID updatedBy);

    /** Xóa mềm mẫu email (deleted_at). */
    int softDeleteEmailTemplate(@Param("id") UUID id, @Param("updatedBy") UUID updatedBy);
}
