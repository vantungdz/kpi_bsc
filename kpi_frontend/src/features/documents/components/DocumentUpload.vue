<template>
  <a-form layout="vertical" @submit.prevent>
    <a-form-item :label="$t('documents.name')" required>
      <a-input
        v-model:value="form.name"
        :placeholder="$t('documents.namePlaceholder')"
      />
    </a-form-item>
    <a-form-item :label="$t('documents.type')">
      <a-select v-model:value="form.type" allow-clear>
        <a-select-option
          v-for="opt in typeOptions"
          :key="opt.value"
          :value="opt.value"
        >
          <component :is="opt.icon" style="margin-right: 6px" />
          {{ opt.label }}
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item :label="$t('documents.description')">
      <a-input
        v-model:value="form.description"
        :placeholder="$t('documents.descPlaceholder')"
      />
    </a-form-item>
    <a-form-item :label="$t('documents.file')" required>
      <a-upload
        :before-upload="beforeUpload"
        :file-list="fileList"
        :max-count="1"
        :show-upload-list="true"
        :custom-request="dummyRequest"
        @remove="onRemove"
      >
        <a-button type="dashed">
          <template #icon>
            <UploadOutlined />
          </template>
          {{ $t("documents.selectFile") }}
        </a-button>
      </a-upload>
    </a-form-item>
    <a-form-item>
      <a-button type="primary" :loading="loading" @click="handleUpload">{{
        $t("documents.upload")
      }}</a-button>
    </a-form-item>
  </a-form>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from "vue";
import { useStore } from "vuex";
import { message } from "ant-design-vue";
import {
  UploadOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileImageOutlined,
} from "@ant-design/icons-vue";
import { useI18n } from "vue-i18n";

const { t: $t } = useI18n();
const store = useStore();
const loading = computed(() => store.getters["documents/loading"]);
const form = ref({ name: "", type: "", description: "" });
const fileList = ref([]);
const typeOptions = computed(() => [
  { label: $t("documents.typeGuide"), value: "guide", icon: FileTextOutlined },
  { label: $t("documents.typePolicy"), value: "policy", icon: FilePdfOutlined },
  {
    label: $t("documents.typeTemplate"),
    value: "template",
    icon: FileImageOutlined,
  },
  {
    label: $t("documents.typeGeneral"),
    value: "general",
    icon: FileTextOutlined,
  },
]);
const emit = getCurrentInstance()?.emit;

function beforeUpload(file) {
  fileList.value = [file];
  return false;
}
function onRemove() {
  fileList.value = [];
}
function dummyRequest() {}

async function handleUpload() {
  if (!form.value.name || fileList.value.length === 0) {
    message.error("Vui lòng nhập tên và chọn file!");
    return;
  }
  const fd = new FormData();
  fd.append("name", form.value.name);
  fd.append("type", form.value.type || "general");
  fd.append("description", form.value.description || "");
  fd.append("file", fileList.value[0]);
  await store.dispatch("documents/uploadDocument", fd);
  form.value = { name: "", type: "", description: "" };
  fileList.value = [];
  if (emit) emit("upload-success");
}
</script>
