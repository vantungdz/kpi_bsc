package com.company.kpi.request.gm;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateGmRatingScaleRequest {

    @NotNull
    private UUID cycleId;

    @Size(max = 100)
    private String name;

    /** Chu kỳ nguồn — sao chép toàn bộ mức điểm (tùy chọn). */
    private UUID copyFromCycleId;
}
