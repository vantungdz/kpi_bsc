<template>
  <div class="review-history-page">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t('dashboard') }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>
        <router-link to="/employees" v-if="targetType === 'employee'">
          {{ $t('employees') }}
        </router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{ $t('reviewHistoryTitle') }}</a-breadcrumb-item>
    </a-breadcrumb>

    <a-card :title="pageTitle" :bordered="false">
      <a-spin :spinning="isLoadingHistory" :tip="$t('loadingHistory')">
        <a-alert
          v-if="historyError"
          type="error"
          show-icon
          closable
          style="margin-bottom: 16px"
          :message="$t('historyError')"
          @close="clearHistoryError"
        />

        <div
          v-if="
            !isLoadingHistory && reviewHistory.length === 0 && !historyError
          "
        >
          <a-empty
            :description="`${$t('noReviewHistoryFound')} ${targetName}.`"
          />
        </div>

        <a-collapse v-else v-model:activeKey="activePanelKeys" accordion>
          <a-collapse-panel
            v-for="reviewItem in reviewHistory"
            :key="reviewItem.overallReviewId"
            :header="`${$t('cycle')}: ${reviewItem.cycleId} - ${$t('reviewDate')}: ${formatDate(reviewItem.reviewedAt)} - ${$t('reviewedBy')}: ${reviewItem.reviewedByUsername}`"
            @click="
              () => console.log('Panel clicked:', reviewItem.overallReviewId)
            "
          >
            <a-descriptions bordered :column="1" size="small">
              <a-descriptions-item :label="$t('reviewStatus')">
                <a-tag :color="getOverallReviewStatusColor(reviewItem.status)">
                  {{ getOverallReviewStatusText(reviewItem.status) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item :label="$t('overallManagerComment')">
                <p style="white-space: pre-wrap">
                  {{ reviewItem.overallComment || $t('noComment') }}
                </p>
              </a-descriptions-item>

              <template v-if="reviewItem.employeeComment">
                <a-descriptions-item :label="$t('employeeFeedbackDate')">
                  {{ formatDate(reviewItem.employeeFeedbackDate) }}
                </a-descriptions-item>
                <a-descriptions-item :label="$t('employeeFeedbackContent')">
                  <p style="white-space: pre-wrap">
                    {{ reviewItem.employeeComment }}
                  </p>
                </a-descriptions-item>
              </template>
              <a-descriptions-item
                v-else-if="reviewItem.status === 'EMPLOYEE_FEEDBACK_PENDING'"
                :label="$t('employeeFeedback')"
              >
                {{ $t('awaitingEmployeeFeedback') }}
              </a-descriptions-item>
            </a-descriptions>
          </a-collapse-panel>
        </a-collapse>
      </a-spin>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue"; // Thêm nextTick
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import {
  Card as ACard,
  Spin as ASpin,
  Alert as AAlert,
  Empty as AEmpty,
  Collapse as ACollapse,
  CollapsePanel as ACollapsePanel,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Tag as ATag,
  Breadcrumb as ABreadcrumb,
  BreadcrumbItem as ABreadcrumbItem,
  notification,
} from "ant-design-vue";
import { useI18n } from 'vue-i18n';
import dayjs from "dayjs";

const { t: $t } = useI18n();

const OverallReviewStatus = {
  PENDING_REVIEW: "PENDING_REVIEW",
  MANAGER_REVIEWED: "MANAGER_REVIEWED",
  EMPLOYEE_FEEDBACK_PENDING: "EMPLOYEE_FEEDBACK_PENDING",
  EMPLOYEE_RESPONDED: "EMPLOYEE_RESPONDED",
  COMPLETED: "COMPLETED",
};

const store = useStore();
const route = useRoute();
// const router = useRouter();

const targetId = ref(null);
const targetType = ref(null);
const targetName = ref(""); // Sẽ lấy tên từ store hoặc API khác

const reviewHistory = computed(
  () => store.getters["kpiEvaluations/getReviewHistory"]
);
const isLoadingHistory = computed(
  () => store.getters["kpiEvaluations/isLoadingReviewHistory"]
);
const historyError = ref(
  computed({
    get: () => store.getters["kpiEvaluations/getReviewHistoryError"],
    set: (val) => store.commit("kpiEvaluations/SET_REVIEW_HISTORY_ERROR", val),
  })
);

const activePanelKeys = ref([]);

const pageTitle = computed(() => {
  if (targetName.value) {
    return `${$t('reviewHistoryFor')}: ${targetName.value}`;
  }
  return $t('reviewHistory');
});

const fetchTargetDetails = async () => {
  // Hàm này cần lấy thông tin chi tiết của target (ví dụ: tên nhân viên)
  // dựa vào targetId.value và targetType.value
  // Ví dụ, nếu targetType là 'employee', gọi API lấy thông tin nhân viên
  if (targetType.value === "employee" && targetId.value) {
    try {
      // Giả sử bạn có action để lấy chi tiết user
      const userDetail = await store.dispatch(
        "employees/fetchUserById",
        targetId.value
      ); // Cần tạo action này nếu chưa có
      if (userDetail) {
        targetName.value =
          `${userDetail.first_name || ""} ${userDetail.last_name || ""} (${userDetail.username || ""})`.trim();
      } else {
        targetName.value = `${targetType.value} ID ${targetId.value}`;
      }
    } catch (e) {
      console.error("Error fetching target details:", e);
      targetName.value = `${targetType.value} ID ${targetId.value}`;
    }
  } else if (targetType.value === "section" && targetId.value) {
    try {
      // Giả sử bạn có action 'sections/fetchSectionById'
      const sectionDetail = await store.dispatch(
        "sections/fetchSectionById",
        targetId.value
      );
      if (sectionDetail) {
        targetName.value =
          sectionDetail.name || `${targetType.value} ID ${targetId.value}`;
      } else {
        targetName.value = `${targetType.value} ID ${targetId.value}`;
      }
    } catch (e) {
      console.error("Error fetching target details (section):", e);
      targetName.value = `${targetType.value} ID ${targetId.value}`;
    }
  } else if (targetType.value === "department" && targetId.value) {
    try {
      // Giả sử bạn có action 'departments/fetchDepartmentById'
      const departmentDetail = await store.dispatch(
        "departments/fetchDepartmentById",
        targetId.value
      );
      if (departmentDetail) {
        targetName.value =
          departmentDetail.name || `${targetType.value} ID ${targetId.value}`;
      } else {
        targetName.value = `${targetType.value} ID ${targetId.value}`;
      }
    } catch (e) {
      console.error("Error fetching target details (department):", e);
      targetName.value = `${targetType.value} ID ${targetId.value}`;
    }
  } else {
    // Xử lý cho section/department nếu cần
    targetName.value = `${targetType.value} ID ${targetId.value}`;
  }
};

const loadReviewHistory = async () => {
  if (targetId.value && targetType.value) {
    await store.dispatch("kpiEvaluations/fetchReviewHistory", {
      targetId: targetId.value,
      targetType: targetType.value,
    });
    // Tự động mở panel đầu tiên nếu có dữ liệu
    console.log(
      "[ReviewHistoryPage] loadReviewHistory - Fetched reviewHistory:",
      JSON.parse(JSON.stringify(reviewHistory.value))
    );
    if (
      reviewHistory.value.length > 0 &&
      reviewHistory.value[0]?.overallReviewId !== undefined
    ) {
      await nextTick(); // Đợi Vue cập nhật DOM/reactivity
      activePanelKeys.value = [String(reviewHistory.value[0].overallReviewId)]; // Chuyển key sang string nếu cần
      console.log(
        "[ReviewHistoryPage] loadReviewHistory - Active panel keys SET to:",
        JSON.parse(JSON.stringify(activePanelKeys.value))
      );
    } else {
      activePanelKeys.value = [];
      console.log(
        "[ReviewHistoryPage] loadReviewHistory - Review history empty or first item has no ID, activePanelKeys cleared."
      );
    }
  } else {
    notification.error({
      message: $t('missingTargetInfo'),
    });
  }
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  return dayjs(dateString).format("DD/MM/YYYY HH:mm");
};

const getOverallReviewStatusText = (statusKey) => {
  const statusMap = {
    [OverallReviewStatus.PENDING_REVIEW]: $t('pendingReview'),
    [OverallReviewStatus.MANAGER_REVIEWED]: $t('managerReviewed'),
    [OverallReviewStatus.EMPLOYEE_FEEDBACK_PENDING]: $t('awaitingEmployeeFeedback'),
    [OverallReviewStatus.EMPLOYEE_RESPONDED]: $t('employeeResponded'),
    [OverallReviewStatus.COMPLETED]: $t('completed'),
  };
  return statusMap[statusKey] || statusKey || $t('unknown');
};

const getOverallReviewStatusColor = (statusKey) => {
  switch (statusKey) {
    case OverallReviewStatus.PENDING_REVIEW:
      return "default";
    case OverallReviewStatus.MANAGER_REVIEWED:
      return "blue";
    case OverallReviewStatus.EMPLOYEE_FEEDBACK_PENDING:
      return "orange";
    case OverallReviewStatus.EMPLOYEE_RESPONDED:
      return "cyan";
    case OverallReviewStatus.COMPLETED:
      return "green";
    default:
      return "default";
  }
};

const clearHistoryError = () => {
  historyError.value = null;
};

watch(
  () => route.params,
  async (newParams) => {
    const id = parseInt(newParams.targetId, 10);
    const type = newParams.targetType;

    if (
      !isNaN(id) &&
      type &&
      (type === "employee" || type === "section" || type === "department")
    ) {
      targetId.value = id;
      targetType.value = type;
      await fetchTargetDetails(); // Lấy tên target
      await loadReviewHistory();
      console.log(
        "[ReviewHistoryPage] Watch route.params - Target and History loaded for:",
        newParams
      );
    } else {
      console.error("Invalid route params for Review History:", newParams);
      notification.error({ message: $t('invalidRoute') });
      // Có thể điều hướng về trang trước hoặc trang lỗi
      // router.push({ name: 'NotFound' });
    }
  },
  { immediate: true, deep: true }
);

onMounted(() => {
  // Logic đã chuyển vào watch route.params
  console.log(
    "[ReviewHistoryPage] Component Mounted. Route params:",
    JSON.parse(JSON.stringify(route.params))
  );
});
</script>

<style scoped>
.review-history-page {
  padding: 24px;
}
.ant-collapse-content > .ant-collapse-content-box {
  padding-top: 0; /* Remove default top padding for descriptions */
}
.ant-descriptions-item-label {
  font-weight: bold;
}
</style>
