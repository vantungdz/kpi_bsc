<template>
  <a-card>
    <template #title>
      <file-text-outlined style="margin-right: 8px; color: #1890ff; font-size: 24px" /><span style="font-size: 20px; font-weight: 600">{{ $t('documents.title') }}</span>
    </template>
    <LoadingOverlay :visible="loading" />
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
        style="width: 420px"
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
        v-if="['pdf', 'image', 'markdown', 'text', 'code'].includes(previewType)"
        style="font-size: 22px; color: #52c41a; margin-bottom: 8px"
      />
      <FileExclamationOutlined
        v-else
        style="font-size: 22px; color: #faad14; margin-bottom: 8px"
      />
      <!-- PDF Preview -->
      <div v-if="previewType === 'pdf'">
        <iframe
          :src="previewUrl"
          width="100%"
          height="600px"
          style="border: none"
        ></iframe>
      </div>
      <!-- Image Preview -->
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
      <!-- Markdown Preview -->
      <div
        v-else-if="previewType === 'markdown'"
        style="
          max-height: 600px;
          overflow-y: auto;
          padding: 16px;
          background: #f5f5f5;
          border-radius: 4px;
        "
        v-html="previewContent"
      ></div>
      <!-- Text/Code Preview -->
      <div v-else-if="previewType === 'text' || previewType === 'code'">
        <pre
          style="
            max-height: 600px;
            overflow: auto;
            padding: 16px;
            background: #f6f8fa;
            border-radius: 4px;
            margin: 0;
          "
        ><code v-html="previewContent"></code></pre>
      </div>
      <!-- Office Files (Word, Excel) -->
      <div v-else-if="previewType === 'office'">
        <div
          v-if="previewContent"
          style="
            max-height: 600px;
            overflow: auto;
            padding: 16px;
            background: #ffffff;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
          "
          v-html="previewContent"
        ></div>
        <a-spin v-else style="display: block; text-align: center; padding: 40px">
          <template #tip>Loading file...</template>
        </a-spin>
      </div>
      <!-- Unsupported Files -->
      <div v-else>
        <a-alert
          type="info"
          message="Preview not supported for this file type. Please download to view."
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
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import dayjs from "dayjs";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import apiClient from "@/core/services/api";
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
const previewContent = ref("");
const showUploadModal = ref(false);

const API_BASE = process.env.VUE_APP_API_URL || "/api";

// Helper function to fetch file content using apiClient
async function fetchFileContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${store.getters["auth/token"]}`,
      },
    });
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
    return response;
  } catch (error) {
    console.error("Error fetching file:", error);
    throw error;
  }
}

// Configure marked for markdown rendering
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

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
    customRender: ({ text }) => {
      if (!text) return "-";
      return dayjs(text).format("YYYY-MM-DD HH:mm");
    },
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

async function downloadFile(record) {
  try {
    const response = await apiClient.get(`/documents/${record.id}/download`, {
      responseType: 'blob',
    });

    // Get the filename from the header if available, and use record.name + original file extension as a fallback.
    let filename = record.name;
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = decodeURIComponent(match[1]);
    } else {
      // fallback: lấy đuôi file từ filePath
      const ext = record.filePath ? record.filePath.split(".").pop() : "";
      if (ext && !filename.endsWith("." + ext)) filename += "." + ext;
    }

    const blob = response.data;
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("Download error:", error);
    message.error("File download failed!");
  }
}

function deleteDocument(id) {
  store.dispatch("documents/deleteDocument", id).then(() => {
    message.success("Delete successful!");
  });
}

async function previewFile(record) {
  const url = `${API_BASE}/${record.filePath.replace(/\\/g, "/").replace(/^\//, "")}`;
  previewUrl.value = url;
  previewTitle.value = record.name;
  previewContent.value = "";

  const ext = record.filePath.split(".").pop().toLowerCase();

  // PDF files
  if (ext === "pdf") {
    previewType.value = "pdf";
    showPreview.value = true;
    return;
  }

  // Image files
  if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(ext)) {
    previewType.value = "image";
    showPreview.value = true;
    return;
  }

  // Markdown files
  if (ext === "md" || ext === "markdown") {
    previewType.value = "markdown";
    await fetchAndRenderMarkdown(url);
    showPreview.value = true;
    return;
  }

  // Text files
  if (["txt", "log", "csv", "json", "xml", "yaml", "yml", "ini", "env"].includes(ext)) {
    previewType.value = "text";
    await fetchAndDisplayText(url, ext);
    showPreview.value = true;
    return;
  }

  // Code files
  if (["js", "ts", "jsx", "tsx", "vue", "py", "java", "c", "cpp", "cs", "go", "rb", "php", "sql", "html", "css", "scss", "sass", "less"].includes(ext)) {
    previewType.value = "code";
    await fetchAndHighlightCode(url, ext);
    showPreview.value = true;
    return;
  }

  // Office files - Word
  if (["docx"].includes(ext)) {
    previewType.value = "office";
    showPreview.value = true; // Show modal first
    await fetchAndRenderWord(url);
    return;
  }

  // Office files - Excel
  if (["xlsx", "xls"].includes(ext)) {
    previewType.value = "office";
    showPreview.value = true; // Show modal first
    await fetchAndRenderExcel(url);
    return;
  }

  // Older Office formats or PowerPoint (not fully supported)
  if (["doc", "ppt", "pptx"].includes(ext)) {
    previewType.value = "office";
    showPreview.value = true;
    previewContent.value = `
      <div style="padding: 20px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h3 style="color: #faad14; margin-bottom: 8px;">Preview Not Available</h3>
        <p style="color: #595959;">
          Preview not available for this Office file format (.${ext}).
        </p>
        <p style="color: #8c8c8c; font-size: 13px;">
          Supported formats: .docx, .xlsx
        </p>
        <p style="margin-top: 16px;">
          <strong>Please download the file to view it.</strong>
        </p>
      </div>
    `;
    return;
  }

  // Unsupported
  previewType.value = "other";
  showPreview.value = true;
}

