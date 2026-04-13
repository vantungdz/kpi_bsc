export function getAssignmentWorkflowSummary(status, t) {
  switch (status) {
    case "DRAFT":
      return {
        bucket: "action",
        tagColor: "default",
        currentStep: t("workflow.assignment.draft.step"),
        nextAction: t("workflow.assignment.draft.next"),
        actionLabel: t("workflow.actions.continue"),
      };
    case "REJECTED_BY_SECTION":
      return {
        bucket: "action",
        tagColor: "red",
        currentStep: t("workflow.assignment.rejectedSection.step"),
        nextAction: t("workflow.assignment.rejectedSection.next"),
        actionLabel: t("workflow.actions.resubmit"),
      };
    case "REJECTED_BY_DEPT":
      return {
        bucket: "action",
        tagColor: "red",
        currentStep: t("workflow.assignment.rejectedDepartment.step"),
        nextAction: t("workflow.assignment.rejectedDepartment.next"),
        actionLabel: t("workflow.actions.resubmit"),
      };
    case "REJECTED_BY_MANAGER":
      return {
        bucket: "action",
        tagColor: "red",
        currentStep: t("workflow.assignment.rejectedManager.step"),
        nextAction: t("workflow.assignment.rejectedManager.next"),
        actionLabel: t("workflow.actions.resubmit"),
      };
    case "SUBMITTED":
    case "PENDING_SECTION_APPROVAL":
      return {
        bucket: "waiting",
        tagColor: "blue",
        currentStep: t("workflow.assignment.pendingSection.step"),
        nextAction: t("workflow.assignment.pendingSection.next"),
        actionLabel: t("workflow.actions.viewWorkflow"),
      };
    case "PENDING_DEPT_APPROVAL":
      return {
        bucket: "waiting",
        tagColor: "cyan",
        currentStep: t("workflow.assignment.pendingDepartment.step"),
        nextAction: t("workflow.assignment.pendingDepartment.next"),
        actionLabel: t("workflow.actions.viewWorkflow"),
      };
    case "PENDING_MANAGER_APPROVAL":
      return {
        bucket: "waiting",
        tagColor: "purple",
        currentStep: t("workflow.assignment.pendingManager.step"),
        nextAction: t("workflow.assignment.pendingManager.next"),
        actionLabel: t("workflow.actions.viewWorkflow"),
      };
    case "APPROVED":
      return {
        bucket: "completed",
        tagColor: "green",
        currentStep: t("workflow.assignment.approved.step"),
        nextAction: t("workflow.assignment.approved.next"),
        actionLabel: t("workflow.actions.viewDetail"),
      };
    case "NOT_SUBMIT":
    default:
      return {
        bucket: "action",
        tagColor: "gold",
        currentStep: t("workflow.assignment.notSubmit.step"),
        nextAction: t("workflow.assignment.notSubmit.next"),
        actionLabel: t("workflow.actions.update"),
      };
  }
}

export function getPendingApprovalStep(status, t) {
  switch (status) {
    case "PENDING_MANAGER_APPROVAL":
      return t("workflow.approval.pendingManager");
    case "PENDING_DEPT_APPROVAL":
      return t("workflow.approval.pendingDepartment");
    case "PENDING_SECTION_APPROVAL":
    case "SUBMITTED":
    default:
      return t("workflow.approval.pendingSection");
  }
}

export function getReviewWorkflowSummary(status, t) {
  switch (status) {
    case "PENDING":
      return {
        bucket: "action",
        tagColor: "gold",
        currentStep: t("workflow.review.pending.step"),
        nextAction: t("workflow.review.pending.next"),
        actionLabel: t("workflow.actions.selfReview"),
      };
    case "SELF_REVIEWED":
      return {
        bucket: "waiting",
        tagColor: "blue",
        currentStep: t("workflow.review.selfReviewed.step"),
        nextAction: t("workflow.review.selfReviewed.next"),
        actionLabel: t("workflow.actions.viewReview"),
      };
    case "SECTION_REVIEWED":
      return {
        bucket: "waiting",
        tagColor: "cyan",
        currentStep: t("workflow.review.sectionReviewed.step"),
        nextAction: t("workflow.review.sectionReviewed.next"),
        actionLabel: t("workflow.actions.viewReview"),
      };
    case "DEPARTMENT_REVIEWED":
    case "PENDING_MANAGER_APPROVAL":
      return {
        bucket: "waiting",
        tagColor: "purple",
        currentStep: t("workflow.review.pendingManager.step"),
        nextAction: t("workflow.review.pendingManager.next"),
        actionLabel: t("workflow.actions.viewReview"),
      };
    case "MANAGER_REVIEWED":
      return {
        bucket: "completed",
        tagColor: "green",
        currentStep: t("workflow.review.completed.step"),
        nextAction: t("workflow.review.completed.next"),
        actionLabel: t("workflow.actions.viewResult"),
      };
    case "EMPLOYEE_FEEDBACK":
      return {
        bucket: "action",
        tagColor: "orange",
        currentStep: t("workflow.review.employeeFeedback.step"),
        nextAction: t("workflow.review.employeeFeedback.next"),
        actionLabel: t("workflow.actions.giveFeedback"),
      };
    case "SECTION_REJECTED":
      return {
        bucket: "action",
        tagColor: "red",
        currentStep: t("workflow.review.sectionRejected.step"),
        nextAction: t("workflow.review.sectionRejected.next"),
        actionLabel: t("workflow.actions.reReview"),
      };
    case "DEPARTMENT_REJECTED":
      return {
        bucket: "action",
        tagColor: "red",
        currentStep: t("workflow.review.departmentRejected.step"),
        nextAction: t("workflow.review.departmentRejected.next"),
        actionLabel: t("workflow.actions.reReview"),
      };
    case "MANAGER_REJECTED":
      return {
        bucket: "action",
        tagColor: "red",
        currentStep: t("workflow.review.managerRejected.step"),
        nextAction: t("workflow.review.managerRejected.next"),
        actionLabel: t("workflow.actions.reReview"),
      };
    case "COMPLETED":
      return {
        bucket: "completed",
        tagColor: "green",
        currentStep: t("workflow.review.completed.step"),
        nextAction: t("workflow.review.completed.next"),
        actionLabel: t("workflow.actions.viewResult"),
      };
    default:
      return {
        bucket: "waiting",
        tagColor: "default",
        currentStep: status || t("workflow.generic.processing"),
        nextAction: t("workflow.generic.openForDetails"),
        actionLabel: t("workflow.actions.viewReview"),
      };
  }
}

