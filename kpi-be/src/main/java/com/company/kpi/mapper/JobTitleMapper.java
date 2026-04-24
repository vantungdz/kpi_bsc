package com.company.kpi.mapper;

import com.company.kpi.response.admin.AdminJobTitleResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface JobTitleMapper {
    /** Lấy danh sách chức danh */
    List<AdminJobTitleResponse> getJobTitles();

    /** Tìm job_title_id đầu tiên khớp rank code (ưu tiên DEV) */
    String findJobTitleIdByRankCode(@Param("rankCode") String rankCode);
}
