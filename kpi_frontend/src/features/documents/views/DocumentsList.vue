<template>
  <a-card :title="$t('documents.title')">
    <div
      style="
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
        align-items: center;
      "
    >
      <SearchOutlined
        style="font-size: 18px; color: #1890ff; margin-right: 4px"
      />
      <a-input
        v-model:value="searchText"
        :placeholder="$t('documents.searchPlaceholder')"
        style="width: 220px"
        allow-clear
      />
      <FilterOutlined
        style="font-size: 18px; color: #faad14; margin-right: 4px"
      />
      <a-select
        v-model:value="filterType"
        :options="typeOptions"
        :placeholder="$t('documents.typeFilter')"
        allow-clear
        style="width: 160px"
      />
      <a-button
        type="primary"
        @click="showUploadModal = true"
        style="margin-left: auto"
      >
        <template #icon><UploadOutlined /></template>
        {{ $t("documents.upload") }}
      </a-button>
    </div>
    <a-table
      :dataSource="filteredDocuments"
      :columns="columns"
      :loading="loading"
      rowKey="id"
      bordered
      style="margin-top: 24px"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <span>
            <template v-if="record.type === 'guide'">
              <BookOutlined style="color: #1890ff; margin-right: 4px" />
            </template>
            <template v-else-if="record.type === 'policy'">
              <SafetyCertificateOutlined
                style="color: #faad14; margin-right: 4px"
              />
            </template>
            <template v-else-if="record.type === 'template'">
              <FileWordOutlined style="color: #52c41a; margin-right: 4px" />
            </template>
            <template v-else>
              <FileOutlined style="color: #bfbfbf; margin-right: 4px" />
            </template>
            {{ getTypeLabel(record.type) }}
          </span>
        </template>
        <template v-else-if="column.key === 'createdBy'">
          <UserOutlined style="color: #1890ff; margin-right: 4px" />
          {{ getCreatorName(record.createdBy) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button type="link" @click="previewFile(record)">
            <template #icon><FileTextOutlined /></template>
            {{ $t("documents.preview") }}
          </a-button>
          <a-button type="link" @click="downloadFile(record)">
            <template #icon><DownloadOutlined /></template>
            {{ $t("documents.download") }}
          </a-button>
          <a-popconfirm
            :title="$t('documents.confirmDelete')"
            @confirm="deleteDocument(record.id)"
          >
            <a-button type="link" danger>
              <template #icon><DeleteOutlined /></template>
              {{ $t("documents.delete") }}
            </a-button>
          </a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal
      v-model:open="showUploadModal"
      :title="$t('documents.upload')"
      width="480px"
      @cancel="showUploadModal = false"
      :footer="null"
    >
      <CloudUploadOutlined
        style="
          font-size: 32px;
          color: #1890ff;
          display: block;
          margin: auto;
          margin-bottom: 12px;
        "
      />
      <DocumentUpload @upload-success="handleUploadSuccess" />
    </a-modal>
    <a-modal
      v-model:open="showPreview"
      :title="previewTitle"
      width="70vw"
      @cancel="showPreview = false"
      :footer="null"
    >
      <EyeOutlined
        v-if="previewType === 'pdf' || previewType === 'image'"
        style="font-size: 22px; color: #52c41a; margin-bottom: 8px"
      />
      <FileExclamationOutlined
        v-else
        style="font-size: 22px; color: #faad14; margin-bottom: 8px"
      />
      <div v-if="previewType === 'pdf'">
        <iframe
          :src="previewUrl"
          width="100%"
          height="600px"
          style="border: none"
        ></iframe>
      </div>
      <div v-else-if="previewType === 'image'">
        <img
          :src="previewUrl"
          style="
            max-width: 100%;
            max-height: 600px;
            display: block;
            margin: auto;
          "
        />
      </div>
      <div v-else-if="previewType === 'office'">
        <a-alert
          type="info"
          message="Không thể xem trước file Office trên hệ thống nội bộ. Hãy tải về để xem."
          show-icon
        />
      </div>
      <div v-else>
        <a-alert
          type="info"
          message="Không hỗ trợ xem trước file này. Hãy tải về để xem."
          show-icon
        />
      </div>
    </a-modal>
  </a-card>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";
import { message } from "ant-design-vue";
import DocumentUpload from "../components/DocumentUpload.vue";
import { useI18n } from "vue-i18n";
import {
  UploadOutlined,
  FileTextOutlined,
  DownloadOutlined,
  DeleteOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  FileWordOutlined,
  FileOutlined,
  UserOutlined,
  SearchOutlined,
  FilterOutlined,
  CloudUploadOutlined,
  EyeOutlined,
  FileExclamationOutlined,
} from "@ant-design/icons-vue";

const { t: $t } = useI18n();
const store = useStore();
const documents = computed(() => store.getters["documents/documents"]);
const loading = computed(() => store.getters["documents/loading"]);
const searchText = ref("");
const filterType = ref("");
const showPreview = ref(false);
const previewUrl = ref("");
const previewType = ref("");
const previewTitle = ref("");
const showUploadModal = ref(false);

const API_BASE = process.env.VUE_APP_API_URL;

const typeOptions = computed(() => [
  { label: $t("documents.typeAll"), value: "" },
  { label: $t("documents.typeGuide"), value: "guide" },
  { label: $t("documents.typePolicy"), value: "policy" },
  { label: $t("documents.typeTemplate"), value: "template" },
  { label: $t("documents.typeGeneral"), value: "general" },
]);

const typeLabelMap = computed(() => {
  const opts = typeOptions.value.filter((o) => o.value);
  const map = {};
  opts.forEach((o) => (map[o.value] = o.label));
  return map;
});

function getTypeLabel(type) {
  return typeLabelMap.value[type] || type || "-";
}

function getCreatorName(createdBy) {
  if (!createdBy) return "-";
  if (createdBy.first_name || createdBy.last_name) {
    return `${createdBy.first_name || ""} ${createdBy.last_name || ""}`.trim();
  }
  return createdBy.username || "-";
}

const columns = computed(() => [
  { title: $t("documents.name"), dataIndex: "name", key: "name" },
  { title: $t("documents.type"), dataIndex: "type", key: "type" },
  {
    title: $t("documents.description"),
    dataIndex: "description",
    key: "description",
  },
  {
    title: $t("documents.createdBy"),
    dataIndex: ["createdBy", "username"],
    key: "createdBy",
  },
  {
    title: $t("documents.createdAt"),
    dataIndex: "createdAt",
    key: "createdAt",
  },
  { title: $t("documents.action"), key: "action" },
]);

const filteredDocuments = computed(() => {
  let docs = documents.value;
  if (searchText.value) {
    docs = docs.filter((d) =>
      d.name.toLowerCase().includes(searchText.value.toLowerCase())
    );
  }
  if (filterType.value) {
    docs = docs.filter((d) => d.type === filterType.value);
  }
  return docs;
});

onMounted(() => {
  store.dispatch("documents/fetchDocuments");
});

function downloadFile(record) {
  const url = `${API_BASE}/documents/${record.id}/download`;
  const token =
    localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
  fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((response) => {
      if (!response.ok) throw new Error("Download failed");
      // Lấy tên file từ header nếu có, fallback về record.name + đuôi file gốc
      let filename = record.name;
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = decodeURIComponent(match[1]);
      } else {
        // fallback: lấy đuôi file từ filePath
        const ext = record.filePath ? record.filePath.split(".").pop() : "";
        if (ext && !filename.endsWith("." + ext)) filename += "." + ext;
      }
      return response.blob().then((blob) => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(() => {
      message.error("Tải file thất bại!");
    });
}

function deleteDocument(id) {
  store.dispatch("documents/deleteDocument", id).then(() => {
    message.success("Xoá thành công!");
  });
}

function previewFile(record) {
  const url = `${API_BASE}/${record.filePath.replace(/\\/g, "/").replace(/^\//, "")}`;
  previewUrl.value = url;
  previewTitle.value = record.name;
  const ext = record.filePath.split(".").pop().toLowerCase();
  if (url.endsWith(".pdf")) previewType.value = "pdf";
  else if (url.match(/\.(jpg|jpeg|png|gif)$/i)) previewType.value = "image";
  else if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"].includes(ext))
    previewType.value = "office";
  else previewType.value = "other";
  showPreview.value = true;
}

function handleUploadSuccess() {
  showUploadModal.value = false;
  store.dispatch("documents/fetchDocuments");
}
</script>
