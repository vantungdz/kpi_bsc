<template>
  <div class="personal-goal-page">
    <a-card class="goal-header-card" bordered>
      <div class="goal-header">
        <div>
          <h3 class="goal-title">🎯 {{ $t("personalGoal.titleHeader") }}</h3>
          <p class="goal-desc">{{ $t("personalGoal.descHeader") }}</p>
        </div>
        <a-button type="primary" size="middle" @click="openAddModal">
          <i class="fas fa-plus-circle" style="margin-right: 8px" />{{
            $t("personalGoal.addNew")
          }}
        </a-button>
      </div>
    </a-card>
    <a-card class="goal-list-card" bordered>
      <a-table
        :columns="columns"
        :dataSource="goals"
        :loading="loading"
        rowKey="id"
        bordered
        :pagination="{ pageSize: 8 }"
        class="goal-table"
        size="middle"
        :scroll="{ x: 900 }"
        :emptyText="$t('personalGoal.emptyText')"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{
              statusText(record.status)
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'progress'">
            <a-progress
              :percent="progressPercent(record)"
              :status="
                record.status === 'completed'
                  ? 'success'
                  : record.status === 'cancelled'
                    ? 'exception'
                    : 'active'
              "
              :show-info="true"
              strokeColor="#52c41a"
              style="min-width: 120px"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <a
              @click="openEditModal(record)"
              style="
                color: #1677ff;
                font-weight: 500;
                margin-right: 16px;
                cursor: pointer;
              "
            >
              <i class="fas fa-edit" /> {{ $t("edit") }}
            </a>
            <a-popconfirm
              :title="$t('personalGoal.confirmDelete')"
              :ok-text="$t('delete')"
              :cancel-text="$t('cancel')"
              @confirm="onDelete(record)"
            >
              <a style="color: red; font-weight: 500; cursor: pointer"
                ><i class="fas fa-trash-alt" /> {{ $t("delete") }}</a
              >
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>
    <a-modal
      v-model:open="showModal"
      :title="
        isEditMode ? $t('personalGoal.editTitle') : $t('personalGoal.addTitle')
      "
      @ok="handleOk"
      @cancel="handleCancel"
      :confirmLoading="saving"
      width="540px"
      class="goal-modal"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item :label="$t('personalGoal.name')" required>
          <a-input
            v-model:value="form.title"
            :placeholder="$t('personalGoal.namePlaceholder')"
          />
          <div class="input-desc">{{ $t("personalGoal.nameDesc") }}</div>
        </a-form-item>
        <a-form-item :label="$t('personalGoal.description')">
          <a-textarea
            v-model:value="form.description"
            :placeholder="$t('personalGoal.descriptionPlaceholder')"
            auto-size
          />
          <div class="input-desc">{{ $t("personalGoal.descriptionDesc") }}</div>
        </a-form-item>
        <a-form-item :label="$t('personalGoal.kpiLinked')" required>
          <a-select
            v-model:value="form.kpiIds"
            :options="kpiOptions"
            allow-clear
            mode="multiple"
            :placeholder="$t('personalGoal.kpiLinkedPlaceholder')"
            @change="onKpiChange"
          />
          <div class="input-desc">{{ $t("personalGoal.kpiLinkedDesc") }}</div>
        </a-form-item>
        <a-form-item :label="$t('personalGoal.targetValue')">
          <a-input
            v-model:value="form.targetValue"
            style="width: 100%"
            :placeholder="$t('personalGoal.targetValuePlaceholder')"
            @input="(event) => handleNumericInput('targetValue', event)"
          />
          <div class="input-desc">{{ $t("personalGoal.targetValueDesc") }}</div>
        </a-form-item>
        <a-form-item :label="$t('personalGoal.timeRange')">
          <div class="date-range-row">
            <a-date-picker
              v-model:value="form.startDate"
              :placeholder="$t('personalGoal.startDate')"
              style="width: 48%"
            />
            <span class="date-range-sep">-</span>
            <a-date-picker
              v-model:value="form.endDate"
              :placeholder="$t('personalGoal.endDate')"
              style="width: 48%"
            />
          </div>
          <div class="input-desc">{{ $t("personalGoal.timeRangeDesc") }}</div>
        </a-form-item>
        <a-form-item :label="$t('personalGoal.status')">
          <a-select v-model:value="form.status" :options="statusOptions" />
          <div class="input-desc">{{ $t("personalGoal.statusDesc") }}</div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";
import { message } from "ant-design-vue";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";

const { t: $t } = useI18n();

const store = useStore();
const showModal = ref(false);
const saving = ref(false);
const isEditMode = ref(false);
const editingId = ref(null);

const form = ref({
  title: "",
  description: "",
  kpiIds: [],
  targetValue: null,
  startDate: null,
  endDate: null,
  status: "not_started",
});

const columns = computed(() => [
  {
    title: $t("personalGoal.name"),
    dataIndex: "title",
    key: "title",
    width: 180,
  },
  {
    title: $t("personalGoal.description"),
    dataIndex: "description",
    key: "description",
    width: 200,
  },
  {
    title: $t("personalGoal.kpiLinked"),
    dataIndex: "kpiIds",
    key: "kpiIds",
    width: 180,
    customRender: ({ text }) =>
      Array.isArray(text)
        ? text
            .map((id) => kpiOptions.value.find((k) => k.value === id)?.label)
            .filter(Boolean)
            .join(", ")
        : "",
  },
  {
    title: $t("personalGoal.targetValue"),
    dataIndex: "targetValue",
    key: "targetValue",
    width: 110,
    customRender: ({ text }) => {
      if (!text && text !== 0) return "";
      const num = typeof text === "number" ? text : parseFloat(text);
      if (isNaN(num)) return text;
      return num.toLocaleString("vi-VN");
    },
  },
  { title: $t("personalGoal.progress"), key: "progress", width: 140 },
  {
    title: $t("personalGoal.timeRange"),
    key: "time",
    width: 150,
    customRender: ({ record }) =>
      `${record.startDate || ""} - ${record.endDate || ""}`,
  },
  { title: $t("personalGoal.status"), key: "status", width: 110 },
  { title: $t("common.actions"), key: "action", width: 110 },
]);

const goals = computed(() => store.getters["personalGoal/personalGoals"]);
const loading = computed(
  () => store.getters["personalGoal/personalGoalLoading"]
);

const statusOptions = computed(() => [
  { label: $t("personalGoal.statusNotStarted"), value: "not_started" },
  { label: $t("personalGoal.statusInProgress"), value: "in_progress" },
  { label: $t("personalGoal.statusCompleted"), value: "completed" },
  { label: $t("personalGoal.statusCancelled"), value: "cancelled" },
]);

function statusText(status) {
  return statusOptions.value.find((s) => s.value === status)?.label || status;
}
function statusColor(status) {
  switch (status) {
    case "completed":
      return "green";
    case "in_progress":
      return "blue";
    case "cancelled":
      return "red";
    default:
      return "gray";
  }
}

const kpiOptions = computed(() => {
  const myAssignments = store.getters["kpis/myAssignments"] || [];

  if (!form.value.kpiIds || form.value.kpiIds.length === 0) {
    return myAssignments.map((k) => ({
      label: k.name + (k.unit ? ` (${k.unit})` : ""),
      value: k.id,
      unit: k.unit,
    }));
  }

  const firstUnit = myAssignments.find(
    (k) => k.id === form.value.kpiIds[0]
  )?.unit;
  return myAssignments
    .filter((k) => k.unit === firstUnit)
    .map((k) => ({
      label: k.name + (k.unit ? ` (${k.unit})` : ""),
      value: k.id,
      unit: k.unit,
    }));
});

function onKpiChange(selected) {
  if (!selected || selected.length === 0) return;
  const myAssignments = store.getters["kpis/myAssignments"] || [];
  const units = selected
    .map((id) => myAssignments.find((k) => k.id === id)?.unit)
    .filter(Boolean);
  const uniqueUnits = Array.from(new Set(units));
  if (uniqueUnits.length > 1) {
    message.error($t("personalGoal.msgKpiUnitOnly"));

    const firstUnit = units[0];
    const filtered = selected.filter(
      (id) => myAssignments.find((k) => k.id === id)?.unit === firstUnit
    );
    form.value.kpiIds = filtered;
  }
}

onMounted(() => {
  store.dispatch("personalGoal/fetchPersonalGoals");

  const userId = store.getters["auth/user"]?.id;
  if (userId) {
    store.dispatch("kpis/fetchMyAssignments", userId);
  }
});

function openAddModal() {
  isEditMode.value = false;
  editingId.value = null;
  form.value = {
    title: "",
    description: "",
    kpiIds: [],
    targetValue: null,
    startDate: null,
    endDate: null,
    status: "not_started",
  };
  showModal.value = true;
}

function openEditModal(record) {
  isEditMode.value = true;
  editingId.value = record.id;

  // Format targetValue for display
  let formattedTargetValue = record.targetValue;
  if (formattedTargetValue && typeof formattedTargetValue === "number") {
    formattedTargetValue = formattedTargetValue
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  form.value = {
    title: record.title,
    description: record.description,
    kpiIds: Array.isArray(record.kpiIds)
      ? record.kpiIds
      : record.kpiId
        ? [record.kpiId]
        : [],
    targetValue: formattedTargetValue,
    startDate: record.startDate ? dayjs(record.startDate) : null,
    endDate: record.endDate ? dayjs(record.endDate) : null,
    status: record.status,
  };
  showModal.value = true;
}

const handleNumericInput = (field, event) => {
  let value = event.target.value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }

  const [intPart, decPart] = value.split(".");
  let formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decPart !== undefined) formatted += "." + decPart;
  form.value[field] = formatted;
};

