<template>
    <div class="user-activity-statistics-container">
        <a-breadcrumb style="margin-bottom: 16px">
            <a-breadcrumb-item><router-link to="/dashboard">{{ $t('dashboardOverview') }}</router-link></a-breadcrumb-item>
            <a-breadcrumb-item>{{ $t('userActivityStatistics') }}</a-breadcrumb-item>
        </a-breadcrumb>
        <h1>{{ $t('userActivityStatisticsTitle') }}</h1>

        <!-- 1. Người dùng/Bộ phận có nhiều KPI đang chờ duyệt nhất -->
        <a-card :title="$t('topPendingApprovers')" class="dashboard-card">
            <a-row :gutter="[16, 16]">
                <a-col v-if="topPendingApproversError" :span="24">
                    <a-alert :message="$t('error')" :description="topPendingApproversError" type="error" show-icon />
                </a-col>
                <template v-if="!topPendingApproversError">
                    <a-col :span="24">
                        <a-skeleton :loading="isLoadingTopPendingApprovers" active avatar :paragraph="{ rows: 5 }"
                            :title="false">
                            <a-list bordered :dataSource="topPendingApproversStats"
                                v-if="topPendingApproversStats.length > 0" item-layout="vertical">
                                <template #renderItem="{ item }">
                                    <a-list-item>
                                        <div class="list-item-content approver-item">
                                            <div class="item-header expandable"
                                                @click="toggleExpand(item.approverId, 'approvers')">
                                                <span class="expand-icon">
                                                    <down-outlined v-if="isExpanded(item.approverId, 'approvers')" />
                                                    <right-outlined v-else />
                                                </span>
                                                <span class="item-title">
                                                    {{ item.approverName }}
                                                    <a-tag :color="getApproverTypeColor(item.approverType)"
                                                        style="margin-left: 8px;">
                                                        {{ formatApproverType(item.approverType) }}
                                                    </a-tag>
                                                </span>
                                                <span class="item-count"><strong>{{ item.pendingCount }}</strong> {{ $t('pendingKpiCount') }}</span>
                                            </div>
                                            <div v-if="isExpanded(item.approverId, 'approvers')"
                                                class="expanded-details">
                                                <div v-if="item.pendingKpis && item.pendingKpis.length > 0"
                                                    class="recent-kpis-list">
                                                    <small>{{ $t('recentPendingKpis') }}</small>
                                                    <ul>
                                                        <li v-for="kpi_detail in item.pendingKpis"
                                                            :key="kpi_detail.kpiValueId">
                                                            <a @click="navigateToApproval(kpi_detail.kpiValueId, kpi_detail.kpiId)"
                                                                :title="`${$t('kpi')}: ${kpi_detail.kpiName} (ID: ${kpi_detail.kpiId})\n${$t('submittedBy')}: ${kpi_detail.submittedBy}`">
                                                                {{ kpi_detail.kpiName }} (ID: {{ kpi_detail.kpiId }})
                                                                <span v-if="kpi_detail.submittedBy" style="font-size: 0.9em; color: #777;"> - {{ $t('submittedBy') }}: {{ kpi_detail.submittedBy }}</span>
                                                            </a>
                                                        </li>
                                                    </ul>
                                                </div>
                                                <div v-else class="recent-kpis-list">
                                                    <small>{{ $t('noPendingKpiDetails') }}</small>
                                                </div>
                                            </div>
                                        </div>
                                    </a-list-item>
                                </template>
                            </a-list>
                            <div v-else-if="!isLoadingTopPendingApprovers && topPendingApproversStats.length === 0"
                                class="empty-list">
                                {{ $t('noPendingApproversData') }}
                            </div>
                        </a-skeleton>
                    </a-col>
                </template>
            </a-row>
        </a-card>
        <!-- Chart for Top Pending Approvers -->
        <a-card v-if="!isLoadingTopPendingApprovers && !topPendingApproversError && topPendingApproversStats.length > 0"
            class="dashboard-card chart-card">
            <div class="chart-container">
                <bar-chart :chart-data="topPendingApproversChartData" :chart-options="topPendingApproversChartOptions"
                    style="height: 350px;" />
            </div>
        </a-card>




        <!-- 2. Người dùng/Bộ phận submit KPI nhiều nhất/ít nhất -->
        <a-card :title="$t('kpiSubmissionStats')" class="dashboard-card card-submission-stats">
            <a-row :gutter="[16, 16]" style="margin-bottom: 16px;">
                <a-col :xs="24" :sm="12" :md="12"> 
                    <label>{{ $t('entityType') }}: </label>
                    <a-radio-group v-model:value="kpiSubmissionFilters.entityType" button-style="solid" size="small">
                        <a-radio-button v-for="option in entityTypeOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </a-radio-button>
                    </a-radio-group>
                </a-col>
                <a-col :xs="24" :sm="12" :md="12">  
                    <label>{{ $t('orderBy') }}: </label>
                    <a-radio-group v-model:value="kpiSubmissionFilters.orderBy" button-style="solid" size="small">
                        <a-radio-button v-for="option in orderByOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </a-radio-button>
                    </a-radio-group>
                </a-col>
                <a-col :xs="24" :sm="24" :md="8">
                    <label>{{ $t('within') }}: </label>
                    <a-select v-model:value="kpiSubmissionFilters.days" style="width: 100%" size="small">
                        <a-select-option v-for="option in daysOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </a-select-option>
                    </a-select>
                </a-col>
                <a-col :xs="24" :sm="12" :md="8"> 
                    <label>{{ $t('top') }}: </label>
                    <a-input-number v-model:value="kpiSubmissionFilters.limit" :min="1" :max="50" style="width: 100%"
                        size="small" />
                </a-col>
                <a-col :xs="24" :sm="12" :md="8"> 
                    <label>{{ $t('recentKpisLimit') }}: </label>
                    <a-input-number v-model:value="kpiSubmissionFilters.recentKpisLimit" :min="0" :max="10"
                        style="width: 100%" size="small" />
                </a-col>
            </a-row>

            <a-row :gutter="[16, 16]">
                <a-col v-if="kpiSubmissionStatsError" :span="24">
                    <a-alert :message="$t('error')" :description="kpiSubmissionStatsError" type="error" show-icon />
                </a-col>
                <template v-if="!kpiSubmissionStatsError">
                    <a-col :span="24">
                        <a-skeleton :loading="isLoadingKpiSubmissionStats" active avatar :paragraph="{ rows: 5 }">
                            <a-list item-layout="vertical" :dataSource="kpiSubmissionStats"
                                v-if="kpiSubmissionStats.length > 0">
                                <template #renderItem="{ item, index }">
                                    <a-list-item>
                                        <div class="list-item-content">
                                            <div class="item-header"
                                                :class="{ 'expandable': kpiSubmissionFilters.recentKpisLimit > 0 }"
                                                @click="kpiSubmissionFilters.recentKpisLimit > 0 ? toggleKpiSubmissionExpand(item.id || index) : null">
                                                <span class="expand-icon"
                                                    v-if="kpiSubmissionFilters.recentKpisLimit > 0">
                                                    <down-outlined
                                                        v-if="isKpiSubmissionItemExpanded(item.id || index)" />
                                                    <right-outlined v-else />
                                                </span>
                                                <span class="item-title">{{ item.name }}</span>
                                                <span class="item-id"
                                                    v-if="kpiSubmissionFilters.entityType !== 'user' && item.id"> (ID:
                                                    {{ item.id }})</span>
                                                <span class="item-count"><strong>{{ item.count }}</strong> {{ $t('submissionCount') }}</span>
                                            </div>
                                            <div v-if="kpiSubmissionFilters.recentKpisLimit > 0 && isKpiSubmissionItemExpanded(item.id || index)"
                                                class="expanded-details">
                                                <div v-if="item.recentSubmittedKpis && item.recentSubmittedKpis.length > 0"
                                                    class="recent-kpis-list">
                                                    <small>{{ $t('recentSubmittedKpis', { count: item.recentSubmittedKpis.length }) }}</small>
                                                    <ul>
                                                        <li v-for="kpi_detail in item.recentSubmittedKpis"
                                                            :key="kpi_detail.kpiId">
                                                            <a-tooltip
                                                                :title="`${$t('submittedAt')}: ${new Date(kpi_detail.submittedAt).toLocaleString()}`"> 
                                                                {{ kpi_detail.kpiName }}
                                                            </a-tooltip>
                                                        </li>
                                                    </ul>
                                                </div>
                                                <div v-else class="recent-kpis-list">
                                                    <small>{{ $t('noRecentSubmittedKpis') }}</small>
                                                </div>
                                            </div>
                                            <div v-else-if="kpiSubmissionFilters.recentKpisLimit === 0 && isKpiSubmissionItemExpanded(item.id || index)"
                                                class="expanded-details recent-kpis-list">
                                                <small>{{ $t('setRecentKpisLimit') }}</small>
                                            </div>
                                        </div>
                                    </a-list-item>
                                </template>
                            </a-list>
                            <div v-else-if="!isLoadingKpiSubmissionStats && kpiSubmissionStats.length === 0"
                                class="empty-list">
                                {{ $t('noKpiSubmissionData') }}
                            </div>
                        </a-skeleton>
                    </a-col>
                </template>
            </a-row>
        </a-card>
        <!-- Chart for KPI Submission Stats -->
        <a-card v-if="!isLoadingKpiSubmissionStats && !kpiSubmissionStatsError && kpiSubmissionStats.length > 0"
            class="dashboard-card chart-card card-submission-stats">
            <div class="chart-container">
                <bar-chart :chart-data="kpiSubmissionChartData" :chart-options="kpiSubmissionChartOptions"
                    style="height: 350px;" />
            </div>
        </a-card>

        <!-- Các mục thống kê khác sẽ được thêm vào đây sau -->
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, watch, ref } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import { useRouter } from 'vue-router';
import {
    Alert as AAlert,
    Skeleton as ASkeleton,
    List as AList,
    Card as ACard,
    Row as ARow,
    Col as ACol,
    Tag as ATag,
    RadioGroup as ARadioGroup,
    RadioButton as ARadioButton,
    Select as ASelect,
    SelectOption as ASelectOption,
    InputNumber as AInputNumber
} from "ant-design-vue"; 
import BarChart from "@/core/components/common/BarChart.vue"; 
import { DownOutlined, RightOutlined } from '@ant-design/icons-vue';

