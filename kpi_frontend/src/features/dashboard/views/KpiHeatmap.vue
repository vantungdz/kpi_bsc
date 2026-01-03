<template>
  <div class="kpi-heatmap-container" v-if="canViewDashboard">
    <LoadingOverlay :visible="isLoading" />
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t("dashboardOverview") }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{ $t("kpiHeatmap") }}</a-breadcrumb-item>
    </a-breadcrumb>
    <h1>{{ $t("kpiHeatmap") }}</h1>

    <a-spin :spinning="isLoading" :tip="$t('loadingData')">
      <a-alert
        v-if="loadingError"
        type="error"
        show-icon
        closable
        style="margin-bottom: 16px"
        :message="loadingError"
        @close="loadingError = null"
      />

      <div v-if="!loadingError">
        <!-- Filter Section -->
        <a-card class="dashboard-card filter-card" style="margin-bottom: 24px">
          <a-row :gutter="[16, 16]">
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-form-item :label="$t('selectPerspective')">
                <a-select
                  v-model:value="selectedPerspectiveId"
                  :placeholder="$t('selectBscPerspective')"
                  allow-clear
                  size="large"
                  @change="loadHeatmapData"
                >
                  <a-select-option value="">{{ $t("all") }}</a-select-option>
                  <a-select-option
                    v-for="perspective in perspectives"
                    :key="perspective.id"
                    :value="perspective.id"
                  >
                    {{ `${perspective.id}. ${perspective.name}` }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-form-item :label="$t('viewBy')">
                <a-select
                  v-model:value="viewBy"
                  size="large"
                  @change="loadHeatmapData"
                >
                  <a-select-option value="department">{{ $t("department") }}</a-select-option>
                  <a-select-option value="section">{{ $t("section") }}</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-form-item :label="$t('colorScheme')">
                <a-select v-model:value="colorScheme" size="large">
                  <a-select-option value="traffic">{{ $t("trafficLight") }}</a-select-option>
                  <a-select-option value="gradient">{{ $t("gradient") }}</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
        </a-card>

        <!-- Legend -->
        <a-card class="dashboard-card legend-card" style="margin-bottom: 24px">
          <div class="legend-container">
            <div class="legend-title">{{ $t("legend") }}:</div>
            <div class="legend-items">
              <div class="legend-item">
                <div class="legend-color excellent"></div>
                <span>{{ $t("excellent") }} (≥75%)</span>
              </div>
              <div class="legend-item">
                <div class="legend-color good"></div>
                <span>{{ $t("good") }} (50-74%)</span>
              </div>
              <div class="legend-item">
                <div class="legend-color needs-improvement"></div>
                <span>{{ $t("needsImprovement") }} (<50%)</span>
              </div>
              <div class="legend-item">
                <div class="legend-color no-data"></div>
                <span>{{ $t("noData") }}</span>
              </div>
            </div>
          </div>
        </a-card>

        <!-- Heatmap Table -->
        <a-card
          :title="$t('kpiHeatmap')"
          class="dashboard-card heatmap-card"
          v-if="heatmapData.length > 0"
        >
          <div class="heatmap-wrapper">
            <table class="heatmap-table">
              <thead>
                <tr>
                  <th class="sticky-header">{{ $t("kpiName") }}</th>
                  <th
                    v-for="entity in entities"
                    :key="entity.id"
                    class="entity-header"
                  >
                    {{ entity.name }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="kpi in heatmapData" :key="kpi.id">
                  <td class="sticky-cell kpi-name-cell">{{ kpi.name }}</td>
                  <td
                    v-for="entity in entities"
                    :key="entity.id"
                    :class="[
                      'heatmap-cell',
                      getCellClass(kpi, entity.id),
                    ]"
                    :title="getCellTooltip(kpi, entity.id)"
                  >
                    {{ getCellValue(kpi, entity.id) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </a-card>

        <!-- Summary Statistics -->
        <a-row :gutter="[24, 24]" style="margin-top: 24px" v-if="heatmapData.length > 0">
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-card class="dashboard-card stat-card">
              <a-statistic
                :title="$t('totalKpis')"
                :value="heatmapData.length"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-card class="dashboard-card stat-card">
              <a-statistic
                :title="$t('totalEntities')"
                :value="entities.length"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-card class="dashboard-card stat-card">
              <a-statistic
                :title="$t('excellentCount')"
                :value="excellentCount"
                :value-style="{ color: '#52c41a' }"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-card class="dashboard-card stat-card">
              <a-statistic
                :title="$t('needsImprovementCount')"
                :value="needsImprovementCount"
                :value-style="{ color: '#ff4d4f' }"
              />
            </a-card>
          </a-col>
        </a-row>

        <a-empty
          v-if="!isLoading && heatmapData.length === 0 && !loadingError"
          :description="$t('noDataAvailable')"
          style="padding: 40px"
        />
      </div>
    </a-spin>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import {
  Breadcrumb as ABreadcrumb,
  BreadcrumbItem as ABreadcrumbItem,
  Card as ACard,
  Row as ARow,
  Col as ACol,
  Statistic as AStatistic,
  Spin as ASpin,
  Alert as AAlert,
  Empty as AEmpty,
  FormItem as AFormItem,
  Select as ASelect,
  SelectOption as ASelectOption,
} from "ant-design-vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import apiClient from "@/core/services/api";

const { t: $t } = useI18n();
const store = useStore();

const perspectives = ref([]);
const selectedPerspectiveId = ref(null);
const viewBy = ref("department");
const colorScheme = ref("traffic");
const kpis = ref([]);
const departments = ref([]);
const sections = ref([]);
const isLoading = computed(() => store.getters["loading/isLoading"]);
const loadingError = ref(null);

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);

function hasPermission(action, resource, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action?.trim() === action &&
      p.resource?.trim() === resource &&
      (scope ? p.scope?.trim() === scope : true)
  );
}

const canViewDashboard = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD)
);

