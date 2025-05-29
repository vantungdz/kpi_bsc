<template>
  <a-modal
    :visible="visible"
    :title="$t('kpiReviewTitle')"
    @cancel="$emit('close')"
    @ok="submitReview"
    :confirm-loading="loading"
    :ok-button-props="{
      disabled:
        loading ||
        !isCurrentUserCanReview ||
        (isCurrentLevelReviewed && !isManagerCanComplete),
      style:
        isCurrentUserCanReview &&
        (!isCurrentLevelReviewed || isManagerCanComplete)
          ? ''
          : 'display:none',
    }"
    :cancel-button-props="{ disabled: loading }"
    width="80%"
    wrap-class-name="kpi-review-modal"
    body-style="padding: 0; background: #f4f7fb; border-radius: 14px;"
  >
    <div v-if="review" class="kpi-review-content compact">
      <!-- Steps: Quy trình đánh giá KPI -->
      <a-steps
        :current="currentStep"
        class="kpi-steps"
        direction="horizontal"
      >
        <a-step :title="$t('selfReview')">
          <template #icon><user-outlined /></template>
        </a-step>
        <a-step :title="$t('sectionReview')">
          <template #icon><team-outlined /></template>
        </a-step>
        <a-step :title="$t('departmentReview')">
          <template #icon><apartment-outlined /></template>
        </a-step>
        <a-step :title="$t('managerReview')">
          <template #icon><solution-outlined /></template>
        </a-step>
        <a-step :title="$t('employeeFeedback')">
          <template #icon><message-outlined /></template>
        </a-step>
        <a-step :title="$t('completed')">
          <template #icon><smile-outlined /></template>
        </a-step>
      </a-steps>
      <div class="review-info-grid pro">
        <div>
          <span class="info-label">{{ $t("kpiName") }}:</span>
          <span class="info-value">{{ review.kpi.name }}</span>
        </div>
        <div>
          <span class="info-label">{{ $t("employee") }}:</span>
          <span class="info-value">{{ review.employee?.first_name }} {{ review.employee?.last_name }}</span>
        </div>
        <div>
          <span class="info-label">{{ $t("target") }}:</span>
          <span class="info-value">{{ Number(review.targetValue).toLocaleString()}} {{ review.kpi.unit }}</span>
        </div>
        <div>
          <span class="info-label">{{ $t("actualResult") }}:</span>
          <span class="info-value">{{ Number(review.actualValue).toLocaleString() }} {{ review.kpi.unit }}</span>
        </div>
      </div>
      <div class="review-section pro">
        <div class="review-section-title self">{{ $t("selfReview") }}</div>
        <div class="review-row">
          <span class="review-label">{{ $t("selfScore") }}:</span>
          <a-rate :value="review.selfScore" :count="5" allow-half disabled />
        </div>
        <div class="review-row">
          <span class="review-label">{{ $t("selfComment") }}:</span>
          <div class="review-comment">
            {{ review.selfComment || $t("noComment") }}
          </div>
        </div>
      </div>
      <div v-if="review.sectionScore !== undefined" class="review-section pro">
        <div class="review-section-title section">{{ $t("sectionReview") }}</div>
        <div class="review-row">
          <span class="review-label">{{ $t("sectionScore") }}:</span>
          <a-rate :value="review.sectionScore" :count="5" allow-half disabled />
        </div>
        <div class="review-row">
          <span class="review-label">{{ $t("sectionComment") }}:</span>
          <div class="review-comment">
            {{ review.sectionComment || $t("noComment") }}
          </div>
        </div>
      </div>
      <div v-if="review.departmentScore !== undefined" class="review-section pro">
        <div class="review-section-title department">{{ $t("departmentReview") }}</div>
        <div class="review-row">
          <span class="review-label">{{ $t("departmentScore") }}:</span>
          <a-rate :value="review.departmentScore" :count="5" allow-half disabled />
        </div>
        <div class="review-row">
          <span class="review-label">{{ $t("departmentComment") }}:</span>
          <div class="review-comment">
            {{ review.departmentComment || $t("noComment") }}
          </div>
        </div>
      </div>
      <div v-if="review.managerScore !== undefined" class="review-section pro">
        <div class="review-section-title manager">{{ $t("managerReview") }}</div>
        <div class="review-row">
          <span class="review-label">{{ $t("managerScore") }}:</span>
          <a-rate :value="review.managerScore" :count="5" allow-half disabled />
        </div>
        <div class="review-row">
          <span class="review-label">{{ $t("managerComment") }}:</span>
          <div class="review-comment">
            {{ review.managerComment || $t("noComment") }}
          </div>
        </div>
      </div>
      <div
        v-if="review.employeeFeedback && (review.status === 'MANAGER_REVIEWED' || review.status === 'COMPLETED')"
        class="review-section pro"
      >
        <div class="review-section-title feedback">{{ $t("employeeFeedback") }}</div>
        <div class="review-comment">{{ review.employeeFeedback }}</div>
      </div>
      <div v-if="isCurrentUserCanReview">
        <div v-if="isEmployeeCanFeedback" class="review-section pro">
          <div class="review-section-title feedback">{{ $t("employeeFeedback") }}</div>
          <a-textarea
            v-model:value="form.employeeFeedback"
            :placeholder="$t('feedbackPlaceholder')"
            rows="3"
            :disabled="loading"
          />
        </div>
        <div v-else-if="isManagerCanComplete" class="review-section pro">
          <div class="review-section-title completed" style="color: #52c41a;">
            <span>{{ $t("employeeFeedbackCompleted") }}</span>
          </div>
        </div>
        <div v-else class="review-section pro">
          <div class="review-section-title your-review">{{ $t("yourReview") }}</div>
          <div style="margin: 12px 0">
            <a-rate
              v-model:value="form.score"
              :count="5"
              allow-half
              :disabled="loading || isCurrentLevelReviewed"
            />
          </div>
          <a-textarea
            v-model:value="form.managerComment"
            :placeholder="
              review.status === 'SELF_REVIEWED'
                ? $t('sectionComment')
                : review.status === 'SECTION_REVIEWED'
                  ? $t('departmentComment')
                  : review.status === 'DEPARTMENT_REVIEWED'
                    ? $t('managerComment')
                    : $t('comment')
            "
            rows="3"
            :disabled="loading || isCurrentLevelReviewed"
          />
        </div>
      </div>
      <div
        v-else-if="isCurrentLevelReviewed"
        class="review-section pro reviewed-msg"
      >
        <b>{{ $t("reviewed") }}</b>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import {
  submitSectionReview,
  submitDepartmentReview,
  submitManagerReview,
  updateKpiReview,
  submitEmployeeFeedback,
  completeReview,
} from "@/core/services/kpiReviewApi";
import { useStore } from "vuex";
import { UserOutlined, TeamOutlined, ApartmentOutlined, SolutionOutlined, MessageOutlined, SmileOutlined } from '@ant-design/icons-vue';

