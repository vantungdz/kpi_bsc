package com.company.kpi.request.member;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SubmitMemberSheetRequest {

    @NotNull
    private Integer year;
}
