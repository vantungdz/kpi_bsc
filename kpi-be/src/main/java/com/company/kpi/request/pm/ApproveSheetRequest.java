package com.company.kpi.request.pm;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApproveSheetRequest {

    @NotNull
    private Integer year;
}
