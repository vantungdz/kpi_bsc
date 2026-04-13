<template>
  <div class="audit-log-view-modern">
    <LoadingOverlay :visible="loading" />
    <a-card class="audit-header-card" bordered>
      <template #title>
        <span style="display: flex; align-items: center; gap: 8px">
          <file-search-outlined style="color: #2563eb; font-size: 22px" />
          <span>Audit Log</span>
        </span>
      </template>
      <a-form layout="inline" class="filter-bar-modern" @submit.prevent>
        <a-form-item>
          <a-input
            v-model:value="usernameFilter"
            placeholder="Username"
            allow-clear
            style="width: 140px"
          />
        </a-form-item>
        <a-form-item>
          <a-input
            v-model:value="actionFilter"
            placeholder="Action"
            allow-clear
            style="width: 120px"
          />
        </a-form-item>
        <a-form-item>
          <a-input
            v-model:value="resourceFilter"
            placeholder="Resource"
            allow-clear
            style="width: 120px"
          />
        </a-form-item>
        <a-form-item>
          <a-date-picker
            v-model:value="fromDateFilter"
            placeholder="From date"
            style="width: 120px"
          />
        </a-form-item>
        <a-form-item>
          <a-date-picker
            v-model:value="toDateFilter"
            placeholder="To date"
            style="width: 120px"
          />
        </a-form-item>
      </a-form>
    </a-card>
    <a-card class="audit-table-card" bordered>
      <a-spin :spinning="loading">
        <a-table
          :dataSource="logs"
          :columns="columns"
          rowKey="id"
          :pagination="{ pageSize: 10 }"
          :scroll="{ x: 900 }"
          bordered
          class="audit-table-modern"
          :locale="{ emptyText: error ? error : 'No logs found.' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'createdAt'">
              <span class="audit-date">{{ formatDate(record.createdAt) }}</span>
            </template>
            <template v-else-if="column.dataIndex === 'data'">
              <a-button type="link" size="small" @click="showDetail(record)">
                <eye-outlined /> View
              </a-button>
            </template>
            <template v-else-if="column.dataIndex === 'username'">
              <span class="audit-user">{{
                record.username || record.userId || "-"
              }}</span>
            </template>
            <template v-else>
              <span>{{ record[column.dataIndex] }}</span>
            </template>
          </template>
        </a-table>
      </a-spin>
    </a-card>
    <a-modal
      v-model:visible="detailVisible"
      title=""
      width="640px"
      :footer="null"
      @cancel="closeDetail"
      class="audit-modal-modern"
    >
      <div class="modal-header-modern">
        <file-text-outlined
          style="color: #2563eb; font-size: 20px; margin-right: 8px"
        />
        <span style="font-weight: 600; font-size: 17px">{{
          $t("auditLogDetail.title")
        }}</span>
      </div>

      <template v-if="detailRecord">
        <div class="detail-section-label">{{ $t("auditLogDetail.overview") }}</div>
        <a-descriptions
          bordered
          :column="1"
          size="small"
          class="audit-detail-block"
        >
          <a-descriptions-item :label="$t('createdAt')">
            {{ formatDateTime(detailRecord.createdAt) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('username')">
            {{ detailRecord.username || detailRecord.userId || "—" }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('auditLogDetail.actionLabel')">
            <a-tag color="blue">{{ detailRecord.action }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('auditLogDetail.resourceLabel')">
            <a-tag>{{ detailRecord.resource }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item
            v-if="detailRecord.ip"
            :label="$t('auditLogDetail.fields.ipAddress')"
          >
            {{ detailRecord.ip }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-section-label">{{ $t("auditLogDetail.eventData") }}</div>
        <template v-if="detailRows.length">
          <a-descriptions
            bordered
            :column="1"
            size="small"
            class="audit-detail-block audit-event-desc"
          >
            <a-descriptions-item
              v-for="row in detailRows"
              :key="row.key"
              :label="row.label"
            >
              <template v-if="row.kind === 'userAgent'">
                <div class="audit-primary">{{ row.primary }}</div>
                <div class="audit-secondary-label">
                  {{ $t("auditLogDetail.technicalUa") }}
                </div>
                <div class="audit-ua-full">{{ row.secondary }}</div>
              </template>
              <template v-else-if="row.kind === 'ip'">
                <span>{{ row.primary }}</span>
                <a-tag v-if="row.isLocal" class="audit-local-tag" color="default">
                  {{ $t("auditLogDetail.localhost") }}
                </a-tag>
              </template>
              <template v-else-if="row.kind === 'session'">
                <code class="audit-code">{{ row.mono }}</code>
              </template>
              <template v-else-if="row.kind === 'json'">
                <pre class="audit-pre-inline">{{ row.raw }}</pre>
              </template>
              <template v-else>
                {{ row.primary }}
              </template>
            </a-descriptions-item>
          </a-descriptions>
        </template>
        <a-empty
          v-else
          :description="$t('auditLogDetail.noEventPayload')"
          class="audit-empty-payload"
        />

        <a-collapse
          v-if="rawJsonPretty"
          ghost
          class="audit-raw-collapse"
        >
          <a-collapse-panel :header="$t('auditLogDetail.rawJson')" key="raw">
            <div class="audit-raw-toolbar">
              <a-button type="link" size="small" @click="copyRawJson">
                <copy-outlined />
                {{ $t("auditLogDetail.copyHint") }}
              </a-button>
            </div>
            <pre class="audit-raw-pre">{{ rawJsonPretty }}</pre>
          </a-collapse-panel>
        </a-collapse>
      </template>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import dayjs from "dayjs";
import {
  FileSearchOutlined,
  EyeOutlined,
  FileTextOutlined,
  CopyOutlined,
} from "@ant-design/icons-vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import {
  parseAuditDataPayload,
  buildAuditDataRows,
} from "@/core/utils/auditLogDisplay.js";

const store = useStore();
const { t, te } = useI18n();

const usernameFilter = ref("");
const actionFilter = ref("");
const resourceFilter = ref("");
const fromDateFilter = ref("");
const toDateFilter = ref("");

const detailVisible = ref(false);
const detailRecord = ref(null);

const columns = computed(() => [
  { title: "Date", dataIndex: "createdAt", width: 170 },
  { title: "User", dataIndex: "username", width: 120 },
  { title: "Action", dataIndex: "action", width: 100 },
  { title: "Resource", dataIndex: "resource", width: 120 },
  { title: "Data", dataIndex: "data", width: 300 },
]);

const logs = computed(() => store.state.auditLog.logs);
const loading = computed(() => store.state.auditLog.loading);
const error = computed(() => store.state.auditLog.error);

const filters = computed(() => ({
  username: usernameFilter.value,
  action: actionFilter.value,
  resource: resourceFilter.value,
  fromDate: fromDateFilter.value,
  toDate: toDateFilter.value,
}));

function formatDateTime(value) {
  if (!value) return "—";
  return dayjs(value).format("YYYY-MM-DD HH:mm:ss");
}

function formatDate(date) {
  if (!date) return "";
  return dayjs(date).format("YYYY-MM-DD HH:mm");
}

const detailRows = computed(() => {
  if (!detailRecord.value) return [];
  const parsed = parseAuditDataPayload(detailRecord.value.data);
  if (!parsed || typeof parsed !== "object") return [];
  return buildAuditDataRows(parsed, {
    t,
    te,
    formatDateTime,
  });
});

const rawJsonPretty = computed(() => {
  if (!detailRecord.value) return "";
  const d = detailRecord.value.data;
  if (d == null) return "";
  try {
    if (typeof d === "string") {
      const parsed = JSON.parse(d);
      return JSON.stringify(parsed, null, 2);
    }
    return JSON.stringify(d, null, 2);
  } catch {
    return typeof d === "string" ? d : JSON.stringify(d, null, 2);
  }
});

function fetchLogs() {
  const payload = { ...filters.value };

  Object.keys(payload).forEach((key) => {
    if (typeof payload[key] === "string") {
      payload[key] = payload[key].trim();
      if (payload[key] === "") payload[key] = undefined;
    }
  });
  if (payload.fromDate)
    payload.fromDate = dayjs(payload.fromDate).format("YYYY-MM-DD");
  if (payload.toDate)
    payload.toDate = dayjs(payload.toDate).format("YYYY-MM-DD");
  store.dispatch("auditLog/fetchAuditLogs", payload);
}

function showDetail(record) {
  detailRecord.value = record;
  detailVisible.value = true;
}

function closeDetail() {
  detailVisible.value = false;
  detailRecord.value = null;
}

async function copyRawJson() {
  const text = rawJsonPretty.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    message.success(t("auditLogDetail.copyDone"));
  } catch {
    message.error(t("auditLogDetail.copyFailed"));
  }
}

watch(
  [usernameFilter, actionFilter, resourceFilter, fromDateFilter, toDateFilter],
  () => {
    fetchLogs();
  }
);

onMounted(() => {
  fetchLogs();
});
</script>

<style scoped>
.audit-log-view-modern {
  background: #f6f8fa;
}
.audit-header-card {
  margin-bottom: 18px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.filter-bar-modern {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 0;
}
.audit-table-card {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.audit-table-modern .ant-table-thead > tr > th {
  background: #f1f5f9;
  font-weight: 600;
  font-size: 15px;
  color: #334155;
  border-bottom: 1.5px solid #e5e7eb;
}
.audit-table-modern .ant-table-tbody > tr > td {
  font-size: 14px;
  color: #22223b;
  padding: 8px 12px;
}
.audit-date {
  color: #2563eb;
  font-weight: 500;
}
.audit-user {
  font-weight: 500;
  color: #0f172a;
}
.audit-modal-modern .ant-modal-content {
  border-radius: 14px;
  background: #f9fafb;
}
.modal-header-modern {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.detail-section-label {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 16px 0 8px;
}
.detail-section-label:first-of-type {
  margin-top: 0;
}
.audit-detail-block {
  margin-bottom: 0;
}
.audit-event-desc :deep(.ant-descriptions-item-label) {
  width: 160px;
  vertical-align: top;
}
.audit-primary {
  font-weight: 500;
  color: #0f172a;
  margin-bottom: 6px;
}
.audit-secondary-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}
.audit-ua-full {
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
  word-break: break-word;
  background: #f1f5f9;
  padding: 8px 10px;
  border-radius: 6px;
}
.audit-code {
  display: inline-block;
  font-size: 13px;
  padding: 4px 8px;
  background: #f1f5f9;
  border-radius: 6px;
  word-break: break-all;
}
.audit-pre-inline {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow: auto;
  background: #f1f5f9;
  padding: 10px;
  border-radius: 8px;
}
.audit-local-tag {
  margin-left: 8px;
}
.audit-empty-payload {
  margin: 12px 0;
}
.audit-raw-collapse {
  margin-top: 12px;
}
.audit-raw-toolbar {
  margin-bottom: 8px;
}
.audit-raw-collapse :deep(.ant-collapse-header) {
  font-size: 13px;
  color: #64748b;
}
.audit-raw-pre {
  margin: 8px 0 0;
  font-size: 12px;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: #fff;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
</style>