async function fetchAndRenderMarkdown(url) {
  try {
    const response = await fetchFileContent(url);
    const text = await response.text();
    previewContent.value = marked(text);
  } catch (error) {
    message.error("Failed to load markdown file");
    previewContent.value = "<p style='color: red;'>Failed to load file content</p>";
  }
}

async function fetchAndDisplayText(url, ext) {
  try {
    const response = await fetchFileContent(url);
    const text = await response.text();

    // For JSON, try to format it
    if (ext === "json") {
      try {
        const json = JSON.parse(text);
        const formatted = JSON.stringify(json, null, 2);
        previewContent.value = hljs.highlight(formatted, { language: "json" }).value;
      } catch {
        previewContent.value = hljs.highlightAuto(text).value;
      }
    } else if (ext === "xml") {
      previewContent.value = hljs.highlight(text, { language: "xml" }).value;
    } else {
      previewContent.value = hljs.highlightAuto(text).value;
    }
  } catch (error) {
    message.error("Failed to load text file");
    previewContent.value = "Failed to load file content";
  }
}

async function fetchAndHighlightCode(url, ext) {
  try {
    const response = await fetchFileContent(url);
    const text = await response.text();

    // Map file extensions to highlight.js language names
    const langMap = {
      js: "javascript",
      ts: "typescript",
      jsx: "javascript",
      tsx: "typescript",
      vue: "vue",
      py: "python",
      rb: "ruby",
      cs: "csharp",
      cpp: "cpp",
      yml: "yaml",
    };

    const lang = langMap[ext] || ext;

    if (hljs.getLanguage(lang)) {
      previewContent.value = hljs.highlight(text, { language: lang }).value;
    } else {
      previewContent.value = hljs.highlightAuto(text).value;
    }
  } catch (error) {
    message.error("Failed to load code file");
    previewContent.value = "Failed to load file content";
  }
}

// Render Word (.docx) files
async function fetchAndRenderWord(url) {
  try {
    const response = await fetchFileContent(url);
    const arrayBuffer = await response.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });

    previewContent.value = `
      <div style="
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        color: #333;
      ">
        ${result.value}
      </div>
    `;

    if (result.messages.length > 0) {
      console.warn("Mammoth conversion warnings:", result.messages);
    }
  } catch (error) {
    console.error("Error rendering Word file:", error);
    message.error("Failed to load Word file");
    previewContent.value = `
      <div style="color: red; padding: 20px; text-align: center;">
        <p><strong>Failed to load Word file</strong></p>
        <p>Please download the file to view it.</p>
      </div>
    `;
  }
}

// Render Excel (.xlsx, .xls) files
async function fetchAndRenderExcel(url) {
  try {
    const response = await fetchFileContent(url);
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    let html = '';
    workbook.SheetNames.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      const htmlTable = XLSX.utils.sheet_to_html(worksheet);

      html += `
        <div style="margin-bottom: 24px;">
          <h3 style="
            background: #1890ff;
            color: white;
            padding: 8px 12px;
            margin: 0 0 8px 0;
            border-radius: 4px;
            font-size: 14px;
          ">
            Sheet ${index + 1}: ${sheetName}
          </h3>
          <div style="overflow-x: auto;">
            ${htmlTable}
          </div>
        </div>
      `;
    });

    previewContent.value = `
      <div style="font-family: Arial, sans-serif; font-size: 13px;">
        <style>
          table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
          td, th { border: 1px solid #d9d9d9; padding: 8px; text-align: left; }
          th { background-color: #fafafa; font-weight: 600; }
          tr:nth-child(even) { background-color: #f5f5f5; }
        </style>
        ${html}
      </div>
    `;
  } catch (error) {
    console.error("Error rendering Excel file:", error);
    message.error("Failed to load Excel file");
    previewContent.value = `
      <div style="color: red; padding: 20px; text-align: center;">
        <p><strong>Failed to load Excel file</strong></p>
        <p>Please download the file to view it.</p>
      </div>
    `;
  }
}

function handleUploadSuccess() {
  showUploadModal.value = false;
  store.dispatch("documents/fetchDocuments");
}
</script>