const props = defineProps({
  review: Object,
  visible: Boolean,
});
const emit = defineEmits(["close", "saved"]);
const form = ref({
  score: null,
  managerComment: "",
  actionPlan: "",
});
const loading = ref(false);
const store = useStore();

// Lấy user từ store giống UserProfile
const user = computed(() => store.getters["auth/user"]);

// Chuẩn hóa lấy mảng roles (string)
const userRoles = computed(() => {
  if (!user.value) return [];
  if (Array.isArray(user.value.roles)) {
    return user.value.roles
      .map((r) => (typeof r === "string" ? r : r?.name))
      .filter(Boolean);
  }
  if (user.value.role) {
    if (typeof user.value.role === "string") return [user.value.role];
    if (typeof user.value.role === "object" && user.value.role?.name)
      return [user.value.role.name];
  }
  return [];
});

const isSection = computed(() => userRoles.value.includes("section"));
const isDepartment = computed(() => userRoles.value.includes("department"));
const isManager = computed(() => userRoles.value.includes("manager"));
const isAdmin = computed(() => userRoles.value.includes("admin"));
const isEmployee = computed(() => userRoles.value.includes("employee"));

const isSectionCanReview = computed(() => {
  return (
    props.review &&
    props.review.status === "SELF_REVIEWED" &&
    (isSection.value || isAdmin.value)
  );
});

