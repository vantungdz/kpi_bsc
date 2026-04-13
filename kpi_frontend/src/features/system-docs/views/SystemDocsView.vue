<template>
  <div class="system-docs-page">
    <a-card>
      <template #title>
        <div class="docs-header">
          <read-outlined class="docs-icon" />
          <h2>{{ $t("systemDocs.title") }}</h2>
        </div>
      </template>

      <div class="docs-layout">
        <div class="docs-menu">
          <a-menu
            :selectedKeys="selectedKeys"
            mode="vertical"
            :style="{ border: 'none' }"
            @click="onMenuClick"
          >
            <a-menu-item
              v-for="doc in docList"
              :key="doc.id"
              :title="$t(doc.labelKey)"
            >
              <file-text-outlined />
              <span>{{ $t(doc.labelKey) }}</span>
            </a-menu-item>
          </a-menu>
        </div>

        <div class="docs-content">
          <div v-if="loading" class="loading-container">
            <a-spin size="large" :tip="$t('systemDocs.loading')" />
          </div>

          <div v-else-if="error" class="error-container">
            <a-result
              status="warning"
              :title="$t('systemDocs.loadError')"
              :sub-title="error"
            >
              <template #extra>
                <a-button type="primary" @click="loadDoc(currentDoc)">
                  <reload-outlined />
                  {{ $t("systemDocs.retry") }}
                </a-button>
              </template>
            </a-result>
          </div>

          <div v-else-if="markdownContent" class="markdown-container">
            <component :is="VMdPreview" :text="markdownContent" />
          </div>

          <div v-else class="empty-container">
            <a-empty :description="$t('systemDocs.noContent')">
              <template #image>
                <file-text-outlined style="font-size: 64px; color: #1890ff" />
              </template>
            </a-empty>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import {
  Card as ACard,
  Menu as AMenu,
  MenuItem as AMenuItem,
  Button as AButton,
  Spin as ASpin,
  Empty as AEmpty,
  Result as AResult,
} from "ant-design-vue";
import {
  ReadOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from "@ant-design/icons-vue";
import VMdPreview from "@kangc/v-md-editor/lib/preview";
import "@kangc/v-md-editor/lib/style/preview.css";
import vuepressTheme from "@kangc/v-md-editor/lib/theme/vuepress.js";
import "@kangc/v-md-editor/lib/theme/style/vuepress.css";
import Prism from "prismjs";
import createPlantUMLPlugin from "@/core/utils/plantuml";

VMdPreview.use(vuepressTheme, {
  Prism,
  extend(md) {
    md.use(createPlantUMLPlugin());
  },
});

const { t: $t } = useI18n();

const docList = [
  { id: "fs", file: "FS.md", labelKey: "systemDocs.docFS" },
  { id: "bdd", file: "BDD.md", labelKey: "systemDocs.docBDD" },
  { id: "ddd", file: "DDD.md", labelKey: "systemDocs.docDDD" },
  { id: "sad", file: "SAD.md", labelKey: "systemDocs.docSAD" },
  { id: "techGuide", file: "TechGuide.md", labelKey: "systemDocs.docTechGuide" },
];

const currentDoc = ref("fs");
const selectedKeys = computed(() => [currentDoc.value]);
const markdownContent = ref("");
const loading = ref(true);
const error = ref(null);

async function loadDoc(docId) {
  const doc = docList.find((d) => d.id === docId);
  if (!doc) return;
  loading.value = true;
  error.value = null;
  try {
    const base = process.env.BASE_URL || "/";
    const url = `${base.replace(/\/$/, "")}/system-docs/${doc.file}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.statusText);
    const text = await response.text();
    markdownContent.value = text;
  } catch (err) {
    console.error("Error loading system doc:", err);
    error.value = err.message || $t("systemDocs.loadErrorMessage");
    markdownContent.value = "";
  } finally {
    loading.value = false;
  }
}

function onMenuClick({ key }) {
  currentDoc.value = key;
  loadDoc(key);
}

onMounted(() => {
  loadDoc(currentDoc.value);
});
</script>

<style scoped>
.system-docs-page {
  padding: 24px;
  background: #f0f2f5;
  min-height: calc(100vh - 64px);
}

.docs-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.docs-icon {
  font-size: 24px;
  color: #1890ff;
}

.docs-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.docs-layout {
  display: flex;
  gap: 24px;
  min-height: 600px;
}

.docs-menu {
  flex-shrink: 0;
  width: 220px;
  background: #fafafa;
  border-radius: 8px;
  padding: 8px 0;
}

.docs-menu :deep(.ant-menu-item) {
  margin: 4px 8px;
  border-radius: 6px;
  height: 40px;
  line-height: 40px;
}

.docs-menu :deep(.ant-menu-item-selected) {
  background: #e6f7ff !important;
  color: #1890ff;
}

.docs-content {
  flex: 1;
  min-width: 0;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 500px;
}

.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  padding: 40px 20px;
}

.markdown-container {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.empty-container {
  padding: 60px 20px;
  text-align: center;
  min-height: 400px;
  display: flex;
  justify-content: center;
  align-items: center;
}

:deep(.v-md-editor-preview) {
  padding: 20px;
  background: transparent;
}

:deep(.v-md-editor-preview h1) {
  border-bottom: 2px solid #1890ff;
  padding-bottom: 10px;
  margin-top: 30px;
  margin-bottom: 20px;
  color: #1890ff;
}

:deep(.v-md-editor-preview h2) {
  border-bottom: 1px solid #e8e8e8;
  padding-bottom: 8px;
  margin-top: 24px;
  margin-bottom: 16px;
  color: #262626;
}

:deep(.v-md-editor-preview h3) {
  margin-top: 20px;
  margin-bottom: 12px;
  color: #595959;
}

:deep(.v-md-editor-preview pre) {
  background: #f6f8fa !important;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
}

:deep(.v-md-editor-preview code) {
  background: #f6f8fa !important;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: "Courier New", monospace;
  font-size: 14px;
  color: #24292e !important;
}

:deep(.v-md-editor-preview pre code) {
  background: transparent !important;
  color: #24292e !important;
}

:deep(.v-md-editor-preview .hljs) {
  background: #f6f8fa !important;
  color: #24292e !important;
}

:deep(.v-md-editor-preview pre[class*="language-"]) {
  background: #f6f8fa !important;
}

:deep(.v-md-editor-preview code[class*="language-"]) {
  background: transparent !important;
  color: #24292e !important;
}

:deep(.v-md-editor-preview .token.keyword) {
  color: #d73a49 !important;
}

:deep(.v-md-editor-preview .token.string) {
  color: #032f62 !important;
}

:deep(.v-md-editor-preview .token.comment) {
  color: #6a737d !important;
}

:deep(.v-md-editor-preview table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

:deep(.v-md-editor-preview table th),
:deep(.v-md-editor-preview table td) {
  border: 1px solid #e8e8e8;
  padding: 8px 12px;
  text-align: left;
}

:deep(.v-md-editor-preview table th) {
  background: #fafafa;
  font-weight: 600;
}

:deep(.v-md-editor-preview blockquote) {
  border-left: 4px solid #1890ff;
  padding-left: 16px;
  margin: 16px 0;
  color: #595959;
  background: #f6f8fa;
  padding: 12px 16px;
  border-radius: 4px;
}

:deep(.v-md-editor-preview ul),
:deep(.v-md-editor-preview ol) {
  padding-left: 24px;
  margin: 12px 0;
}

:deep(.v-md-editor-preview li) {
  margin: 8px 0;
  line-height: 1.8;
}

:deep(.plantuml-diagram) {
  margin: 24px 0;
  text-align: center;
}

:deep(.plantuml-image) {
  max-width: 100%;
  height: auto;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

:deep(.plantuml-code) {
  margin-top: 12px;
  text-align: left;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

:deep(.plantuml-code summary) {
  cursor: pointer;
  color: #1890ff;
  font-weight: 500;
  padding: 8px 12px;
  background: #f0f5ff;
  border-radius: 4px;
}

:deep(.plantuml-error) {
  color: #ff4d4f;
  padding: 20px;
  border: 1px solid #ff4d4f;
  border-radius: 8px;
  margin: 20px 0;
  background: #fff1f0;
}

@media (max-width: 768px) {
  .system-docs-page {
    padding: 12px;
  }

  .docs-layout {
    flex-direction: column;
  }

  .docs-menu {
    width: 100%;
  }

  .markdown-container {
    padding: 16px;
  }

  .docs-header h2 {
    font-size: 18px;
  }

  :deep(.v-md-editor-preview) {
    padding: 12px;
  }
}
</style>
