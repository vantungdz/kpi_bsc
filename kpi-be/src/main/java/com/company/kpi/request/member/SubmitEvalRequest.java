package com.company.kpi.request.member;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class SubmitEvalRequest {

    @NotNull
    private UUID assignmentId;

    @NotBlank
    private String evidence;

}