const isDepartmentCanReview = computed(() => {
  return (
    props.review &&
    props.review.status === "SECTION_REVIEWED" &&
    (isDepartment.value || isAdmin.value)
  );
});

const isManagerCanReview = computed(() => {
  return (
    props.review &&
    props.review.status === "DEPARTMENT_REVIEWED" &&
    (isManager.value || isAdmin.value)
  );
});

const isEmployeeCanFeedback = computed(() => {
  return (
    props.review &&
    props.review.status === "EMPLOYEE_FEEDBACK" &&
    isEmployee.value &&
    props.review.employee?.id === user.value?.id
  );
});

const isManagerCanComplete = computed(() => {
  return (
    props.review &&
    props.review.status === "MANAGER_REVIEWED" &&
    (isManager.value || isAdmin.value)
  );
});

const isCurrentUserCanReview = computed(
  () =>
    isSectionCanReview.value ||
    isDepartmentCanReview.value ||
    isManagerCanReview.value ||
    isEmployeeCanFeedback.value ||
    isManagerCanComplete.value
);

const isCurrentLevelReviewed = computed(() => {
  if (isSection.value) {
    return (
      props.review &&
      (props.review.sectionScore != null ||
        (props.review.sectionComment && props.review.sectionComment.length > 0))
    );
  }
  if (isDepartment.value) {
    return (
      props.review &&
      (props.review.departmentScore != null ||
        (props.review.departmentComment &&
          props.review.departmentComment.length > 0))
    );
  }
  if (isManager.value) {
    return (
      props.review &&
      (props.review.managerScore != null ||
        (props.review.managerComment && props.review.managerComment.length > 0))
    );
  }
  return false;
});

watch(
  () => props.review,
  (val) => {
    if (val) {
      form.value = {
        score: val.managerScore || val.score || null,
        managerComment: val.managerComment || "",
        actionPlan: val.actionPlan || "",
      };
    }
  },
  { immediate: true }
);

const submitReview = async () => {
  loading.value = true;
  try {
    if (isSectionCanReview.value) {
      await submitSectionReview(
        props.review.id,
        form.value.score,
        form.value.managerComment
      );
    } else if (isDepartmentCanReview.value) {
      await submitDepartmentReview(
        props.review.id,
        form.value.score,
        form.value.managerComment
      );
    } else if (isManagerCanReview.value) {
      await submitManagerReview(
        props.review.id,
        form.value.score,
        form.value.managerComment
      );
    } else if (isEmployeeCanFeedback.value) {
      await submitEmployeeFeedback(
        props.review.id,
        form.value.employeeFeedback
      );
    } else if (isManagerCanComplete.value) {
      await completeReview(props.review.id);
    } else {
      await updateKpiReview(props.review.id, form.value);
    }
    emit("saved");
  } finally {
    loading.value = false;
  }
};

// Steps: xác định bước hiện tại dựa vào review.status
const statusStepMap = {
  PENDING: 0,
  SELF_REVIEWED: 1,
  SECTION_REVIEWED: 2,
  DEPARTMENT_REVIEWED: 3,
  MANAGER_REVIEWED: 4,
  EMPLOYEE_FEEDBACK: 4, // EMPLOYEE_FEEDBACK là bước 5, nhưng MANAGER_REVIEWED cũng có thể là 4
  COMPLETED: 5,
};
const currentStep = computed(() => {
  if (!props.review || !props.review.status) return 0;
  return statusStepMap[props.review.status] ?? 0;
});
</script>

