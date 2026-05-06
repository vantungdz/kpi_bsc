package com.company.kpi.request.member;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SubmitFeedbackRequest {

    @NotBlank
    private String feedbackComment;
}

