package com.company.kpi.request.pm;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class PmGmFeedbackRequest {

    @NotNull
    private Integer year;

    @NotNull
    private UUID assignmentId;

    @NotBlank
    @Size(max = 4000)
    private String feedbackNote;
}