<style scoped>
.kpi-review-modal .ant-modal-content {
  border-radius: 14px;
  background: #f4f7fb;
  box-shadow: 0 4px 18px #b3c6e022;
  max-width: 900px;
  min-width: 320px;
}
.kpi-review-content.compact {
  padding: 24px 18px 12px 18px;
  background: #f4f7fb;
  border-radius: 14px;
}
.kpi-steps {
  margin-bottom: 18px;
  background: #eaf2fb;
  border-radius: 10px;
  padding: 12px 10px 4px 10px;
  box-shadow: 0 2px 8px #e6f7ff33;
}
.review-info-grid.pro {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 18px;
  margin-bottom: 16px;
  font-size: 15px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px #e6f7ff22;
  padding: 12px 14px 6px 14px;
}
.info-label {
  color: #888;
  font-weight: 500;
  margin-right: 4px;
}
.info-value {
  color: #1a237e;
  font-weight: 600;
}
@media (max-width: 900px) {
  .kpi-review-content.compact {
    padding: 8px 2px 4px 2px;
  }
  .review-info-grid.pro {
    grid-template-columns: 1fr;
    gap: 6px 0;
    font-size: 13px;
    padding: 6px 4px 4px 4px;
  }
}
.review-section.pro {
  background: #fff;
  border-radius: 8px;
  padding: 12px 14px 8px 14px;
  box-shadow: 0 1px 4px #e6f7ff22;
  margin-bottom: 10px;
  border-left: 4px solid #eaf2fb;
  transition: border-color 0.2s;
}
.review-section-title {
  font-weight: 700;
  margin-bottom: 6px;
  font-size: 15px;
  letter-spacing: 0.2px;
}
.review-section-title.self { color: #409eff; border-left: 3px solid #409eff; padding-left: 4px; }
.review-section-title.section { color: #13c2c2; border-left: 3px solid #13c2c2; padding-left: 4px; }
.review-section-title.department { color: #1890ff; border-left: 3px solid #1890ff; padding-left: 4px; }
.review-section-title.manager { color: #722ed1; border-left: 3px solid #722ed1; padding-left: 4px; }
.review-section-title.feedback { color: #faad14; border-left: 3px solid #faad14; padding-left: 4px; }
.review-section-title.completed { color: #52c41a; border-left: 3px solid #52c41a; padding-left: 4px; }
.review-section-title.your-review { color: #1a237e; border-left: 3px solid #1a237e; padding-left: 4px; }
.review-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 6px;
}
.review-label {
  min-width: 100px;
  color: #666;
  font-weight: 500;
  margin-right: 6px;
}
.review-comment {
  background: #f7faff;
  border: 1px solid #eaf2fb;
  border-radius: 6px;
  padding: 6px 10px;
  min-height: 28px;
  font-size: 13px;
  color: #222;
  flex: 1;
  box-shadow: 0 1px 2px #e6f7ff11;
}
.reviewed-msg {
  color: #52c41a;
  font-size: 14px;
  text-align: center;
  background: #f6fff6;
  border-left: 4px solid #52c41a;
}
:deep(.ant-steps-horizontal .ant-steps-item .ant-steps-item-title) {
  white-space: normal;
  max-width: 90px;
  text-align: center;
  font-weight: 600;
  color: #1a237e;
  font-size: 13px;
}
:deep(.ant-steps-item-process .ant-steps-item-icon) {
  background: linear-gradient(90deg, #1890ff 0%, #40a9ff 100%);
  box-shadow: 0 2px 8px #1890ff22;
  border: none;
}
:deep(.ant-steps-item-finish .ant-steps-item-icon) {
  background: #52c41a;
  color: #fff;
  border: none;
}
:deep(.ant-steps-item-wait .ant-steps-item-icon) {
  background: #e6f7ff;
  color: #bfbfbf;
  border: none;
}
:deep(.ant-steps-item .ant-steps-item-icon) {
  box-shadow: 0 1px 2px #e6f7ff22;
}
:deep(.ant-steps-item .ant-steps-item-content) {
  min-width: 80px;
}
:deep(.ant-steps-horizontal) {
  flex-wrap: wrap;
  row-gap: 6px;
  justify-content: center;
}
</style>
