<template>
  <a-card
    :headStyle="{
      background: '#fffbe6',
      borderRadius: '8px 8px 0 0',
      border: 'none',
    }"
    :bodyStyle="{
      padding: '16px',
      borderRadius: '0 0 8px 8px',
      background: '#fff',
    }"
    style="box-shadow: 0 2px 8px #0001; border-radius: 8px"
  >
    <template #title>
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <span style="display: flex; align-items: center; gap: 8px">
          <inbox-outlined style="color: #faad14; font-size: 20px" />
          <span>{{ $t("inactiveKpiList") }}</span>
        </span>
        <a-space>
          <a-button
            type="primary"
            :disabled="selectedKpiIds.length === 0"
            :loading="submitting"
            @click="handleBulkSubmit"
          >
            {{ $t("submitSelected") }} ({{ selectedKpiIds.length }})
          </a-button>
        </a-space>
      </div>
    </template>
    <a-table
      :columns="columns"
      :data-source="inactiveKpis"
      :row-selection="rowSelection"
      row-key="id"
      size="middle"
      bordered
      :pagination="false"
      class="kpi-table-modern"
      :scroll="{ x: 900 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <a
            @click="goToDetail(record.id)"
            style="font-weight: 500; color: #1890ff"
          >
            {{ record.name }}
          </a>
        </template>
        <template v-else-if="column.key === 'target'">
          <div style="text-align: right">
            {{ Number(record.target).toLocaleString()
            }}<span v-if="record.unit"> {{ record.unit }}</span>
          </div>
        </template>
        <template v-else-if="column.key === 'createdBy'">
          <a-avatar
            v-if="record.createdBy?.avatar"
            :src="record.createdBy.avatar"
            size="28"
            style="margin-right: 8px; vertical-align: middle"
          />
          <a-avatar
            v-else
            style="
              background: #f56a00;
              margin-right: 8px;
              vertical-align: middle;
            "
            size="28"
          >
            {{ record.createdBy?.first_name?.[0] || "?" }}
          </a-avatar>
          <span style="vertical-align: middle">
            {{ $getFullName(record.createdBy) }}
          </span>
        </template>
        <template v-else-if="column.key === 'createdAt'">
          <span style="color: #888">{{ formatDate(record.created_at) }}</span>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag
            :color="getKpiStatusColor(record.status)"
            class="goal-status-tag"
            style="font-weight: 500; font-size: 13px"
          >
            {{ getKpiStatusText(record.status) }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'actions'">
          <div style="text-align: center">
            <a-tooltip :title="$t('viewDetail')">
              <a-button
                size="small"
                type="default"
                @click="goToDetail(record.id)"
              >
                <schedule-outlined /> {{ $t("viewDetail") }}
              </a-button>
            </a-tooltip>
          </div>
        </template>
        <template v-else>
          <span>{{ record[column.dataIndex] }}</span>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import { KpiDefinitionStatus } from "@/core/constants/kpiStatus";
import { InboxOutlined, ScheduleOutlined } from "@ant-design/icons-vue";

const { t: $t } = useI18n();
const store = useStore();
const router = useRouter();
const selectedKpiIds = ref([]);
const submitting = ref(false);

const currentUser = computed(() => store.getters["auth/user"]);
const kpiList = computed(() => store.getters["kpis/kpiList"] || []);
const inactiveKpis = computed(() =>
  kpiList.value.filter(
    (kpi) =>
      kpi.status !== KpiDefinitionStatus.APPROVED &&
      kpi.createdBy?.id === currentUser.value?.id,
  ),
);

/** Lọc KPI theo chu kỳ đánh giá trên header (cùng logic date range với danh sách KPI công ty). */
async function loadInactiveKpisForSelectedCycle() {
  if (!store.getters["auth/isAuthenticated"]) return;
  const params = { limit: 1000 };
  const cycleId = store.getters["reviewCycle/selectedCycleId"];
  const cycles = store.getters["reviewCycle/cycles"] || [];
  if (cycleId != null && cycleId !== "") {
    const selectedCycle = cycles.find(
      (c) =>
        String(c.id) === String(cycleId) || Number(c.id) === Number(cycleId),
    );
    if (selectedCycle) {
      params.start_date = dayjs(
        selectedCycle.startDate || selectedCycle.start_date,
      ).format("YYYY-MM-DD");
      params.end_date = dayjs(
        selectedCycle.endDate || selectedCycle.end_date,
      ).format("YYYY-MM-DD");
    }
  }
  await store.dispatch("kpis/fetchKpis", params);
}

const columns = computed(() => [
  { title: $t("kpiName"), dataIndex: "name", key: "name" },
  { title: $t("unit"), dataIndex: "unit", key: "unit" },
  { title: $t("target"), dataIndex: "target", key: "target" },
  { title: $t("createdBy"), dataIndex: "createdBy", key: "createdBy" },
  { title: $t("createdAt"), dataIndex: "created_at", key: "createdAt" },
  { title: $t("status"), dataIndex: "status", key: "status" },
  { title: "", key: "actions" },
]);

onMounted(async () => {
  if (!store.state.reviewCycle?.loaded) {
    await store.dispatch("reviewCycle/fetchCycles");
  }
  await loadInactiveKpisForSelectedCycle();
});

watch(
  () => store.getters["reviewCycle/selectedCycleId"],
  async () => {
    selectedKpiIds.value = [];
    await loadInactiveKpisForSelectedCycle();
  },
);

function goToDetail(id) {
  router.push({ name: "KpiDetail", params: { id } });
}

function formatDate(date) {
  return date ? dayjs(date).format("YYYY-MM-DD HH:mm") : "";
}

function getKpiStatusText(status) {
  return $t(`status_chart.${status}`);
}

function getKpiStatusColor(status) {
  switch (status) {
    case KpiDefinitionStatus.DRAFT:
      return "default";
    case KpiDefinitionStatus.PENDING_APPROVAL:
      return "processing";
    case KpiDefinitionStatus.REJECTED:
      return "red";
    case KpiDefinitionStatus.APPROVED:
      return "green";
    default:
      return "blue";
  }
}

const rowSelection = computed(() => ({
  selectedRowKeys: selectedKpiIds.value,
  onChange: (selectedRowKeys) => {
    selectedKpiIds.value = selectedRowKeys;
  },
  getCheckboxProps: (record) => ({
    disabled: record.status !== KpiDefinitionStatus.DRAFT,
  }),
}));

const handleBulkSubmit = async () => {
  if (selectedKpiIds.value.length === 0) return;

  submitting.value = true;
  try {
    await store.dispatch("kpis/bulkSubmitKpis", selectedKpiIds.value);
    selectedKpiIds.value = [];
    await loadInactiveKpisForSelectedCycle();
  } catch (error) {
    console.error("Error submitting KPIs:", error);
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.kpi-table-modern .ant-table {
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.kpi-table-modern .ant-table-thead > tr > th {
  background: #fffbe6;
  font-weight: 600;
  font-size: 15px;
  text-align: center;
  border-bottom: 1px solid #ffe58f;
}
.kpi-table-modern .ant-table-tbody > tr > td {
  padding: 10px 8px;
  font-size: 14px;
  vertical-align: middle;
}
.kpi-table-modern .ant-table-tbody > tr:hover > td {
  background: #fafafa;
}
.goal-status-tag {
  border-radius: 6px;
  padding: 2px 12px;
}
</style>