export function getReviewApprovalWorkflowSummary(status, t) {
  switch (status) {
    case "SELF_REVIEWED":
      return {
        bucket: "action",
        tagColor: "blue",
        currentStep: t("workflow.reviewApproval.pendingSection.step"),
        nextAction: t("workflow.reviewApproval.pendingSection.next"),
        actionLabel: t("workflow.actions.openReview"),
      };
    case "SECTION_REVIEWED":
      return {
        bucket: "action",
        tagColor: "cyan",
        currentStep: t("workflow.reviewApproval.pendingDepartment.step"),
        nextAction: t("workflow.reviewApproval.pendingDepartment.next"),
        actionLabel: t("workflow.actions.openReview"),
      };
    case "DEPARTMENT_REVIEWED":
    case "PENDING_MANAGER_APPROVAL":
      return {
        bucket: "action",
        tagColor: "purple",
        currentStep: t("workflow.reviewApproval.pendingManager.step"),
        nextAction: t("workflow.reviewApproval.pendingManager.next"),
        actionLabel: t("workflow.actions.openReview"),
      };
    case "PENDING":
      return {
        bucket: "waiting",
        tagColor: "gold",
        currentStep: t("workflow.reviewApproval.waitingSelfReview.step"),
        nextAction: t("workflow.reviewApproval.waitingSelfReview.next"),
        actionLabel: t("workflow.actions.viewReview"),
      };
    case "MANAGER_REVIEWED":
      return {
        bucket: "completed",
        tagColor: "green",
        currentStep: t("workflow.reviewApproval.completed.step"),
        nextAction: t("workflow.reviewApproval.completed.next"),
        actionLabel: t("workflow.actions.viewResult"),
      };
    case "SECTION_REJECTED":
      return {
        bucket: "waiting",
        tagColor: "red",
        currentStep: t("workflow.reviewApproval.sectionRejected.step"),
        nextAction: t("workflow.reviewApproval.sectionRejected.next"),
        actionLabel: t("workflow.actions.viewReview"),
      };
    case "DEPARTMENT_REJECTED":
      return {
        bucket: "waiting",
        tagColor: "red",
        currentStep: t("workflow.reviewApproval.departmentRejected.step"),
        nextAction: t("workflow.reviewApproval.departmentRejected.next"),
        actionLabel: t("workflow.actions.viewReview"),
      };
    case "MANAGER_REJECTED":
      return {
        bucket: "waiting",
        tagColor: "red",
        currentStep: t("workflow.reviewApproval.managerRejected.step"),
        nextAction: t("workflow.reviewApproval.managerRejected.next"),
        actionLabel: t("workflow.actions.viewReview"),
      };
    case "EMPLOYEE_FEEDBACK":
    case "COMPLETED":
      return {
        bucket: "completed",
        tagColor: "green",
        currentStep: t("workflow.reviewApproval.completed.step"),
        nextAction: t("workflow.reviewApproval.completed.next"),
        actionLabel: t("workflow.actions.viewResult"),
      };
    default:
      return {
        bucket: "waiting",
        tagColor: "default",
        currentStep: status || t("workflow.generic.processing"),
        nextAction: t("workflow.generic.openForDetails"),
        actionLabel: t("workflow.actions.viewReview"),
      };
  }
}

export function summarizeGroupedApprovals(group, t) {
  const values = Array.isArray(group?.kpiValues) ? group.kpiValues : [];
  if (!values.length) {
    return {
      currentStep: t("workflow.generic.processing"),
      nextAction: t("workflow.generic.openForDetails"),
    };
  }

  const steps = [...new Set(values.map((value) => getPendingApprovalStep(value.status, t)))];
  if (steps.length === 1) {
    return {
      currentStep: steps[0],
      nextAction: t("workflow.approval.openAndProcess", {
        count: group.totalKpis || values.length,
      }),
    };
  }

  return {
    currentStep: t("workflow.approval.multipleSteps", {
      count: group.totalKpis || values.length,
    }),
    nextAction: t("workflow.approval.openAndProcess", {
      count: group.totalKpis || values.length,
    }),
  };
}
