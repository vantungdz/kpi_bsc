<template>
  <a-card :title="$t('inactiveKpiList')">
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
          {{ record.created_by?.first_name }} {{ record.created_by?.last_name }}
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
import { computed } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import { KpiDefinitionStatus } from "@/core/constants/kpiStatus";

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

function goToDetail(id) {
  router.push({ name: "KpiDetail", params: { id } });
}

function formatDate(date) {
  return date ? dayjs(date).format("YYYY-MM-DD HH:mm") : "";
}

function getKpiStatusText(status) {
  return $t(`kpiStatus.${status}`);
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
</script>
