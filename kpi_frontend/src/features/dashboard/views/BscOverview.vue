<template>
  <div class="bsc-overview-container" v-if="canViewDashboard">
    <LoadingOverlay :visible="isLoading" />
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t("dashboardOverview") }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{ $t("bscOverview") }}</a-breadcrumb-item>
    </a-breadcrumb>
    <h1>{{ $t("bscOverview") }}</h1>

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
        <!-- Overall BSC Score -->
        <a-card
          :title="$t('overallBscScore')"
          class="dashboard-card overall-score-card"
        >
          <a-row :gutter="[24, 24]">
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-statistic
                :title="$t('overallScore')"
                :value="overallScore"
                suffix="%"
                :value-style="{
                  color: getScoreColor(overallScore),
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                }"
              />
            </a-col>
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-statistic
                :title="$t('totalPerspectives')"
                :value="perspectives.length"
              />
            </a-col>
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-statistic
                :title="$t('totalKpis')"
                :value="totalKpis"
              />
            </a-col>
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-statistic
                :title="$t('achievedKpis')"
                :value="achievedKpis"
                :value-style="{ color: '#3f8600' }"
              />
            </a-col>
          </a-row>
        </a-card>

        <!-- BSC Perspectives -->
        <a-row :gutter="[24, 24]" style="margin-top: 24px">
          <a-col
            v-for="perspective in perspectivesWithStats"
            :key="perspective.id"
            :xs="24"
            :sm="12"
            :lg="12"
            :xl="6"
          >
            <a-card
              :title="`${perspective.id}. ${perspective.name}`"
              class="dashboard-card perspective-card"
              :class="getPerspectiveCardClass(perspective.score)"
            >
              <div class="perspective-content">
                <div class="perspective-header">
                  <a-statistic
                    :title="$t('score')"
                    :value="perspective.score"
                    suffix="%"
                    :value-style="{
                      color: getScoreColor(perspective.score),
                      fontSize: '2rem',
                      fontWeight: 'bold',
                    }"
                  />
                  <div class="traffic-light">
                    <a-tag
                      :color="getTrafficLightColor(perspective.score)"
                      class="traffic-light-tag"
                    >
                      {{ getTrafficLightLabel(perspective.score) }}
                    </a-tag>
                  </div>
                </div>
                <a-divider style="margin: 16px 0" />
                <div class="perspective-stats">
                  <a-row :gutter="[16, 16]">
                    <a-col :span="12">
                      <div class="stat-item">
                        <span class="stat-label">{{ $t("totalKpis") }}:</span>
                        <span class="stat-value">{{ perspective.totalKpis }}</span>
                      </div>
                    </a-col>
                    <a-col :span="12">
                      <div class="stat-item">
                        <span class="stat-label">{{ $t("achievedKpis") }}:</span>
                        <span class="stat-value achieved">{{
                          perspective.achievedKpis
                        }}</span>
                      </div>
                    </a-col>
                    <a-col :span="12">
                      <div class="stat-item">
                        <span class="stat-label">{{ $t("notAchievedKpis") }}:</span>
                        <span class="stat-value not-achieved">{{
                          perspective.notAchievedKpis
                        }}</span>
                      </div>
                    </a-col>
                    <a-col :span="12">
                      <div class="stat-item">
                        <span class="stat-label">{{ $t("achievementRate") }}:</span>
                        <span class="stat-value">{{
                          perspective.achievementRate
                        }}%</span>
                      </div>
                    </a-col>
                  </a-row>
                </div>
                <a-progress
                  :percent="perspective.score"
                  :status="
                    perspective.score >= 75
                      ? 'success'
                      : perspective.score >= 50
                        ? 'normal'
                        : 'exception'
                  "
                  :stroke-color="getScoreColor(perspective.score)"
                  style="margin-top: 16px"
                />
              </div>
            </a-card>
          </a-col>
        </a-row>

        <!-- Summary Chart -->
        <a-card
          :title="$t('perspectiveComparison')"
          class="dashboard-card comparison-card"
          style="margin-top: 24px"
        >
          <div class="chart-container" v-if="perspectivesWithStats.length > 0">
            <bar-chart
              :chart-data="comparisonChartData"
              :chart-options="comparisonChartOptions"
              style="height: 300px"
            />
          </div>
          <a-empty
            v-else
            :description="$t('noDataAvailable')"
            style="padding: 40px"
          />
        </a-card>
      </div>

      <a-empty
        v-if="!isLoading && perspectives.length === 0 && !loadingError"
        :description="$t('noPerspectivesAvailable')"
        style="padding: 40px"
      />
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
  Progress as AProgress,
  Tag as ATag,
  Divider as ADivider,
} from "ant-design-vue";
import BarChart from "@/core/components/common/BarChart.vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import apiClient from "@/core/services/api";

const { t: $t } = useI18n();
const store = useStore();

const perspectives = ref([]);
const kpisByPerspective = ref({});
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

