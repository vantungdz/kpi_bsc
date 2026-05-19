package com.company.kpi.mapper;

import com.company.kpi.response.gm.GmRatingScaleLevelResponse;
import com.company.kpi.response.gm.GmRatingScaleSummaryResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Mapper
public interface PerformanceRatingScaleMapper {

    List<GmRatingScaleSummaryResponse> listCycleSummaries();

    GmRatingScaleSummaryResponse findCycleSummaryByYear(@Param("year") int year);

    GmRatingScaleSummaryResponse findCycleSummaryByCycleId(@Param("cycleId") UUID cycleId);

    List<GmRatingScaleLevelResponse> listLevelsByCycleId(@Param("cycleId") UUID cycleId);

    List<GmRatingScaleLevelResponse> listLevelsByYear(@Param("year") int year);

    int countLevelsByCycleId(@Param("cycleId") UUID cycleId);

    Integer findStatusCodeByCycleId(@Param("cycleId") UUID cycleId);

    void insertLevel(
            @Param("id") UUID id,
            @Param("cycleId") UUID cycleId,
            @Param("sortOrder") int sortOrder,
            @Param("levelCode") String levelCode,
            @Param("label") String label,
            @Param("minScore") BigDecimal minScore,
            @Param("maxScore") BigDecimal maxScore,
            @Param("pitch") BigDecimal pitch,
            @Param("colorHex") String colorHex,
            @Param("topTier") boolean topTier,
            @Param("actorId") UUID actorId);

    void updateLevel(
            @Param("id") UUID id,
            @Param("sortOrder") int sortOrder,
            @Param("levelCode") String levelCode,
            @Param("label") String label,
            @Param("minScore") BigDecimal minScore,
            @Param("maxScore") BigDecimal maxScore,
            @Param("pitch") BigDecimal pitch,
            @Param("colorHex") String colorHex,
            @Param("topTier") boolean topTier,
            @Param("actorId") UUID actorId);

    int softDeleteLevel(@Param("id") UUID id, @Param("actorId") UUID actorId);
}