const { t: $t } = useI18n();
const store = useStore();
const router = useRouter();


const topPendingApproversStats = computed(() => store.getters["dashboard/getTopPendingApproversStats"]);
const isLoadingTopPendingApprovers = computed(() => store.getters["loading/isLoading"]);
const topPendingApproversError = computed(() => store.getters["dashboard/getTopPendingApproversError"]);

const formatApproverType = (type) => {
    if (type === 'user') return $t('userOrGroup');
    if (type === 'department') return $t('department');
    if (type === 'section') return $t('section');
    return type;
};

const getApproverTypeColor = (type) => {
    if (type === 'user') return 'blue';
    if (type === 'department') return 'purple';
    if (type === 'section') return 'green';
    return 'default';
};

const expandedItemIds = ref(new Set()); 

const toggleExpand = (itemId, type) => {
  const key = `${type}_${itemId}`;
  if (expandedItemIds.value.has(key)) {
    expandedItemIds.value.delete(key);
  } else {
    expandedItemIds.value.add(key);
  }
};

const isExpanded = (itemId, type) => {
  const key = `${type}_${itemId}`;
  return expandedItemIds.value.has(key);
};



const kpiSubmissionFilters = reactive({
  entityType: 'user', 
  orderBy: 'most',    
  days: 30,
  limit: 5,
  recentKpisLimit: 3, 
});

