<template>
  <div class="report-generator-card">
    <LoadingOverlay :visible="loading" message="Loading user data..." />
    <div class="report-header">
      <FileSearchOutlined class="header-icon" />
      <span class="header-title">{{ $t("reportOptions") }}</span>
    </div>
    <div class="report-content">
      <a-form
        class="report-form"
        :label-col="{ span: 24 }"
        :wrapper-col="{ span: 24 }"
        :disabled="!canGenerateReport"
        layout="vertical"
      >
        <a-form-item :label="labelWithIcon('reportType', 'BarChartOutlined')">
          <a-select
            v-model:value="selectedReportType"
            :placeholder="$t('selectReportType')"
            :disabled="!canGenerateReport"
            size="large"
          >
            <a-select-option value="kpi-summary">
              <template #default>
                <BarChartOutlined class="option-icon" /> {{ $t("kpiSummary") }}
              </template>
            </a-select-option>
            <a-select-option value="kpi-details">
              <FileTextOutlined class="option-icon" /> {{ $t("kpiDetails") }}
            </a-select-option>
            <a-select-option value="kpi-comparison">
              <LineChartOutlined class="option-icon" /> {{ $t("kpiComparison") }}
            </a-select-option>
            <a-select-option value="dashboard-multi">
              <DashboardOutlined class="option-icon" /> {{ $t("kpiDashboardMulti") }}
            </a-select-option>
            <a-select-option value="kpi-awaiting-approval">
              <ClockCircleOutlined class="option-icon" /> {{ $t("kpiAwaitingApproval") }}
            </a-select-option>
            <a-select-option value="employee-performance">
              <UserOutlined class="option-icon" /> {{ $t("employeePerformance") }}
            </a-select-option>
            <a-select-option value="strategic-objectives">
              <FlagOutlined class="option-icon" /> {{ $t("strategicObjectives") }}
            </a-select-option>
            <a-select-option value="kpi-inventory">
              <DatabaseOutlined class="option-icon" /> {{ $t("kpiInventory") }}
            </a-select-option>
            <a-select-option value="kpi-update-progress">
              <SyncOutlined class="option-icon" /> {{ $t("kpiUpdateProgress") }}
            </a-select-option>
            <a-select-option value="kpi-history">
              <HistoryOutlined class="option-icon" /> {{ $t("kpiHistory") }}
            </a-select-option>
            <a-select-option value="kpi-custom">
              <SettingOutlined class="option-icon" /> {{ $t("customReport") }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item :label="labelWithIcon('fileFormat', 'FileExcelOutlined')">
          <a-radio-group
            v-model:value="selectedFileFormat"
            :disabled="!canGenerateReport"
            size="large"
          >
            <a-radio value="excel">
              <FileExcelOutlined class="option-icon" /> Excel
            </a-radio>
            <a-radio value="pdf">
              <FilePdfOutlined class="option-icon" /> PDF
            </a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item :label="labelWithIcon('dateRange', 'CalendarOutlined')">
          <a-range-picker
            v-model:value="selectedDateRange"
            :disabled="!canGenerateReport"
            size="large"
          />
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            @click="generateReport"
            :disabled="!canGenerateReport"
            size="large"
            class="generate-btn"
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
        class="access-denied"
      >
        <ExportOutlined style="margin-right: 4px" />
        {{ $t("accessDeniedExportReport") }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from "vue";
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";
import { message } from "ant-design-vue";
import {
  ExportOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  FileTextOutlined,
  LineChartOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FlagOutlined,
  DatabaseOutlined,
  SyncOutlined,
  HistoryOutlined,
  SettingOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  CalendarOutlined
} from "@ant-design/icons-vue";
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


const canGenerateReport = computed(() => {
  const result = userPermissions.value.some(
    (p) =>
      p.action === RBAC_ACTIONS.EXPORT &&
      p.resource === RBAC_RESOURCES.REPORT &&
      p.scope === "global"
  );
  return result;
});

const canViewReportGenerator = computed(() => {
  const result = userPermissions.value.some(
    (p) =>
      p.action === RBAC_ACTIONS.VIEW &&
      p.resource === RBAC_RESOURCES.REPORT &&
      p.scope === "global"
  );
  return result;
});

const labelWithIcon = (labelKey, iconName) => {
  const icons = {
    BarChartOutlined: BarChartOutlined,
    FileExcelOutlined: FileExcelOutlined,
    FilePdfOutlined: FilePdfOutlined,
    CalendarOutlined: CalendarOutlined,
  };
  const IconComp = icons[iconName];
  return IconComp
    ? [h(IconComp, { class: 'label-icon' }), t(labelKey)]
    : t(labelKey);
};

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
  store.dispatch("loading/startLoading");
  setTimeout(() => {
    store.dispatch("loading/stopLoading");
  }, 1000);
});
</script>

<style scoped>
.report-generator-card {
  max-width: 520px;
  margin: 40px auto 0 auto;
  background: rgba(255,255,255,0.95);
  border-radius: 24px;
  box-shadow: 0 6px 32px 0 rgba(24, 144, 255, 0.08), 0 1.5px 6px 0 rgba(0,0,0,0.04);
  padding: 36px 32px 28px 32px;
  border: none;
  position: relative;
  min-height: 420px;
  display: flex;
  flex-direction: column;
}
.report-header {
  display: flex;
  align-items: center;
  margin-bottom: 32px;
  gap: 12px;
}
.report-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.header-icon {
  font-size: 32px;
  color: #1890ff;
  background: #e6f7ff;
  border-radius: 50%;
  padding: 8px;
  box-shadow: 0 2px 8px 0 rgba(24,144,255,0.08);
}
.header-title {
  font-size: 2rem;
  font-weight: 700;
  color: #222;
  letter-spacing: 0.5px;
}
.report-form {
  margin-top: 0;
}
.label-icon {
  margin-right: 8px;
  vertical-align: middle;
}
.option-icon {
  margin-right: 8px;
  color: #1890ff;
  font-size: 1.1em;
  vertical-align: middle;
}
.ant-form-item-label > label {
  font-weight: 600;
  color: #444;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ant-select-selector {
  border-radius: 12px !important;
  min-height: 44px;
  font-size: 1.05rem;
}
.ant-radio-group {
  gap: 24px;
}
.ant-radio-wrapper {
  border-radius: 8px;
  padding: 4px 12px;
  transition: background 0.2s;
  font-size: 1.05rem;
}
.ant-radio-wrapper:hover {
  background: #f0f5ff;
}
.ant-picker {
  border-radius: 12px !important;
  min-height: 44px;
  font-size: 1.05rem;
}
.generate-btn {
  width: 100%;
  height: 48px;
  font-size: 1.15rem;
  border-radius: 16px;
  font-weight: 600;
  box-shadow: 0 2px 8px 0 rgba(24,144,255,0.08);
  margin-top: 8px;
}
.generate-btn .anticon {
  font-size: 1.2em;
}
.access-denied {
  color: #ff4d4f;
  margin-top: 20px;
  text-align: center;
  font-weight: 500;
  font-size: 1.08rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.report-form .ant-select,
.report-form .ant-picker {
  width: 100%;
  min-height: 44px;
  font-size: 1.05rem;
}
</style>
