<template>
  <a-modal
    :visible="visible"
    :title="$t('kpiReviewTitle')"
    @cancel="$emit('close')"
    @ok="submitReview"
    :confirm-loading="loading"
    :ok-button-props="{
      disabled: loading || !isCurrentUserCanReview || (isCurrentLevelReviewed && !isManagerCanComplete),
      style:
        (isCurrentUserCanReview && (!isCurrentLevelReviewed || isManagerCanComplete))
          ? ''
          : 'display:none',
    }"
    :cancel-button-props="{ disabled: loading }"
  >
    <div v-if="review">
      <div class="review-info-grid">
        <div><b>{{ $t('kpiName') }}:</b> {{ review.kpi?.name }}</div>
        <div><b>{{ $t('employee') }}:</b> {{ review.employee?.fullName }}</div>
        <div><b>{{ $t('cycle') }}:</b> {{ review.cycle }}</div>
        <div><b>{{ $t('target') }}:</b> {{ review.targetValue }}</div>
        <div><b>{{ $t('actualResult') }}:</b> {{ review.actualValue }}</div>
      </div>
      <div class="review-section">
        <div class="review-section-title">{{ $t('selfReview') }}</div>
        <div class="review-row">
          <span class="review-label">{{ $t('selfScore') }}:</span>
          <a-rate :value="review.selfScore" :count="5" allow-half disabled />
        </div>
        <div class="review-row">
          <span class="review-label">{{ $t('selfComment') }}:</span>
          <div class="review-comment">{{ review.selfComment || $t('noComment') }}</div>
        </div>
      </div>
      <div v-if="review.sectionScore !== undefined" class="review-section">
        <div class="review-section-title">{{ $t('sectionReview') }}</div>
        <div class="review-row">
          <span class="review-label">{{ $t('sectionScore') }}:</span>
          <a-rate :value="review.sectionScore" :count="5" allow-half disabled />
        </div>
        <div class="review-row">
          <span class="review-label">{{ $t('sectionComment') }}:</span>
          <div class="review-comment">{{ review.sectionComment || $t('noComment') }}</div>
        </div>
      </div>
      <div v-if="review.departmentScore !== undefined" class="review-section">
        <div class="review-section-title">{{ $t('departmentReview') }}</div>
        <div class="review-row">
          <span class="review-label">{{ $t('departmentScore') }}:</span>
          <a-rate :value="review.departmentScore" :count="5" allow-half disabled />
        </div>
        <div class="review-row">
          <span class="review-label">{{ $t('departmentComment') }}:</span>
          <div class="review-comment">{{ review.departmentComment || $t('noComment') }}</div>
        </div>
      </div>
      <div v-if="review.managerScore !== undefined" class="review-section">
        <div class="review-section-title">{{ $t('managerReview') }}</div>
        <div class="review-row">
          <span class="review-label">{{ $t('managerScore') }}:</span>
          <a-rate :value="review.managerScore" :count="5" allow-half disabled />
        </div>
        <div class="review-row">
          <span class="review-label">{{ $t('managerComment') }}:</span>
          <div class="review-comment">{{ review.managerComment || $t('noComment') }}</div>
        </div>
      </div>
      <div v-if="review.employeeFeedback && (review.status === 'MANAGER_REVIEWED' || review.status === 'COMPLETED')" class="review-section">
        <div class="review-section-title">{{ $t('employeeFeedback') }}</div>
        <div class="review-comment">{{ review.employeeFeedback }}</div>
      </div>
      <div v-if="isCurrentUserCanReview">
        <div v-if="isEmployeeCanFeedback" class="review-section">
          <div class="review-section-title">{{ $t('employeeFeedback') }}</div>
          <a-textarea
            v-model:value="form.employeeFeedback"
            :placeholder="$t('feedbackPlaceholder')"
            rows="3"
            :disabled="loading"
          />
        </div>
        <div v-else-if="isManagerCanComplete" class="review-section">
          <div style="margin-bottom: 12px; color: #52c41a; font-weight: 600;">
            <span>{{ $t('employeeFeedbackCompleted') }}</span>
          </div>
        </div>
        <div v-else class="review-section">
          <div class="review-section-title">{{ $t('yourReview') }}</div>
          <div style="margin: 12px 0">
            <a-rate v-model:value="form.score" :count="5" allow-half :disabled="loading || isCurrentLevelReviewed" />
          </div>
          <a-textarea
            v-model:value="form.managerComment"
            :placeholder="
              review.status === 'SELF_REVIEWED' ? $t('sectionComment') :
              review.status === 'SECTION_REVIEWED' ? $t('departmentComment') :
              review.status === 'DEPARTMENT_REVIEWED' ? $t('managerComment') :
              $t('comment')
            "
            rows="3"
            :disabled="loading || isCurrentLevelReviewed"
          />
        </div>
      </div>
      <div v-else-if="isCurrentLevelReviewed" style="color: #52c41a; margin-top: 8px; font-weight: 600;">
        <b>{{ $t('reviewed') }}</b>
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
const effectiveRole = computed(() => {
  const role = user.value?.role;
  if (!role) return null;
  if (typeof role === 'string') return role;
  if (typeof role === 'object' && role.name) return role.name;
  return null;
});

const isSection = computed(() => effectiveRole.value === "section");
const isDepartment = computed(() => effectiveRole.value === "department");
const isManager = computed(() => effectiveRole.value === "manager");
const isAdmin = computed(() => effectiveRole.value === "admin");
const isEmployee = computed(() => effectiveRole.value === "employee");

const isSectionCanReview = computed(() => {
  return (
    props.review && props.review.status === "SELF_REVIEWED" && (isSection.value || isAdmin.value)
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

console.log('user:', user.value);
console.log('userRole:', effectiveRole.value);
console.log('status:', props.review?.status);
console.log('isSectionCanReview:', isSectionCanReview.value);
console.log('isDepartmentCanReview:', isDepartmentCanReview.value);
console.log('isManagerCanReview:', isManagerCanReview.value);
console.log('isCurrentUserCanReview:', isCurrentUserCanReview.value);
console.log('isCurrentLevelReviewed:', isCurrentLevelReviewed.value);
</script>

<style scoped>
.review-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
  margin-bottom: 18px;
  font-size: 15px;
}
@media (max-width: 600px) {
  .review-info-grid {
    grid-template-columns: 1fr;
    gap: 6px 0;
    font-size: 14px;
  }
}
.review-section {
  background: #f9fafb;
  border-radius: 12px;
  padding: 14px 18px 10px 18px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.04);
  margin-bottom: 12px;
}
.review-section-title {
  font-weight: 600;
  color: #409eff;
  margin-bottom: 8px;
  font-size: 16px;
}
.review-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 6px;
}
.review-label {
  min-width: 120px;
  color: #666;
  font-weight: 500;
  margin-right: 8px;
}
.review-comment {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 7px 12px;
  min-height: 32px;
  font-size: 14px;
  color: #222;
  flex: 1;
}
</style>
