package com.company.kpi.mapper;

import com.company.kpi.response.reference.RankOptionResponse;
import com.company.kpi.response.admin.AdminRankResponse;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface RankMapper {

    List<RankOptionResponse> listActiveRanksOrderedByCode();

    // ── Thêm từ AdminMapper ───────────────────────────────────────────────────
    List<AdminRankResponse> getRanks();
}