const kpiSubmissionStats = computed(() => store.getters["dashboard/getKpiSubmissionStats"]);
const isLoadingKpiSubmissionStats = computed(() => store.getters["loading/isLoading"]);
const kpiSubmissionStatsError = computed(() => store.getters["dashboard/getKpiSubmissionStatsError"]);



const toggleKpiSubmissionExpand = (itemId) => {
  
  
  
  
  
  toggleExpand(itemId, 'submission');
};
const isKpiSubmissionItemExpanded = (itemId) => isExpanded(itemId, 'submission');

const entityTypeOptions = computed(() => [
  { label: $t('user'), value: 'user' },
  { label: $t('section'), value: 'section' },
  { label: $t('department'), value: 'department' },
]);

const orderByOptions = computed(() => [
  { label: $t('most'), value: 'most' },
  { label: $t('least'), value: 'least' },
]);

const daysOptions = [
  { label: $t('last7Days'), value: 7 },
  { label: $t('last30Days'), value: 30 },
  { label: $t('last90Days'), value: 90 },
];

function fetchKpiSubmissionData() {
  store.dispatch("dashboard/fetchKpiSubmissionStats", { ...kpiSubmissionFilters });
}

const navigateToApproval = (kpiValueId, kpiId) => {
  router.push({ 
      path: '/approvals', 
    query: { highlightKpiValueId: kpiValueId, kpiId: kpiId } 
  });
};


const topPendingApproversChartData = computed(() => {
  const labels = topPendingApproversStats.value.map(item => `${item.approverName} (${formatApproverType(item.approverType)})`);
  const data = topPendingApproversStats.value.map(item => item.pendingCount);
  
  const backgroundColors = [
    'rgba(114, 46, 209, 0.7)', 
    'rgba(133, 70, 215, 0.7)',
    'rgba(152, 94, 221, 0.7)',
    'rgba(171, 118, 227, 0.7)',
    'rgba(190, 142, 233, 0.7)',
    
  ];
  const borderColors = backgroundColors.map(color => color.replace('0.7', '1')); 

  return {
    labels: labels,
    datasets: [
      {
        label: $t('pendingKpiCountLabel'),
        backgroundColor: backgroundColors.slice(0, data.length), 
        borderColor: borderColors.slice(0, data.length),         
        borderWidth: 1,
        data: data,
        barThickness: 'flex', 
        maxBarThickness: 50,  
      },
    ],
  };
});

const topPendingApproversChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y', 
  plugins: {
    legend: {
      display: false, 
    },
    title: {
      display: true,
      text: $t('topPendingApproversChartTitle'),
      font: {
        size: 16
      }
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          return `${context.dataset.label}: ${context.parsed.x} ${$t('kpi')}`;
        }
      }
    }
  },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: $t('kpiCount') }},
    y: { ticks: { autoSkip: false } } 
  },
}));


const kpiSubmissionChartData = computed(() => {
  const labels = kpiSubmissionStats.value.map(item => item.name || $t('undefined'));
  const data = kpiSubmissionStats.value.map(item => item.count);

  
  const backgroundColors = [
    'rgba(24, 144, 255, 0.7)', 
    'rgba(82, 196, 26, 0.7)',  
    'rgba(250, 173, 20, 0.7)', 
    'rgba(245, 34, 45, 0.7)',  
    'rgba(114, 46, 209, 0.7)', 
    'rgba(217, 217, 217, 0.7)', 
  ];
  const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));

  return {
    labels: labels,
    datasets: [
      {
        label: $t('submissionCountLabel', { orderBy: kpiSubmissionFilters.orderBy === 'most' ? $t('most') : $t('least') }),
        backgroundColor: backgroundColors.slice(0, data.length),
        borderColor: borderColors.slice(0, data.length),
        borderWidth: 1,
        data: data,
        barThickness: 'flex',
        maxBarThickness: 50,
      },
    ],
  };
});

const kpiSubmissionChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y', 
  plugins: {
    legend: {
      display: true, 
      position: 'top',
    },
    title: {
      display: true,
      text: $t('kpiSubmissionChartTitle', { entityType: kpiSubmissionFilters.entityType === 'user' ? $t('user') : kpiSubmissionFilters.entityType === 'section' ? $t('section') : $t('department') }),
      font: { size: 16 }
    },
  },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: $t('submissionCount') } },
    y: { ticks: { autoSkip: false } }
  },
}));

watch(kpiSubmissionFilters, fetchKpiSubmissionData, { deep: true });

onMounted(() => {
    store.dispatch("dashboard/fetchTopPendingApproversStats", { limit: 10 }); 
    
    fetchKpiSubmissionData(); 
});
</script>

<style scoped>

.user-activity-statistics-container .ant-breadcrumb {
    margin-bottom: 16px;
}

.user-activity-statistics-container {
    padding: 24px;
}

.user-activity-statistics-container h1 {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 20px;
    color: #333;
    
}

.dashboard-card {
    margin-bottom: 20px;
    
    border: 1px solid #e8e8e8;
    
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
    
}


.dashboard-card {
    
    border-left: 5px solid #722ed1;
    
}

.dashboard-card:first-of-type :deep(.ant-card-head) {
    background-color: #f9f0ff;
}


.dashboard-card.card-submission-stats { 
    
    border-left: 5px solid #1890ff;
    
}

.dashboard-card.card-submission-stats :deep(.ant-card-head) {
    background-color: #e6f7ff;
}

.chart-card {
    padding-top: 10px;
}

.chart-container {
    position: relative;
    
}

.empty-list {
    padding: 20px;
    text-align: center;
    color: #888;
}

label {
    margin-right: 8px;
}

.list-item-content {
    width: 100%;
}

.item-header {
    display: flex;
    align-items: center;
    padding: 6px 0;
    
}

.item-header.expandable {
    cursor: pointer;
}

.expand-icon {
    margin-right: 8px;
    color: #1890ff;
    
}

.item-title {
    font-weight: 500;
    flex-grow: 1;
    
}

.item-id {
    font-size: 0.85em;
    
    color: #888;
    
    margin-left: 6px;
    margin-right: 12px;
}

.item-count {
    font-size: 0.95em;
    white-space: nowrap;
    
}

.expanded-details {
    padding-left: 24px;
    
    margin-top: 6px;
    
    border-top: 1px solid #f0f0f0;
    padding-top: 8px;
    
    padding-bottom: 3px;
    
}

.expanded-details .recent-kpis-list ul {
    list-style-type: none;
    padding-left: 0;
    margin-top: 8px;
    margin-bottom: 0;
}

.expanded-details .recent-kpis-list li {
    padding: 4px 0;
    display: flex;
    align-items: center;
    
}

.expanded-details .recent-kpis-list li::before {
    content: "•";
    
    color: #1890ff;
    
    margin-right: 8px;
    font-size: 1em;
}

.kpi-detail-info {
    display: flex;
    flex-direction: column;
    
}

.kpi-detail-name {
    font-weight: normal;
    font-size: 0.95em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 250px;
}

.kpi-detail-time {
    font-size: 0.8em;
    color: #888;
    margin-top: 2px;
}

.recent-kpis-list a {
    cursor: pointer;
    color: #1890ff;
}
</style>