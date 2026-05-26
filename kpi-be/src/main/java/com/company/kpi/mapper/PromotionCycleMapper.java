package com.company.kpi.mapper;

import com.company.kpi.entity.PromotionCycle;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Mapper
public interface PromotionCycleMapper {

    Optional<PromotionCycle> findById(@Param("id") UUID id);

    /** Latest promotion cycle for user (manual seed / copy fallback). */
    Optional<PromotionCycle> findLatestByUserId(@Param("userId") UUID userId);

    /**
     * Cycles whose {@code start_date} or {@code end_date} falls in {@code year}
     * (supports cross-year windows).
     */
    List<PromotionCycle> listByYear(@Param("year") int year);
}
