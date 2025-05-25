<template>
  <a-modal
    :visible="visible"
    title="Đánh giá KPI"
    @cancel="$emit('close')"
    @ok="submitReview"
    :confirm-loading="loading"
    :ok-button-props="{
      disabled: loading,
      style:
        isSectionCanReview || isDepartmentCanReview || isManagerCanReview
          ? ''
          : 'display:none',
    }"
    :cancel-button-props="{ disabled: loading }"
  >
    <div v-if="review">
      <div><b>KPI:</b> {{ review.kpi?.name }}</div>
      <div><b>Nhân viên:</b> {{ review.employee?.fullName }}</div>
      <div><b>Chu kỳ:</b> {{ review.cycle }}</div>
      <div><b>Mục tiêu:</b> {{ review.targetValue }}</div>
      <div><b>Kết quả thực tế:</b> {{ review.actualValue }}</div>
      <div style="margin: 12px 0 0 0">
        <b>Điểm tự đánh giá:</b>
        <a-rate :value="review.selfScore" :count="5" allow-half disabled />
      </div>
      <div style="margin: 4px 0 12px 0">
        <b>Nhận xét tự đánh giá:</b>
        <div
          style="
            background: #fafafa;
            border: 1px solid #eee;
            padding: 8px;
            min-height: 32px;
            border-radius: 4px;
          "
        >
          {{ review.selfComment || "Chưa có" }}
        </div>
      </div>
      <div v-if="review.sectionScore !== undefined">
        <b>Điểm section:</b>
        <a-rate :value="review.sectionScore" :count="5" allow-half disabled />
        <div>
          <b>Nhận xét section:</b> {{ review.sectionComment || "Chưa có" }}
        </div>
      </div>
      <div v-if="review.departmentScore !== undefined">
        <b>Điểm department:</b>
        <a-rate
          :value="review.departmentScore"
          :count="5"
          allow-half
          disabled
        />
        <div>
          <b>Nhận xét department:</b>
          {{ review.departmentComment || "Chưa có" }}
        </div>
      </div>
      <div v-if="review.managerScore !== undefined">
        <b>Điểm manager:</b>
        <a-rate :value="review.managerScore" :count="5" allow-half disabled />
        <div>
          <b>Nhận xét manager:</b> {{ review.managerComment || "Chưa có" }}
        </div>
      </div>
      <div v-if="isCurrentUserCanReview">
        <div style="margin: 12px 0">
          <a-rate
            v-model:value="form.score"
            :count="5"
            allow-half
            :disabled="loading"
          />
        </div>
        <a-textarea
          v-model:value="form.managerComment"
          placeholder="Nhận xét/Phản hồi"
          rows="3"
          style="margin-bottom: 12px"
          :disabled="loading"
        />
      </div>
      <div
        v-else-if="isCurrentLevelReviewed"
        style="color: #52c41a; margin-top: 8px"
      >
        <b>Đã đánh giá</b>
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
const user = computed(() => store.getters["employees/userList"][0]);
const effectiveRole = computed(() => user.value?.role?.name || null);

const isSection = computed(() => effectiveRole.value === "section");
const isDepartment = computed(() => effectiveRole.value === "department");
const isManager = computed(() => effectiveRole.value === "manager");

const isSectionCanReview = computed(() => {
  return (
    props.review && props.review.status === "SELF_REVIEWED" && isSection.value
  );
});

const isDepartmentCanReview = computed(() => {
  return (
    props.review &&
    props.review.status === "SECTION_REVIEWED" &&
    isDepartment.value
  );
});

const isManagerCanReview = computed(() => {
  return (
    props.review &&
    props.review.status === "DEPARTMENT_REVIEWED" &&
    isManager.value
  );
});

const isCurrentUserCanReview = computed(
  () =>
    isSectionCanReview.value ||
    isDepartmentCanReview.value ||
    isManagerCanReview.value
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
    } else {
      await updateKpiReview(props.review.id, form.value);
    }
    emit("saved");
  } finally {
    loading.value = false;
  }
};

console.log("userRole:", effectiveRole);
console.log("status:", props.review?.status);
console.log("isDepartmentCanReview:", isDepartmentCanReview.value);
console.log("isCurrentUserCanReview:", isCurrentUserCanReview.value);
</script>