const entities = computed(() => {
  return viewBy.value === "department" ? departments.value : sections.value;
});

const heatmapData = computed(() => {
  return kpis.value.map((kpi) => {
    const entityScores = {};
    entities.value.forEach((entity) => {
      const assignment = kpi.assignments?.find(
        (a) =>
          (viewBy.value === "department" && a.department?.id === entity.id) ||
          (viewBy.value === "section" && a.section?.id === entity.id)
      );
      if (assignment) {
        const target = parseFloat(assignment.target_value) || 0;
        const actual = parseFloat(assignment.actual_value) || 0;
        const score = target > 0 ? Math.round((actual / target) * 100) : 0;
        entityScores[entity.id] = {
          score,
          target,
          actual,
          unit: kpi.unit || "",
        };
      } else {
        entityScores[entity.id] = null;
      }
    });
    return {
      id: kpi.id,
      name: kpi.name,
      entityScores,
    };
  });
});

const excellentCount = computed(() => {
  let count = 0;
  heatmapData.value.forEach((kpi) => {
    Object.values(kpi.entityScores).forEach((score) => {
      if (score && score.score >= 75) count++;
    });
  });
  return count;
});

const needsImprovementCount = computed(() => {
  let count = 0;
  heatmapData.value.forEach((kpi) => {
    Object.values(kpi.entityScores).forEach((score) => {
      if (score && score.score < 50) count++;
    });
  });
  return count;
});

const getCellClass = (kpi, entityId) => {
  const score = kpi.entityScores[entityId];
  if (!score) return "no-data";
  if (score.score >= 75) return "excellent";
  if (score.score >= 50) return "good";
  return "needs-improvement";
};

const getCellValue = (kpi, entityId) => {
  const score = kpi.entityScores[entityId];
  if (!score) return "-";
  return `${score.score}%`;
};

const getCellTooltip = (kpi, entityId) => {
  const score = kpi.entityScores[entityId];
  if (!score) return $t("noData");
  return `${$t("target")}: ${score.target.toLocaleString()} ${score.unit}\n${$t("actual")}: ${score.actual.toLocaleString()} ${score.unit}\n${$t("score")}: ${score.score}%`;
};

