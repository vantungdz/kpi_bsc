<template>
  <div class="employee-kpi-score-list">
    <a-row style="margin-bottom: 20px">
      <a-col :span="8">
        <a-form-item :label="$t('selectCycle')">
          <a-select
            v-model:value="selectedCycle"
            :placeholder="$t('selectCyclePlaceholder')"
            @change="fetchScores"
            :loading="isLoadingCycles"
          >
            <a-select-option
              v-for="cycle in reviewCycles"
              :key="cycle.id"
              :value="cycle.id"
            >
              {{ cycle.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
    <a-table
      :columns="columns"
      :data-source="employeeScores"
      row-key="employeeId"
      :loading="isLoadingScores"
      @row-click="goToKpiReview"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'fullName'">
          {{ record.fullName }}
        </template>
        <template v-else-if="column.dataIndex === 'department'">
          {{ record.department || $t("noData") }}
        </template>
        <template v-else-if="column.dataIndex === 'reviewStatus'">
          <a-tag
            :color="reviewStatusColorMap[record.reviewStatus] || 'default'"
          >
            {{
              $t(
                `review_status_evaluation.${record.reviewStatus}` ||
                  "unknownStatus"
              )
            }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'totalWeightedScore'">
          <span
            v-if="
              record.reviewStatus === 'COMPLETED' &&
              record.totalWeightedScore !== null &&
              record.totalWeightedScore !== undefined
            "
            style="font-weight: bold; color: #1890ff"
          >
            {{ Number(record.totalWeightedScore).toFixed(2) }}
          </span>
          <span v-else>-</span>
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-button type="link" @click.stop="goToKpiReview(record)">
            {{ $t("viewDetails") }}
          </a-button>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Row as ARow,
  Col as ACol,
  FormItem as AFormItem,
  Select as ASelect,
  SelectOption as ASelectOption,
  Table as ATable,
  Tag,
  Button,
} from "ant-design-vue";

const { t: $t } = useI18n();
const store = useStore();
const router = useRouter();

const selectedCycle = ref(null);
const reviewCycles = computed(
  () => store.getters["kpiEvaluations/getReviewCycles"]
);
const isLoadingCycles = computed(
  () => store.getters["kpiEvaluations/isLoadingReviewCycles"]
);

const employeeScores = ref([]);
const isLoadingScores = ref(false);

const reviewStatusColorMap = {
  PENDING_REVIEW: "default",
  MANAGER_REVIEWED: "blue",
  EMPLOYEE_FEEDBACK_PENDING: "orange",
  EMPLOYEE_RESPONDED: "gold",
  COMPLETED: "green",
};

// Đảm bảo mọi logic kiểm tra role đều dùng user.role?.name nếu có

const columns = computed(() => [
  { title: $t("employeeFullName"), dataIndex: "fullName", key: "fullName" },
  { title: $t("departmentLabel"), dataIndex: "department", key: "department" },
  {
    title: $t("reviewStatus"),
    dataIndex: "reviewStatus",
    key: "reviewStatus",
    customRender: ({ record }) => {
      const color = reviewStatusColorMap[record.reviewStatus] || "default";
      return h(Tag, { color }, () =>
        $t(`reviewStatus.${record.reviewStatus}` || "unknownStatus")
      );
    },
  },
  {
    title: $t("totalWeightedScoreSupervisor"),
    dataIndex: "totalWeightedScore",
    key: "totalWeightedScore",
    customRender: ({ record }) => {
      if (
        record.reviewStatus === "COMPLETED" &&
        record.totalWeightedScore !== null &&
        record.totalWeightedScore !== undefined
      ) {
        return h(
          "span",
          { style: "font-weight: bold; color: #1890ff" },
          Number(record.totalWeightedScore).toFixed(2)
        );
      }
      return "-";
    },
  },
  {
    title: $t("actions"),
    key: "actions",
    customRender: ({ record }) =>
      h(
        Button,
        {
          type: "link",
          onClick: (e) => {
            e.stopPropagation();
            goToKpiReview(record);
          },
        },
        () => $t("viewDetails")
      ),
  },
]);

const fetchScores = async () => {
  if (!selectedCycle.value) return;
  isLoadingScores.value = true;
  try {
    const result = await store.dispatch(
      "kpiEvaluations/fetchEmployeeKpiScores",
      { cycleId: selectedCycle.value }
    );
    employeeScores.value = (result || []).map((emp) => ({
      employeeId: emp.employeeId,
      fullName: emp.fullName,
      department: emp.department,
      totalWeightedScore: emp.totalWeightedScore,
      reviewStatus: emp.reviewStatus,
    }));
  } catch (e) {
    employeeScores.value = [];
  } finally {
    isLoadingScores.value = false;
  }
};

const goToKpiReview = (record) => {
  if (!record || !selectedCycle.value) return;
  router.push({
    name: "KpiReview",
    query: {
      targetType: "employee",
      targetId: record.employeeId,
      cycleId: selectedCycle.value,
      fullName: record.fullName, // Truyền thêm tên nhân viên
    },
  });
};

onMounted(async () => {
  await store.dispatch("kpiEvaluations/fetchReviewCycles");
});
</script>

<i18n lang="json">
{
  "employeeFullName": "Họ và tên nhân viên",
  "departmentLabel": "Phòng ban",
  "reviewStatus": "Trạng thái đánh giá",
  "reviewStatus.PENDING_REVIEW": "Chờ đánh giá",
  "reviewStatus.MANAGER_REVIEWED": "Quản lý đã đánh giá",
  "reviewStatus.EMPLOYEE_FEEDBACK_PENDING": "Chờ phản hồi nhân viên",
  "reviewStatus.EMPLOYEE_RESPONDED": "Nhân viên đã phản hồi",
  "reviewStatus.COMPLETED": "Hoàn thành",
  "totalWeightedScoreSupervisor": "Tổng điểm có trọng số",
  "actions": "Hành động",
  "viewDetails": "Xem chi tiết",
  "selectCycle": "Chọn chu kỳ đánh giá",
  "selectCyclePlaceholder": "Vui lòng chọn chu kỳ",
  "noData": "Không có dữ liệu",
  "unknownStatus": "Không xác định"
}
</i18n>

<style scoped>
.employee-kpi-score-list {
  padding: 24px;
}
</style>
