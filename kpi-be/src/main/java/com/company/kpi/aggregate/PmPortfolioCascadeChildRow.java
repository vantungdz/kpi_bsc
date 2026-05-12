package com.company.kpi.aggregate;

import com.company.kpi.entity.JobTitle;
import com.company.kpi.entity.KpiAssignment;
import com.company.kpi.entity.User;
import lombok.Data;

/** Một dòng con trong portfolio PM (JOIN {@code child_ka} × user × job title). */
@Data
public class PmPortfolioCascadeChildRow {

    private KpiAssignment childAssignment;
    /** PM feedback active trên assignment con — cột {@code child_feedback_note}. */
    private String childFeedbackNote;
    private String childFeedbackTargetRoleCode;
    private User childUser;
    private JobTitle childJobTitle;
}