const fetchPerspectives = async () => {
  try {
    loadingError.value = null;
    await store.dispatch("perspectives/fetchPerspectives");
    perspectives.value = store.getters["perspectives/list"] || [];
  } catch (error) {
    loadingError.value =
      error.response?.data?.message ||
      error.message ||
      $t("failedToLoadPerspectives");
  }
};

const fetchDepartments = async () => {
  try {
    const response = await apiClient.get("/departments");
    departments.value = response.data || [];
  } catch (error) {
    console.error("Error fetching departments:", error);
    departments.value = [];
  }
};

const fetchSections = async () => {
  try {
    const response = await apiClient.get("/sections");
    sections.value = response.data || [];
  } catch (error) {
    console.error("Error fetching sections:", error);
    sections.value = [];
  }
};

const loadKpis = async () => {
  try {
    loadingError.value = null;
    const params = {
      status: "Active",
      limit: 1000,
    };
    if (selectedPerspectiveId.value) {
      params.perspectiveId = selectedPerspectiveId.value;
    }

    const response = await apiClient.get("/kpis", { params });
    kpis.value = response.data?.data || [];
  } catch (error) {
    loadingError.value =
      error.response?.data?.message ||
      error.message ||
      $t("failedToLoadKpis");
    kpis.value = [];
  }
};

const loadHeatmapData = async () => {
  await store.dispatch("loading/startLoading");
  try {
    await loadKpis();
    if (viewBy.value === "department") {
      await fetchDepartments();
    } else {
      await fetchSections();
    }
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

const loadData = async () => {
  await store.dispatch("loading/startLoading");
  try {
    await fetchPerspectives();
    await fetchDepartments();
    await loadKpis();
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.kpi-heatmap-container {
  padding: 32px;
  background: #fafdff;
  min-height: calc(100vh - 64px);
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1a237e;
  margin-bottom: 24px;
}

.dashboard-card {
  border-radius: 16px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.07);
  border: none;
}

.legend-container {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.legend-title {
  font-weight: 600;
  color: #333;
}

.legend-items {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.legend-color.excellent {
  background-color: #52c41a;
}

.legend-color.good {
  background-color: #faad14;
}

.legend-color.needs-improvement {
  background-color: #ff4d4f;
}

.legend-color.no-data {
  background-color: #f0f0f0;
}

.heatmap-wrapper {
  overflow-x: auto;
  margin: -16px;
  padding: 16px;
}

.heatmap-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.heatmap-table thead {
  background: #f5f7fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

.heatmap-table th {
  padding: 12px;
  text-align: center;
  font-weight: 600;
  border: 1px solid #e8e8e8;
  white-space: nowrap;
}

.heatmap-table td {
  padding: 12px;
  text-align: center;
  border: 1px solid #e8e8e8;
  white-space: nowrap;
  transition: all 0.2s;
}

.heatmap-table td:hover {
  transform: scale(1.05);
  z-index: 5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.sticky-header {
  position: sticky;
  left: 0;
  z-index: 11;
  background: #f5f7fa;
}

.sticky-cell {
  position: sticky;
  left: 0;
  z-index: 5;
  background: white;
}

.kpi-name-cell {
  font-weight: 600;
  text-align: left;
  min-width: 200px;
}

.entity-header {
  min-width: 120px;
}

.heatmap-cell {
  cursor: pointer;
  font-weight: 600;
  min-width: 80px;
}

.heatmap-cell.excellent {
  background-color: #52c41a;
  color: white;
}

.heatmap-cell.good {
  background-color: #faad14;
  color: white;
}

.heatmap-cell.needs-improvement {
  background-color: #ff4d4f;
  color: white;
}

.heatmap-cell.no-data {
  background-color: #f0f0f0;
  color: #999;
}

.stat-card {
  text-align: center;
}

@media (max-width: 768px) {
  .kpi-heatmap-container {
    padding: 16px;
  }

  .legend-container {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

