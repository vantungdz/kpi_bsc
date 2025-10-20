<template>
  <div class="so-view-modern">
    <a-card class="so-header-card" bordered>
      <template #title>
        <div class="so-header-flex">
          <span style="display: flex; align-items: center; gap: 8px">
            <flag-outlined style="color: #2563eb; font-size: 22px" />
            <span>{{ $t("strategicObjectives") }}</span>
          </span>
          <a-button type="primary" @click="openCreateModal">
            <template #icon><PlusOutlined /></template>
            {{ $t("addStrategicObjective") }}
          </a-button>
        </div>
      </template>
      <a-alert
        v-if="state.error"
        type="error"
        :message="$t('error') + ': ' + state.error"
        show-icon
        style="margin-bottom: 16px"
      />
      <a-spin :spinning="state.loading">
        <a-table
          v-if="state.items.length"
          :dataSource="state.items"
          :columns="columns"
          :rowKey="'id'"
          bordered
          :pagination="{ pageSize: 8 }"
          class="so-table-modern"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'index'">
              {{ index + 1 }}
            </template>
            <template v-else-if="column.key === 'name'">
              <div class="so-name">{{ record.name }}</div>
              <div class="so-desc">{{ record.description }}</div>
            </template>
            <template v-else-if="column.key === 'perspective'">
              <a-tag color="#2db7f5">{{ record.perspective?.name }}</a-tag>
            </template>
            <template v-else-if="column.key === 'kpis'">
              <template v-if="(record.kpis || []).length">
                <a-tag
                  v-for="kpi in record.kpis || []"
                  :key="kpi.id"
                  color="#108ee9"
                  >{{ kpi.name }}</a-tag
                >
              </template>
              <span v-else>-</span>
            </template>
            <template v-else-if="column.key === 'progress'">
              <a-progress
                :percent="record.progress"
                size="small"
                :status="record.progress === 100 ? 'success' : 'active'"
              />
            </template>
            <template v-else-if="column.key === 'time'">
              <span v-if="record.startDate || record.endDate">
                <a-tag color="#108ee9" v-if="record.startDate">{{
                  formatDate(record.startDate)
                }}</a-tag>
                <span
                  v-if="record.startDate && record.endDate"
                  style="margin: 0 4px"
                  >→</span
                >
                <a-tag color="#faad14" v-if="record.endDate">{{
                  formatDate(record.endDate)
                }}</a-tag>
              </span>
              <span v-else>-</span>
            </template>
            <template v-else-if="column.key === 'isActive'">
              <a-tag :color="record.isActive ? 'green' : 'red'">
                {{ record.isActive ? $t("active") : $t("inactive") }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-button size="small" @click="openEditModal(record)"
                  ><edit-outlined /> {{ $t("edit") }}</a-button
                >
                <a-button size="small" @click="openDetailModal(record)"
                  ><info-circle-outlined /> {{ $t("detail") }}</a-button
                >
                <a-popconfirm
                  :title="$t('confirmDelete', { name: record.name })"
                  @confirm="() => remove(record.id)"
                >
                  <a-button size="small" danger
                    ><delete-outlined /> {{ $t("delete") }}</a-button
                  >
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
        <a-empty
          v-else
          :description="$t('noStrategicObjectives')"
          style="margin: 40px 0"
        />
      </a-spin>
    </a-card>

    <!-- Modal tạo/sửa mục tiêu -->
    <a-modal
      v-model:open="showModal"
      :title="
        isEdit ? $t('editStrategicObjective') : $t('addStrategicObjective')
      "
      @ok="isEdit ? submitEdit() : submit()"
      @cancel="closeModal"
      :okText="isEdit ? $t('update') : $t('save')"
      :cancelText="$t('cancel')"
      :confirmLoading="modalLoading"
      destroyOnClose
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('strategicObjectiveName')" required>
          <a-input
            v-model:value="form.name"
            :placeholder="$t('enterStrategicObjectiveName')"
          />
        </a-form-item>
        <a-form-item :label="$t('description')">
          <a-textarea
            v-model:value="form.description"
            :placeholder="$t('descriptionPlaceholder')"
            auto-size
          />
        </a-form-item>
        <a-form-item :label="$t('perspective')" required>
          <a-select
            v-model:value="form.perspectiveId"
            :placeholder="$t('selectPerspective')"
          >
            <a-select-option
              v-for="perspective in perspectiveList"
              :key="perspective.id"
              :value="perspective.id"
            >
              {{ perspective.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('linkedKpis')">
          <a-select
            v-model:value="form.kpiIds"
            mode="multiple"
            :options="kpiOptions"
            :placeholder="$t('selectLinkedKpis')"
            :loading="loadingKpis"
            show-search
            option-filter-prop="label"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="$t('startDate')">
          <a-date-picker
            v-model:value="form.startDate"
            style="width: 100%"
            format="YYYY-MM-DD"
          />
        </a-form-item>
        <a-form-item :label="$t('endDate')">
          <a-date-picker
            v-model:value="form.endDate"
            style="width: 100%"
            format="YYYY-MM-DD"
          />
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="form.isActive">{{
            $t("active")
          }}</a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Modal chi tiết mục tiêu chiến lược -->
    <a-modal
      v-model:open="detailModal"
      :title="$t('strategicObjectiveDetail')"
      @cancel="closeDetailModal"
      :footer="null"
      width="70%"
    >
      <template v-if="detailRecord">
        <div class="so-detail-modal-flex">
          <!-- Cột trái: Thông tin mục tiêu -->
          <div class="so-detail-info">
            <div class="so-detail-title-row">
              <span class="so-detail-title-main">{{ detailRecord.name }}</span>
              <a-tag
                :color="detailRecord.isActive ? 'green' : 'red'"
                class="so-detail-status"
              >
                {{ detailRecord.isActive ? $t("active") : $t("inactive") }}
              </a-tag>
            </div>
            <div class="so-detail-desc">{{ detailRecord.description }}</div>
            <div class="so-detail-meta">
              <div>
                <span class="so-detail-meta-label"
                  >{{ $t("perspective") }}:</span
                >
                <b>{{ detailRecord.perspective?.name }}</b>
              </div>
              <div>
                <span class="so-detail-meta-label">{{ $t("time") }}:</span>
                <a-tag color="#108ee9" v-if="detailRecord.startDate">{{
                  formatDate(detailRecord.startDate)
                }}</a-tag>
                <span
                  v-if="detailRecord.startDate && detailRecord.endDate"
                  class="so-detail-arrow"
                  >→</span
                >
                <a-tag color="#faad14" v-if="detailRecord.endDate">{{
                  formatDate(detailRecord.endDate)
                }}</a-tag>
              </div>
            </div>
          </div>
          <!-- Cột phải: Tiến độ tổng thể + bảng KPI -->
          <div class="so-detail-progress-block">
            <div class="so-detail-progress-label">
              {{ $t("objectiveProgress") }}
            </div>
            <div class="so-detail-progress-bar">
              <a-progress
                :percent="detailRecord.progress"
                :show-info="true"
                stroke-width="16"
                :status="detailRecord.progress === 100 ? 'success' : 'active'"
              />
              <template
                v-if="
                  detailRecord.warningLevel &&
                  detailRecord.warningLevel !== 'none'
                "
              >
                <a-alert
                  :type="
                    detailRecord.warningLevel === 'danger' ? 'error' : 'warning'
                  "
                  :message="detailRecord.warningMessage"
                  show-icon
                  style="margin-top: 8px"
                />
              </template>
            </div>
            <div class="so-detail-kpi-table-block">
              <div class="so-detail-kpi-table-title">
                {{ $t("linkedKpisList") }}
              </div>
              <a-table
                :dataSource="detailRecord.kpis || []"
                :pagination="false"
                :columns="kpiDetailColumns"
                rowKey="id"
                size="small"
                class="so-detail-kpi-table"
                style="margin: 8px 0 0 0"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'progress'">
                    <div style="display: flex; align-items: center; gap: 6px">
                      <a-progress
                        :percent="calcKpiProgress(record)"
                        size="small"
                        :show-info="true"
                        :status="
                          calcKpiProgress(record) === 100 ? 'success' : 'active'
                        "
                        style="width: 90px; margin: 0 auto"
                      />
                      <a-tooltip
                        v-if="
                          record.warningLevel && record.warningLevel !== 'none'
                        "
                      >
                        <template #title>{{ record.warningMessage }}</template>
                        <a-icon
                          :type="
                            record.warningLevel === 'danger'
                              ? 'exclamation-circle'
                              : 'info-circle'
                          "
                          :style="{
                            color:
                              record.warningLevel === 'danger'
                                ? '#ff4d4f'
                                : '#faad14',
                            fontSize: '18px',
                          }"
                        />
                      </a-tooltip>
                    </div>
                  </template>
                  <template v-else-if="column.key === 'actual_value'">
                    <span class="so-kpi-value"
                      >{{
                        Number(record.actual_value).toLocaleString() ?? "-"
                      }}
                      {{ record.unit }}</span
                    >
                  </template>
                  <template v-else-if="column.key === 'target'">
                    <span class="so-kpi-target"
                      >{{ Number(record.target).toLocaleString() ?? "-" }}
                      {{ record.unit }}</span
                    >
                  </template>
                  <template v-else-if="column.key === 'name'">
                    <span class="so-kpi-name">{{ record.name }}</span>
                  </template>
                </template>
              </a-table>
            </div>
          </div>
        </div>
      </template>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, h } from "vue";
import { useStore } from "vuex";
import {
  PlusOutlined,
  FlagOutlined,
  EditOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons-vue";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";

const { t: $t } = useI18n();
const store = useStore();
const showModal = ref(false);
const isEdit = ref(false);
const modalLoading = ref(false);
const form = reactive({
  name: "",
  description: "",
  perspectiveId: "",
  kpiIds: [],
  startDate: "",
  endDate: "",
  isActive: true,
});
const editId = ref(null);
const perspectiveList = computed(
  () => store.getters["perspectives/perspectiveList"] || []
);
const state = computed(() => store.state.strategicObjectives).value;

const loadingKpis = ref(false);
const kpiOptions = computed(() =>
  (store.getters["kpis/kpiListAll"] || []).map((kpi) => ({
    label: kpi.name,
    value: kpi.id,
  }))
);

const columns = computed(() => [
  { title: $t("strategicObjectiveName"), key: "name" },
  { title: $t("perspective"), key: "perspective" },
  { title: $t("linkedKpis"), key: "kpis", width: 140 },
  { title: $t("objectiveProgress"), key: "progress", width: 200 },
  { title: $t("time"), key: "time", width: 230 },
  { title: $t("status"), key: "isActive", width: 100 },
  { title: $t("common.actions"), key: "actions", width: 200 },
]);

const kpiDetailColumns = computed(() => [
  { title: $t("kpiName"), dataIndex: "name", key: "name" },
  {
    title: $t("actualValue"),
    key: "actual_value",
    customRender: ({ record }) => record.actual_value ?? "-",
  },
  {
    title: $t("target"),
    key: "target",
    customRender: ({ record }) => record.target ?? "-",
  },
  {
    title: $t("objectiveProgress"),
    key: "progress",
    customRender: ({ record }) =>
      h("a-progress", {
        percent: calcKpiProgress(record),
        size: "small",
        status: calcKpiProgress(record) === 100 ? "success" : "active",
        style: "width:100px;",
      }),
  },
]);

function formatDate(date) {
  if (!date) return "";
  return dayjs(date).format("DD/MM/YYYY");
}

function openCreateModal() {
  isEdit.value = false;
  resetForm();
  showModal.value = true;
}
function openEditModal(item) {
  isEdit.value = true;
  editId.value = item.id;
  Object.assign(form, {
    name: item.name,
    description: item.description,
    perspectiveId: item.perspective?.id,
    kpiIds: (item.kpis || []).map((k) => k.id),
    startDate: item.startDate ? dayjs(item.startDate) : "",
    endDate: item.endDate ? dayjs(item.endDate) : "",
    isActive: item.isActive,
  });
  showModal.value = true;
}
const detailModal = ref(false);
const detailRecord = ref(null);
function openDetailModal(record) {
  detailRecord.value = record;
  detailModal.value = true;
}
function closeDetailModal() {
  detailModal.value = false;
  detailRecord.value = null;
}
function closeModal() {
  showModal.value = false;
  resetForm();
}
function resetForm() {
  form.name = "";
  form.description = "";
  form.perspectiveId = "";
  form.kpiIds = [];
  form.startDate = "";
  form.endDate = "";
  form.isActive = true;
}
async function submit() {
  modalLoading.value = true;
  try {
    const payload = {
      ...form,
      kpiIds: form.kpiIds,
      startDate: form.startDate
        ? dayjs(form.startDate).format("YYYY-MM-DD")
        : "",
      endDate: form.endDate ? dayjs(form.endDate).format("YYYY-MM-DD") : "",
    };
    await store.dispatch(
      "strategicObjectives/createStrategicObjective",
      payload
    );
    await store.dispatch("strategicObjectives/fetchStrategicObjectives");
    closeModal();
  } catch (e) {
    console.error(e);
  } finally {
    modalLoading.value = false;
  }
}
async function submitEdit() {
  modalLoading.value = true;
  try {
    const payload = {
      ...form,
      kpiIds: form.kpiIds,
      startDate: form.startDate
        ? dayjs(form.startDate).format("YYYY-MM-DD")
        : "",
      endDate: form.endDate ? dayjs(form.endDate).format("YYYY-MM-DD") : "",
    };
    await store.dispatch("strategicObjectives/updateStrategicObjective", {
      id: editId.value,
      data: payload,
    });
    closeModal();
    await store.dispatch("strategicObjectives/fetchStrategicObjectives");
  } catch (e) {
    console.error("[StrategicObjectivesView][submitEdit] ERROR:", e);
  } finally {
    modalLoading.value = false;
  }
}
async function remove(id) {
  await store.dispatch("strategicObjectives/deleteStrategicObjective", id);
}
function calcKpiProgress(kpi) {
  if (typeof kpi.progress === "number") return kpi.progress;
  const actual =
    typeof kpi.actual_value === "string"
      ? parseFloat(kpi.actual_value)
      : kpi.actual_value;
  const target =
    typeof kpi.target === "string" ? parseFloat(kpi.target) : kpi.target;
  if (typeof actual === "number" && typeof target === "number" && target > 0) {
    return Math.min(100, Math.round((actual / target) * 100));
  }
  return 0;
}
onMounted(async () => {
  await store.dispatch("perspectives/fetchPerspectives");
  await store.dispatch("strategicObjectives/fetchStrategicObjectives");
  loadingKpis.value = true;
  await store.dispatch("kpis/fetchAllKpisForSelect");
  loadingKpis.value = false;
});
</script>

<style scoped>
.so-view-modern {
  background: #f6f8fa;
  min-height: auto;
}
.so-header-card {
  margin: 32px auto 0 auto;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.so-table-modern .ant-table-thead > tr > th {
  background: #f1f5f9;
  font-weight: 600;
  font-size: 15px;
  color: #334155;
  border-bottom: 1.5px solid #e5e7eb;
}
.so-table-modern .ant-table-tbody > tr > td {
  font-size: 14px;
  color: #22223b;
  padding: 8px 12px;
}
.so-name {
  font-weight: 600;
  color: #222;
}
.so-desc {
  color: #888;
  font-size: 13px;
  margin-top: 2px;
}
.so-detail-modal-flex {
  display: flex;
  gap: 32px;
  padding: 8px 0 0 0;
  background: #fff;
}
.so-detail-info {
  flex: 1.2;
  min-width: 260px;
  padding-right: 12px;
}
.so-detail-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.so-detail-title-main {
  font-size: 26px;
  font-weight: 700;
  color: #222;
}
.so-detail-status {
  font-size: 15px;
  font-weight: 500;
  padding: 0 12px;
}
.so-detail-desc {
  color: #555;
  font-size: 15px;
  margin-bottom: 12px;
}
.so-detail-meta {
  font-size: 15px;
  color: #444;
  margin-bottom: 8px;
}
.so-detail-meta-label {
  color: #888;
  font-weight: 500;
  margin-right: 4px;
}
.so-detail-arrow {
  margin: 0 6px;
  color: #888;
}
.so-detail-progress-block {
  flex: 1.5;
  min-width: 320px;
  background: #f8fafd;
  border-radius: 12px;
  box-shadow: 0 2px 12px #0001;
  padding: 18px 22px 18px 22px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
}
.so-detail-progress-label {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #222;
}
.so-detail-progress-bar {
  width: 100%;
  margin-bottom: 18px;
}
.so-detail-kpi-table-block {
  width: 100%;
}
.so-detail-kpi-table-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #222;
}
.so-detail-kpi-table {
  border-radius: 8px;
  box-shadow: 0 2px 8px #0001;
  background: #fff;
}
.so-kpi-name {
  font-weight: 500;
  color: #222;
}
.so-kpi-value {
  color: #1a73e8;
  font-weight: 600;
}
.so-kpi-target {
  color: #faad14;
  font-weight: 600;
}
.so-header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
</style>
