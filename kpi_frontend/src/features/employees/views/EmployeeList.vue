<template>
  <div class="employee-list">
    <div class="header">
      <h2>Danh sách nhân viên</h2>
      <a-button type="primary" @click="openUploadModal">
        Upload Employee Excel
      </a-button>
    </div>
    <a-modal
      :open="isUploadModalVisible"
      title="Upload Employee Excel"
      @ok="handleUpload"
      @cancel="closeUploadModal"
      :confirm-loading="uploading"
    >
      <a-upload
        :before-upload="beforeUpload"
        :file-list="fileList"
        @remove="handleRemove"
        accept=".xlsx, .xls"
      >
        <a-button> <upload-outlined /> Select File </a-button>
      </a-upload>
    </a-modal>
    <a-table :columns="columns" :data-source="employees" row-key="id">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'fullName'">
          {{ record.first_name }} {{ record.last_name }}
        </template>
        <template v-else-if="column.dataIndex === 'department'">
          {{ record.department?.name || "--" }}
        </template>
        <template v-else-if="column.dataIndex === 'section'">
          {{ record.section?.name || "--" }}
        </template>
        <template v-else-if="column.dataIndex === 'role'">
          {{ record.role || "--" }}
        </template>
        <template
          v-else-if="
            column.dataIndex && record.hasOwnProperty(column.dataIndex)
          "
        >
          {{ record[column.dataIndex] || "--" }}
        </template>
        <template v-else> -- </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";
import { notification } from "ant-design-vue";

import {
  Button as AButton,
  Modal as AModal,
  Upload as AUpload,
  Table as ATable,
} from "ant-design-vue";
import { UploadOutlined } from "@ant-design/icons-vue";

const store = useStore();
const employees = computed(() => store.getters["employees/userList"]);
const isUploadModalVisible = ref(false);
const fileList = ref([]);
const uploading = ref(false);

const openUploadModal = () => {
  isUploadModalVisible.value = true;
};

const closeUploadModal = () => {
  isUploadModalVisible.value = false;
  fileList.value = [];
  uploading.value = false;
};

const beforeUpload = (file) => {
  fileList.value = [file];
  return false;
};

const handleRemove = () => {
  fileList.value = [];
};

const handleUpload = async () => {
  if (fileList.value.length === 0) {
    notification.error({
      message: "No File Selected",
      description: "Please select a file to upload.",
    });
    return;
  }

  uploading.value = true;
  try {
    const file = fileList.value[0];
    const response = await store.dispatch(
      "employees/uploadFile",
      file.originFileObj || file
    );

    console.log("Upload response from action:", response);
    notification.success({
      message: "Upload Successful",
      description: `Successfully imported ${response?.successCount || 0} employees. Errors: ${response?.errors?.length || 0}.`,
    });

    await store.dispatch("employees/fetchUsers", { force: true });
  } catch (error) {
    console.error("Upload error from component:", error);
    notification.error({
      message: "Upload Failed",
      description:
        error.message || error.error || "An error occurred during file upload.",
    });
  } finally {
    uploading.value = false;
    isUploadModalVisible.value = false;
    fileList.value = [];
  }
};

onMounted(() => {
  store.dispatch("employees/fetchUsers", { force: true }).catch((error) => {
    console.error("Failed to fetch employees:", error);
    notification.error({
      message: "Loading Employees Failed",
      description: error.message || "Could not load employee list.",
    });
  });
});

const columns = ref([
  {
    title: "Tên nhân viên",
    dataIndex: "fullName",
    key: "fullName",
    sorter: (a, b) =>
      (a.first_name + a.last_name).localeCompare(b.first_name + b.last_name),
  },
  {
    title: "Phòng ban",
    dataIndex: "department",
    key: "department",
    sorter: (a, b) => a.department?.name?.localeCompare(b.department?.name),
  },
  {
    title: "Bộ phận",
    dataIndex: "section",
    key: "section",
    sorter: (a, b) => a.section?.name?.localeCompare(b.section?.name),
  },
  {
    title: "Vai trò",
    dataIndex: "role",
    key: "role",
    sorter: (a, b) => a.role.localeCompare(b.role),
  },
]);
</script>

<style scoped>
.employee-list {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
</style>