const perspectivesWithStats = computed(() => {
  return perspectives.value.map((perspective) => {
    const kpis = kpisByPerspective.value[perspective.id] || [];
    const totalKpis = kpis.length;
    const achievedKpis = kpis.filter((kpi) => {
      const assignment = kpi.assignments?.[0];
      if (!assignment) return false;
      const target = parseFloat(assignment.target_value) || 0;
      const actual = parseFloat(assignment.actual_value) || 0;
      return actual >= target;
    }).length;
    const notAchievedKpis = totalKpis - achievedKpis;
    const achievementRate =
      totalKpis > 0 ? Math.round((achievedKpis / totalKpis) * 100) : 0;
    const score = achievementRate;

    return {
      ...perspective,
      totalKpis,
      achievedKpis,
      notAchievedKpis,
      achievementRate,
      score,
    };
  });
});

const overallScore = computed(() => {
  if (perspectivesWithStats.value.length === 0) return 0;
  const totalScore = perspectivesWithStats.value.reduce(
    (sum, p) => sum + p.score,
    0
  );
  return Math.round(totalScore / perspectivesWithStats.value.length);
});

const totalKpis = computed(() => {
  return perspectivesWithStats.value.reduce(
    (sum, p) => sum + p.totalKpis,
    0
  );
});

const achievedKpis = computed(() => {
  return perspectivesWithStats.value.reduce(
    (sum, p) => sum + p.achievedKpis,
    0
  );
});

const comparisonChartData = computed(() => {
  const labels = perspectivesWithStats.value.map(
    (p) => `${p.id}. ${p.name}`
  );
  const scores = perspectivesWithStats.value.map((p) => p.score);
  const achievementRates = perspectivesWithStats.value.map(
    (p) => p.achievementRate
  );

  return {
    labels,
    datasets: [
      {
        label: $t("score"),
        backgroundColor: "rgba(24, 144, 255, 0.7)",
        borderColor: "rgba(24, 144, 255, 1)",
        borderWidth: 1,
        data: scores,
      },
      {
        label: $t("achievementRate"),
        backgroundColor: "rgba(82, 196, 26, 0.7)",
        borderColor: "rgba(82, 196, 26, 1)",
        borderWidth: 1,
        data: achievementRates,
      },
    ],
  };
});

const comparisonChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "top",
    },
    title: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      ticks: {
        callback: function (value) {
          return value + "%";
        },
      },
    },
  },
}));

const getScoreColor = (score) => {
  if (score >= 75) return "#52c41a";
  if (score >= 50) return "#faad14";
  return "#ff4d4f";
};

const getTrafficLightColor = (score) => {
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "error";
};

const getTrafficLightLabel = (score) => {
  if (score >= 75) return $t("excellent");
  if (score >= 50) return $t("good");
  return $t("needsImprovement");
};

const getPerspectiveCardClass = (score) => {
  if (score >= 75) return "perspective-excellent";
  if (score >= 50) return "perspective-good";
  return "perspective-needs-improvement";
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

const fetchKpisByPerspective = async () => {
  try {
    loadingError.value = null;
    const kpisData = {};

    for (const perspective of perspectives.value) {
      try {
        const response = await apiClient.get("/kpis", {
          params: {
            perspectiveId: perspective.id,
            status: "Active",
            limit: 1000,
          },
        });
        kpisData[perspective.id] = response.data?.data || [];
      } catch (error) {
        console.error(
          `Error fetching KPIs for perspective ${perspective.id}:`,
          error
        );
        kpisData[perspective.id] = [];
      }
    }

    kpisByPerspective.value = kpisData;
  } catch (error) {
    loadingError.value =
      error.response?.data?.message ||
      error.message ||
      $t("failedToLoadKpis");
  }
};

const loadData = async () => {
  await store.dispatch("loading/startLoading");
  try {
    await fetchPerspectives();
    if (perspectives.value.length > 0) {
      await fetchKpisByPerspective();
    }
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.bsc-overview-container {
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

.overall-score-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.overall-score-card :deep(.ant-card-head-title) {
  color: white;
  font-weight: 700;
  font-size: 1.3rem;
}

.overall-score-card :deep(.ant-statistic-title) {
  color: rgba(255, 255, 255, 0.9);
}

.overall-score-card :deep(.ant-statistic-content) {
  color: white;
}

.perspective-card {
  transition: all 0.3s ease;
  height: 100%;
}

.perspective-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}

.perspective-excellent {
  border-left: 5px solid #52c41a;
}

.perspective-good {
  border-left: 5px solid #faad14;
}

.perspective-needs-improvement {
  border-left: 5px solid #ff4d4f;
}

.perspective-content {
  padding: 8px 0;
}

.perspective-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.traffic-light {
  margin-left: 16px;
}

.traffic-light-tag {
  font-size: 0.9rem;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 600;
}

.perspective-stats {
  margin-top: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1890ff;
}

.stat-value.achieved {
  color: #52c41a;
}

.stat-value.not-achieved {
  color: #ff4d4f;
}

.comparison-card {
  margin-top: 24px;
}

.chart-container {
  padding: 16px 0;
}

@media (max-width: 768px) {
  .bsc-overview-container {
    padding: 16px;
  }

  .perspective-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .traffic-light {
    margin-left: 0;
    margin-top: 8px;
  }
}
</style>

