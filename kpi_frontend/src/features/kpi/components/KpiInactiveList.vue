<template>
  <a-card v-if="canViewInactiveKpi" :title="$t('inactiveKpiList')">
    <a-table
      :columns="columns"
      :data-source="inactiveKpis"
      row-key="id"
      size="small"
      bordered
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <a @click="goToDetail(record.id)" style="font-weight: 500">
            {{ record.name }}
          </a>
        </template>
        <template v-else-if="column.key === 'target'">
          {{ Number(record.target).toLocaleString() }}
          <span v-if="record.unit">{{ record.unit }}</span>
        </template>
        <template v-else-if="column.key === 'createdBy'">
          {{ record.createdBy?.first_name }} {{ record.createdBy?.last_name }}
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDate(record.created_at) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="getKpiStatusColor(record.status)">
            {{ getKpiStatusText(record.status) }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-button size="small" @click="goToDetail(record.id)">
            {{ $t("viewDetail") }}
          </a-button>
        </template>
        <template v-else>
          <span>{{ record[column.dataIndex] }}</span>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import { KpiDefinitionStatus } from "@/core/constants/kpiStatus";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

const { t: $t } = useI18n();
const store = useStore();
const router = useRouter();

const kpiList = computed(() => store.getters["kpis/kpiList"] || []);
const inactiveKpis = computed(() =>
  kpiList.value.filter((kpi) => kpi.status !== KpiDefinitionStatus.APPROVED)
);

const columns = computed(() => [
  { title: $t("kpiName"), dataIndex: "name", key: "name" },
  { title: $t("unit"), dataIndex: "unit", key: "unit" },
  { title: $t("target"), dataIndex: "target", key: "target" },
  { title: $t("createdBy"), dataIndex: "createdBy", key: "createdBy" },
  { title: $t("createdAt"), dataIndex: "created_at", key: "createdAt" },
  { title: $t("status"), dataIndex: "status", key: "status" },
  { title: "", key: "actions" },
]);

onMounted(() => {
  store.dispatch("kpis/fetchKpis");
});

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
    case KpiDefinitionStatus.PENDING:
      return "orange";
    case KpiDefinitionStatus.REJECTED:
      return "red";
    case KpiDefinitionStatus.APPROVED:
      return "green";
    default:
      return "blue";
  }
}

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);
function hasPermission(action, resource) {
  return userPermissions.value?.some(
    (p) => p.action === action && p.resource === resource
  );
}
const canViewInactiveKpi = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_COMPANY) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_DEPARTMENT) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_SECTION) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_EMPLOYEE)
);
</script>
