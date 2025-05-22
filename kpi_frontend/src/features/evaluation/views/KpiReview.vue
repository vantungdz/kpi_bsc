<template>
  <div class="kpi-review-page">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">Dashboard</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>Review KPI</a-breadcrumb-item>
    </a-breadcrumb>
    <a-card :title="pageTitle" :bordered="false">
      <a-spin :spinning="isLoadingReview">
        <div v-if="reviewError">
          <a-alert type="error" :message="reviewError" show-icon />
        </div>
        <div v-else>
          <div v-if="kpiReviews.length === 0">
            <a-empty description="Không có KPI nào để review" />
          </div>
          <a-table
            v-else
            :columns="columns"
            :data-source="kpiReviews"
            row-key="id"
            bordered
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'managerScore'">
                <a-input-number
                  v-model:value="record.managerScore"
                  :min="1"
                  :max="5"
                />
              </template>
              <template v-else-if="column.key === 'managerComment'">
                <a-textarea v-model:value="record.managerComment" rows="2" />
              </template>
              <template v-else>
                {{ record[column.dataIndex] }}
              </template>
            </template>
          </a-table>
          <a-button
            v-if="canReview"
            type="primary"
            @click="submitReview"
            :loading="isLoadingReview"
            style="margin-top: 16px"
            >Lưu đánh giá</a-button
          >
        </div>
      </a-spin>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import { hasPermission } from "@/core/utils/permission";
import {
  Breadcrumb as ABreadcrumb,
  BreadcrumbItem as ABreadcrumbItem,
  Card as ACard,
  Table as ATable,
  InputNumber as AInputNumber,
  Textarea as ATextarea,
  Button as AButton,
  Spin as ASpin,
  Alert as AAlert,
  Empty as AEmpty,
} from "ant-design-vue";

const store = useStore();
const route = useRoute();
const targetId = Number(route.query.targetId);
const targetType = route.query.targetType || "employee";
const cycleId = route.query.cycleId || "";

const isLoadingReview = computed(
  () => store.getters["kpiEvaluations/isLoadingReview"]
);
const reviewError = computed(
  () => store.getters["kpiEvaluations/getReviewError"]
);
const kpiReviews = computed(
  () => store.getters["kpiEvaluations/getKpiReviews"]
);
const overallReview = computed(
  () => store.getters["kpiEvaluations/getOverallReview"]
);

const user = computed(() => store.getters["auth/user"]);

const canReview = computed(() =>
  hasPermission(user.value, "approve", "kpi_review")
);

const pageTitle = computed(() => `Review KPI - Chu kỳ: ${cycleId}`);

const columns = [
  { title: "Tên KPI", dataIndex: "assignment.kpiName", key: "kpiName" },
  {
    title: "Mục tiêu",
    dataIndex: "assignment.targetValue",
    key: "targetValue",
  },
  { title: "Kết quả", dataIndex: "assignment.actualValue", key: "actualValue" },
  { title: "Điểm", key: "managerScore" },
  { title: "Nhận xét", key: "managerComment" },
];

const fetchData = async () => {
  await store.dispatch("kpiEvaluations/fetchKpiReviews", {
    targetId,
    targetType,
    cycleId,
  });
  await store.dispatch("kpiEvaluations/fetchOverallReview", {
    targetId,
    targetType,
    cycleId,
  });
};

const submitReview = async () => {
  const payload = {
    targetId,
    targetType,
    cycleId,
    kpiReviews: kpiReviews.value.map((item) => ({
      assignmentId: item.assignmentId,
      managerScore: item.managerScore,
      managerComment: item.managerComment,
    })),
    overallComment: overallReview.value?.overallComment || "",
  };
  await store.dispatch("kpiEvaluations/submitKpiReview", payload);
  await fetchData();
};

onMounted(fetchData);
</script>

<style scoped>
.kpi-review-page {
  padding: 24px;
}
</style>
