<template>
  <div class="report-generator" v-if="canViewReportGenerator">
    <LoadingOverlay :visible="loading" message="Loading user data..." />
    <h2>{{ $t("reportOptions") }}</h2>

    <a-form
      :label-col="{ span: 8 }"
      :wrapper-col="{ span: 16 }"
      :disabled="!canGenerateReport"
    >
      <a-form-item :label="$t('reportType')">
        <a-select
          v-model:value="selectedReportType"
          :placeholder="$t('selectReportType')"
          :disabled="!canGenerateReport"
        >
          <a-select-option value="kpi-summary">{{
            $t("kpiSummary")
          }}</a-select-option>
          <a-select-option value="kpi-details">{{
            $t("kpiDetails")
          }}</a-select-option>
          <a-select-option value="kpi-comparison">{{
            $t("kpiComparison")
          }}</a-select-option>
          <a-select-option value="kpi-custom">{{
            $t("customReport")
          }}</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item :label="$t('fileFormat')">
        <a-radio-group
          v-model:value="selectedFileFormat"
          :disabled="!canGenerateReport"
        >
          <a-radio value="excel">Excel</a-radio>
          <a-radio value="pdf">PDF</a-radio>
          <a-radio value="csv">CSV</a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item :label="$t('dateRange')">
        <a-range-picker
          v-model:value="selectedDateRange"
          :disabled="!canGenerateReport"
        />
      </a-form-item>

      <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
        <a-button
          type="primary"
          @click="generateReport"
          :disabled="!canGenerateReport"
        >
          <template #icon>
            <ExportOutlined />
          </template>
          {{ $t("generateReport") }}
        </a-button>
      </a-form-item>
    </a-form>
    <div
      v-if="canViewReportGenerator && !canGenerateReport"
      style="color: #ff4d4f; margin-top: 16px"
    >
      <ExportOutlined style="margin-right: 4px" />
      {{ $t("accessDeniedExportReport") }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";
import { message } from "ant-design-vue";
import { ExportOutlined } from "@ant-design/icons-vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
} from "@/core/constants/rbac.constants.js";

const { t } = useI18n();
const store = useStore();

const selectedReportType = ref(null);
const selectedFileFormat = ref("excel");
const selectedDateRange = ref(null);
const loading = computed(() => store.getters["loading/isLoading"]);

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);
const canGenerateReport = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.EXPORT &&
      p.resource?.trim() === RBAC_RESOURCES.REPORT
  )
);

const canViewReportGenerator = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.VIEW &&
      p.resource?.trim() === RBAC_RESOURCES.REPORT
  )
);

const generateReport = () => {
  if (!canGenerateReport.value) {
    message.error(t("accessDenied"));
    return;
  }
  if (!selectedReportType.value) {
    message.error(t("selectReportTypeFirst"));
    return;
  }
  let startDate = null,
    endDate = null;
  if (selectedDateRange.value && selectedDateRange.value.length === 2) {
    startDate = selectedDateRange.value[0];
    endDate = selectedDateRange.value[1];
    if (startDate && typeof startDate === "object" && startDate.format) {
      startDate = startDate.format("YYYY-MM-DD");
    }
    if (endDate && typeof endDate === "object" && endDate.format) {
      endDate = endDate.format("YYYY-MM-DD");
    }
  }
  store
    .dispatch("reports/generateReport", {
      reportType: selectedReportType.value,
      fileFormat: selectedFileFormat.value,
      startDate,
      endDate,
    })
    .then(() => {
      message.success(t("reportGeneratedSuccessfully"));
    })
    .catch(() => {
      // Error handling is already managed in the store
    });
};

onMounted(() => {
  store.dispatch("loading/startLoading"); // Start loading when the component is mounted
  // Simulate a delay or fetch initial data
  setTimeout(() => {
    store.dispatch("loading/stopLoading"); // Stop loading after initialization
  }, 1000); // Adjust the delay as needed
});
</script>

<style scoped>
.report-generator {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 5px;
  margin-top: 20px;
}
</style>
