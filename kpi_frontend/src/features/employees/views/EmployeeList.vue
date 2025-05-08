<template>
  <div class="employee-list">
    <div class="header">
      <h2>Danh sách nhân viên</h2>
      <a-button type="primary" @click="openUploadModal">
        Upload Employee Excel
      </a-button>
    </div>
    <a-modal :open="isUploadModalVisible" title="Upload Employee Excel" @ok="handleUpload" @cancel="closeUploadModal"
      :confirm-loading="uploading">
      <a-upload :before-upload="beforeUpload" :file-list="fileList" @remove="handleRemove" accept=".xlsx, .xls">
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
        <template v-else-if="
            column.dataIndex && record.hasOwnProperty(column.dataIndex)
          ">
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

    const successCount = response?.successCount || 0;
    const responseErrors = response?.errors || [];
    
    const notificationMessage = response?.message || `Successfully imported ${successCount} employees. Errors: ${responseErrors.length}.`;
    let notificationDescription = ""; 

    if (responseErrors.length > 0) {
      const errorDetails = responseErrors.slice(0, 3).map(err => {
        let rowIdentifier = '';
        if (err.rowNumber) {
          rowIdentifier = `Excel Row ${err.rowNumber}`;
        } else if (err.rowData) { 
          const username = err.rowData['Username'];
          const email = err.rowData['Email'];
          if (username || email) {
            rowIdentifier = `Row (Username: ${username || 'N/A'}, Email: ${email || 'N/A'})`;
          } else {
            
            const firstFewEntries = Object.entries(err.rowData).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ');
            rowIdentifier = firstFewEntries ? `Row data starting with (${firstFewEntries})` : 'Problematic row data';
          }
        } else {
          rowIdentifier = "Details for a row unavailable";
        }
        
        return `  • ${rowIdentifier}: ${err.error}`; 
      }).join('\n');
      
      notificationDescription = `Details for the first ${Math.min(3, responseErrors.length)} errors:\n${errorDetails}`;
    }

    const notificationConfig = {
      message: notificationMessage,
      description: notificationDescription,
      duration: responseErrors.length > 0 ? 10 : 4.5, 
    };

    if (responseErrors.length > 0 && successCount === 0) {
      notification.error(notificationConfig); 
    } else if (responseErrors.length > 0 && successCount > 0) {
      notification.warning(notificationConfig); 
    } else { 
      notification.success(notificationConfig);
    }
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
    sorter: (a, b) => {
      const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim();
      const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim();
      return nameA.localeCompare(nameB);
    },
  },
  {
    title: "Tên đăng nhập",
    dataIndex: "username",
    key: "username",
    sorter: (a, b) => a.username.localeCompare(b.username),
  },
  {
    title: "Email",
    dataIndex: "email",
    key: "email",
    sorter: (a, b) => a.email.localeCompare(b.email),
  },
  
  {
    title: "Phòng ban",
    dataIndex: "department",
    key: "department",
    sorter: (a, b) => {
      const deptA = a.department?.name || "";
      const deptB = b.department?.name || "";
      return deptA.localeCompare(deptB);
    },
  },
  {
    title: "Bộ phận",
    dataIndex: "section",
    key: "section",
    sorter: (a, b) => {
      const sectionA = a.section?.name || "";
      const sectionB = b.section?.name || "";
      return sectionA.localeCompare(sectionB);
    },
  },
  {
    title: "Vai trò",
    dataIndex: "role",
    key: "role",
    sorter: (a, b) => (a.role || "").localeCompare(b.role || ""),
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
