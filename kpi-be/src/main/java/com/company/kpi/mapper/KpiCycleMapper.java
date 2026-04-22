package com.company.kpi.mapper;

import com.company.kpi.entity.KpiCycle;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.Optional;

@Mapper
public interface KpiCycleMapper {

    Optional<KpiCycle> findByYear(int year);

}