const parseNumber = (value) => {
  if (typeof value === "number") return value;
  if (!value || value === "") return null;

  const cleaned = String(value).replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
};

function handleOk() {
  if (!form.value.title) {
    message.error($t("personalGoal.msgEnterName"));
    return;
  }
  saving.value = true;

  const payload = { ...form.value };
  // Parse targetValue to remove formatting before sending to server
  payload.targetValue = parseNumber(payload.targetValue);
  payload.startDate = payload.startDate
    ? dayjs(payload.startDate).format("DD-MM-YYYY")
    : null;
  payload.endDate = payload.endDate
    ? dayjs(payload.endDate).format("DD-MM-YYYY")
    : null;
  if (isEditMode.value) {
    store
      .dispatch("personalGoal/updatePersonalGoal", {
        id: editingId.value,
        data: payload,
      })
      .then(() => {
        message.success($t("personalGoal.msgUpdateSuccess"));
        showModal.value = false;
      })
      .catch((err) => {
        message.error($t("personalGoal.msgError"));
        console.error("Update personal goal error:", err);
      })
      .finally(() => (saving.value = false));
  } else {
    store
      .dispatch("personalGoal/addPersonalGoal", payload)
      .then(() => {
        message.success($t("personalGoal.msgAddSuccess"));
        showModal.value = false;
      })
      .catch((err) => {
        message.error($t("personalGoal.msgError"));
        console.error("Add personal goal error:", err);
      })
      .finally(() => (saving.value = false));
  }
}

function handleCancel() {
  showModal.value = false;
  isEditMode.value = false;
  editingId.value = null;
  saving.value = false;
}

function onDelete(record) {
  store
    .dispatch("personalGoal/deletePersonalGoal", record.id)
    .then(() => message.success($t("personalGoal.msgDeleteSuccess")))
    .catch(() => message.error($t("personalGoal.msgDeleteError")));
}

function progressPercent(record) {
  return typeof record.progress === "number" ? Math.round(record.progress) : 0;
}
</script>

<style scoped>
.personal-goal-page {
  padding: 24px;
  background: #f0f2f5;
}

.goal-header-card {
  margin-bottom: 24px;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.goal-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.goal-desc {
  margin: 8px 0 0 30px;
  font-size: 14px;
  color: #666;
}

.goal-list-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.goal-table {
  min-width: 800px;
}

.date-range-row {
  display: flex;
  justify-content: space-between;
}

.date-range-sep {
  align-self: center;
  font-size: 18px;
  color: #999;
}

.input-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>
