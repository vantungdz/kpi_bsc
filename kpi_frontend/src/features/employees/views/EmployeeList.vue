<template>
  <div class="employee-list">
    <div class="header">
      <h2>{{ $t("employeeListTitle") }}</h2>
      <div>
        <a-input-search v-model:value="searchText" :placeholder="$t('searchEmployeePlaceholder')"
          style="width: 220px; margin-right: 8px;" @search="onSearch" allow-clear />
        <a-button type="primary" @click="openAddModal">
          {{ $t("addEmployee") }}
        </a-button>
        <a-button style="margin-left:8px" @click="openUploadModal">
          {{ $t("uploadEmployeeExcel") }}
        </a-button>
        <a-button style="margin-left:8px" @click="exportExcel">
          {{ $t("exportExcel") }}
        </a-button>
      </div>
    </div>
    <div class="filters">
      <a-select v-model:value="filterRole" :placeholder="$t('role')" allow-clear
        style="width: 140px; margin-right: 8px;">
        <a-select-option v-for="role in roles" :key="role.value" :value="role.value">{{ $t(role.label)
          }}</a-select-option>
      </a-select>
      <a-select v-model:value="filterDepartment" :placeholder="$t('departmentLabel')" allow-clear
        style="width: 160px; margin-right: 8px;">
        <a-select-option v-for="dept in departmentList" :key="dept.id" :value="dept.id">{{ dept.name
          }}</a-select-option>
      </a-select>
      <a-select v-model:value="filterSection" :placeholder="$t('section')" allow-clear style="width: 160px;">
        <a-select-option v-for="sec in sectionList" :key="sec.id" :value="sec.id">{{ sec.name }}</a-select-option>
      </a-select>
    </div>
    <a-modal :open="isUploadModalVisible" :title="$t('uploadEmployeeExcel')" @ok="handleUpload"
      @cancel="closeUploadModal" :confirm-loading="uploading">
      <a-upload :before-upload="beforeUpload" :file-list="fileList" @remove="handleRemove" accept=".xlsx, .xls">
        <a-button> <upload-outlined /> {{ $t("selectFile") }} </a-button>
      </a-upload>
    </a-modal>
    <a-modal :open="isAddEditModalVisible" :title="editEmployee ? $t('editEmployee') : $t('addEmployee')"
      @ok="handleAddEditEmployee" @cancel="closeAddEditModal" :confirm-loading="savingEmployee" destroyOnClose>
      <a-form :model="employeeForm" layout="vertical">
        <a-form-item :label="$t('username')">
          <a-input v-model:value="employeeForm.username" :disabled="!!editEmployee" />
        </a-form-item>
        <a-form-item :label="$t('email')">
          <a-input v-model:value="employeeForm.email" />
        </a-form-item>
        <a-form-item :label="$t('firstName')">
          <a-input v-model:value="employeeForm.first_name" />
        </a-form-item>
        <a-form-item :label="$t('lastName')">
          <a-input v-model:value="employeeForm.last_name" />
        </a-form-item>
        <a-form-item :label="$t('role')">
          <a-select v-model:value="employeeForm.role">
            <a-select-option v-for="role in roles" :key="role.value" :value="role.value">{{ $t(role.label)
              }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('departmentLabel')">
          <a-select v-model:value="employeeForm.departmentId" allow-clear>
            <a-select-option v-for="dept in departmentList" :key="dept.id" :value="dept.id">{{ dept.name
              }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('section')">
          <a-select v-model:value="employeeForm.sectionId" allow-clear>
            <a-select-option v-for="sec in sectionListForForm" :key="sec.id" :value="sec.id">{{ sec.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="!editEmployee" :label="$t('password')">
          <a-input-password v-model:value="employeeForm.password" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-table :columns="columns" :data-source="filteredEmployees" row-key="id" :pagination="pagination"
      @change="onTableChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'fullName'">
          {{ record.first_name }} {{ record.last_name }}
        </template>
        <template v-else-if="column.dataIndex === 'department'">
          {{ record.department?.name || $t('noData') }}
        </template>
        <template v-else-if="column.dataIndex === 'section'">
          {{ record.section?.name || $t('noData') }}
        </template>
        <template v-else-if="column.dataIndex === 'role'">
          {{ $t(record.role) || $t('noData') }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-space>
            <a-button type="link" size="small" @click="viewDetail(record)">
              <eye-outlined /> {{ $t('viewDetail') }}
            </a-button>
            <a-button type="link" size="small" @click="openEditModal(record)">
              <edit-outlined /> {{ $t('edit') }}
            </a-button>
            <a-button type="link" size="small" danger @click="confirmDelete(record)">
              <delete-outlined /> {{ $t('delete') }}
            </a-button>
            <a-button type="link" size="small" @click="openResetPasswordModal(record)">
              <key-outlined /> {{ $t('resetPassword') }}
            </a-button>
            <a-button type="link" size="small" @click="viewReviewHistory(record)">
              <history-outlined />
              {{ $t('reviewHistory') }}
            </a-button>
          </a-space>
        </template>
        <template v-else-if="column.dataIndex && record.hasOwnProperty(column.dataIndex)">
          {{ record[column.dataIndex] || $t('noData') }}
        </template>
        <template v-else> {{ $t('noData') }} </template>
      </template>
    </a-table>
    <a-modal :open="isDetailModalVisible" :title="$t('employeeDetail')" @cancel="closeDetailModal" width="1000px"
      destroyOnClose>
      <a-descriptions v-if="detailEmployee" bordered column="1" size="middle">
        <a-descriptions-item :label="$t('username')">
          <user-outlined style="margin-right:4px" />{{ detailEmployee.username }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('email')">
            <mail-outlined style="margin-right:4px" />{{ detailEmployee.email }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('fullName')">
            <idcard-outlined style="margin-right:4px" />{{ detailEmployee.first_name }} {{ detailEmployee.last_name }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('role')">
            <safety-certificate-outlined style="margin-right:4px" />{{ $t(detailEmployee.role) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('departmentLabel')">
            <apartment-outlined style="margin-right:4px" />{{ detailEmployee.department?.name || $t('noData') }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('section')">
            <cluster-outlined style="margin-right:4px" />{{ detailEmployee.section?.name || $t('noData') }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('createdAt')">
            <calendar-outlined style="margin-right:4px" />{{ detailEmployee.created_at }}
          </a-descriptions-item>
      </a-descriptions>
    </a-modal>
    <a-modal
      :open="isResetPasswordModalVisible"
      :title="$t('resetPassword')"
      @ok="handleResetPassword"
      @cancel="closeResetPasswordModal"
      :confirm-loading="store.getters['employees/isLoading']"
    >
      <div>
        <p>{{ $t('resetPasswordInstruction') }}</p>
        <a-input-password v-model:value="resetPasswordValue" :placeholder="$t('enterNewPasswordOrLeaveBlank')" allow-clear />
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useStore } from "vuex";
import { notification } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import ExcelJS from "exceljs";
import {
  Button as AButton,
  Modal as AModal,
  Upload as AUpload,
  Table as ATable,
  Space as ASpace,
  Input as AInput,
  InputSearch as AInputSearch,
  Select as ASelect,
  Form as AForm,
  FormItem as AFormItem,
  InputPassword as AInputPassword,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
} from "ant-design-vue";
import { UploadOutlined, HistoryOutlined, EyeOutlined, EditOutlined, DeleteOutlined, KeyOutlined, UserOutlined, MailOutlined, IdcardOutlined, SafetyCertificateOutlined, ApartmentOutlined, ClusterOutlined, CalendarOutlined } from "@ant-design/icons-vue";
import { useRouter } from "vue-router";

const { t: $t } = useI18n();
const store = useStore();
const router = useRouter();
const employees = computed(() => store.getters["employees/userList"]);
const departmentList = computed(() => store.getters["departments/departmentList"] || []);
const sectionList = computed(() => {
  if (filterDepartment.value) {
    return store.getters["sections/sectionsByDepartment"](filterDepartment.value) || [];
  }
  return store.getters["sections/sectionList"] || [];
});
const sectionListForForm = computed(() => {
  if (employeeForm.value.departmentId) {
    return store.getters["sections/sectionsByDepartment"](employeeForm.value.departmentId) || [];
  }
  return store.getters["sections/sectionList"] || [];
});
const searchText = ref("");
const filterRole = ref();
const filterDepartment = ref();
const filterSection = ref();
const isUploadModalVisible = ref(false);
const isAddEditModalVisible = ref(false);
const isDetailModalVisible = ref(false);
const isResetPasswordModalVisible = ref(false);
const fileList = ref([]);
const uploading = ref(false);
const savingEmployee = ref(false);
const editEmployee = ref(null);
const detailEmployee = ref(null);
const resetPasswordEmployee = ref(null);
const resetPasswordValue = ref("");
const employeeForm = ref({
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  role: "employee",
  departmentId: undefined,
  sectionId: undefined,
  password: "",
});
const roles = [
  { value: "admin", label: "admin" },
  { value: "manager", label: "manager" },
  { value: "department", label: "department" },
  { value: "section", label: "section" },
  { value: "employee", label: "employee" },
];
const pagination = ref({ pageSize: 10, current: 1, showSizeChanger: true });

const filteredEmployees = computed(() => {
  let list = employees.value;
  if (searchText.value) {
    const search = searchText.value.toLowerCase();
    list = list.filter(
      (e) =>
        e.username?.toLowerCase().includes(search) ||
        e.email?.toLowerCase().includes(search) ||
        e.first_name?.toLowerCase().includes(search) ||
        e.last_name?.toLowerCase().includes(search)
    );
  }
  if (filterRole.value) list = list.filter((e) => e.role?.name === filterRole.value);
  if (filterDepartment.value) list = list.filter((e) => e.department?.id === filterDepartment.value);
  if (filterSection.value) list = list.filter((e) => e.section?.id === filterSection.value);
  return list;
});

const onSearch = () => {
  pagination.value.current = 1;
};

const onTableChange = (pag) => {
  pagination.value = { ...pagination.value, ...pag };
};

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
    notification.error({ message: $t("noFileSelected"), description: $t("selectFile") });
    return;
  }
  uploading.value = true;
  try {
    const file = fileList.value[0];
    const response = await store.dispatch("employees/uploadFile", file.originFileObj || file);
    const successCount = response?.successCount || 0;
    const responseErrors = response?.errors || [];
    const notificationMessage = response?.message || $t("importResult", { successCount, errorCount: responseErrors.length });
    let notificationDescription = "";
    if (responseErrors.length > 0) {
      const errorDetails = responseErrors.slice(0, 3).map((err) => {
        let rowIdentifier = "";
        if (err.rowNumber) rowIdentifier = `Excel Row ${err.rowNumber}`;
        else if (err.rowData) {
          const username = err.rowData["Username"];
          const email = err.rowData["Email"];
          if (username || email) rowIdentifier = `Row (Username: ${username || ""}, Email: ${email || ""})`;
          else {
            const firstFewEntries = Object.entries(err.rowData).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(", ");
            rowIdentifier = firstFewEntries ? `Row data starting with (${firstFewEntries})` : "Problematic row data";
          }
        } else rowIdentifier = "Details for a row unavailable";
        return `  • ${rowIdentifier}: ${err.error}`;
      }).join("\n");
      notificationDescription = $t("importErrorDetails", { count: Math.min(3, responseErrors.length), details: errorDetails });
    }
    const notificationConfig = {
      message: notificationMessage,
      description: notificationDescription,
      duration: responseErrors.length > 0 ? 10 : 4.5,
    };
    if (responseErrors.length > 0 && successCount === 0) notification.error(notificationConfig);
    else if (responseErrors.length > 0 && successCount > 0) notification.warning(notificationConfig);
    else notification.success(notificationConfig);
    await store.dispatch("employees/fetchUsers", { force: true });
  } catch (error) {
    notification.error({ message: $t("uploadFailed"), description: error.message || $t("uploadErrorDefault") });
  } finally {
    uploading.value = false;
    isUploadModalVisible.value = false;
    fileList.value = [];
  }
};
const openAddModal = () => {
  editEmployee.value = null;
  Object.assign(employeeForm.value, { username: "", email: "", first_name: "", last_name: "", role: "employee", departmentId: undefined, sectionId: undefined, password: "" });
  isAddEditModalVisible.value = true;
};
const openEditModal = (employee) => {
  editEmployee.value = employee;
  Object.assign(employeeForm.value, {
    ...employee,
    departmentId: employee.department?.id,
    sectionId: employee.section?.id,
    role: employee.role?.name || "employee",
    password: "",
  });
  isAddEditModalVisible.value = true;
};
const closeAddEditModal = () => {
  isAddEditModalVisible.value = false;
  editEmployee.value = null;
};
const handleAddEditEmployee = async () => {
  savingEmployee.value = true;
  try {
    if (editEmployee.value) {
      await store.dispatch("employees/updateEmployee", { ...employeeForm.value, id: editEmployee.value.id });
      notification.success({ message: $t("updateEmployeeSuccess") });
    } else {
      await store.dispatch("employees/createEmployee", { ...employeeForm.value });
      notification.success({ message: $t("addEmployeeSuccess") });
    }
    await store.dispatch("employees/fetchUsers", { force: true });
    isAddEditModalVisible.value = false;
  } catch (e) {
    notification.error({ message: $t("saveEmployeeError"), description: e.message || $t("saveEmployeeErrorDefault") });
  } finally {
    savingEmployee.value = false;
  }
};
const confirmDelete = (employee) => {
  AModal.confirm({
    title: $t("deleteEmployeeConfirm"),
    content: `${employee.username} (${employee.email})`,
    okText: $t("delete"),
    okType: "danger",
    cancelText: $t("cancel"),
    onOk: async () => {
      try {
        await store.dispatch("employees/deleteEmployee", employee.id);
        notification.success({ message: $t("deleteEmployeeSuccess") });
        await store.dispatch("employees/fetchUsers", { force: true });
      } catch (e) {
        notification.error({ message: $t("deleteEmployeeError"), description: e.message || $t("deleteEmployeeErrorDefault") });
      }
    },
  });
};
const openResetPasswordModal = (employee) => {
  resetPasswordEmployee.value = employee;
  resetPasswordValue.value = "";
  isResetPasswordModalVisible.value = true;
};
const closeResetPasswordModal = () => {
  isResetPasswordModalVisible.value = false;
  resetPasswordEmployee.value = null;
  resetPasswordValue.value = "";
};
const handleResetPassword = async () => {
  if (!resetPasswordEmployee.value) return;
  try {
    await store.dispatch("employees/resetPassword", {
      id: resetPasswordEmployee.value.id,
      newPassword: resetPasswordValue.value || undefined,
    });
    notification.success({ message: $t("resetPasswordSuccess") });
    closeResetPasswordModal();
  } catch (e) {
    notification.error({ message: $t("resetPasswordError"), description: e.message || $t("resetPasswordErrorDefault") });
  }
};
const viewDetail = async (employee) => {
  detailEmployee.value = await store.dispatch("employees/fetchUserById", employee.id);
  isDetailModalVisible.value = true;
};
const closeDetailModal = () => {
  isDetailModalVisible.value = false;
  detailEmployee.value = null;
};
const exportExcel = async () => {
  const data = filteredEmployees.value.map((e) => ({
    Username: e.username,
    Email: e.email,
    "First Name": e.first_name,
    "Last Name": e.last_name,
    Role: $t(e.role),
    Department: e.department?.name || "",
    Section: e.section?.name || "",
  }));
  if (data.length === 0) {
    notification.info({ message: $t("noDataToExport") });
    return;
  }
  // Tạo workbook và worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Employees", {
    views: [{ state: "frozen", ySplit: 2 }], // freeze 2 dòng đầu
  });
  // Định nghĩa cột
  const columns = [
    { header: "Username", key: "Username", width: 18 },
    { header: "Email", key: "Email", width: 30 },
    { header: "First Name", key: "First Name", width: 18 },
    { header: "Last Name", key: "Last Name", width: 18 },
    { header: "Role", key: "Role", width: 14 },
    { header: "Department", key: "Department", width: 30 },
    { header: "Section", key: "Section", width: 22 },
  ];
  worksheet.columns = columns;
  // Thêm title
  const title = "Danh sách nhân viên";
  worksheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: "Arial", size: 18, bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.border = {
    top: { style: "thin", color: { argb: "FFBFBFBF" } },
    left: { style: "thin", color: { argb: "FFBFBFBF" } },
    bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
    right: { style: "thin", color: { argb: "FFBFBFBF" } },
  };
  worksheet.getRow(1).height = 32;
  // Thêm header row thủ công vào dòng 2
  worksheet.insertRow(2, columns.map(col => col.header));
  // Header style (dòng 2)
  worksheet.getRow(2).eachCell((cell) => {
    cell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0050B3" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFBFBFBF" } },
      left: { style: "thin", color: { argb: "FFBFBFBF" } },
      bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
      right: { style: "thin", color: { argb: "FFBFBFBF" } },
    };
  });
  // Thêm dữ liệu bắt đầu từ dòng 3
  data.forEach((row) => worksheet.addRow(row));
  // Style cho toàn bộ bảng
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // đã style title riêng
    row.height = 24;
    row.eachCell((cell) => {
      cell.font = cell.font || { name: "Arial", size: 12 };
      cell.alignment = cell.alignment || { vertical: "middle", horizontal: "left", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFBFBFBF" } },
        left: { style: "thin", color: { argb: "FFBFBFBF" } },
        bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
        right: { style: "thin", color: { argb: "FFBFBFBF" } },
      };
    });
    // Căn giữa cho header
    if (rowNumber === 2) row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  // Freeze header
  worksheet.views = [{ state: "frozen", ySplit: 2 }];
  // Auto filter cho vùng dữ liệu (bắt đầu từ dòng 2)
  worksheet.autoFilter = {
    from: "A2",
    to: String.fromCharCode(65 + columns.length - 1) + "2",
  };
  // Xuất file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "employees.xlsx";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
  notification.success({ message: $t("exportExcelSuccess") });
};
const viewReviewHistory = (employee) => {
  router.push({ name: "ReviewHistory", params: { targetType: "employee", targetId: employee.id } });
};
onMounted(async () => {
  await store.dispatch("employees/fetchUsers", { force: true });
  await store.dispatch("departments/fetchDepartments");
  await store.dispatch("sections/fetchSections");
});
// Khi chọn department thì fetch section theo department nếu chưa có
watch(
  () => filterDepartment.value,
  async (newVal) => {
    if (newVal) {
      await store.dispatch("sections/fetchSectionsByDepartment", newVal);
      filterSection.value = undefined; // reset section filter khi đổi department
    }
  }
);
watch(
  () => employeeForm.value.departmentId,
  (newVal) => {
    if (newVal) {
      employeeForm.value.sectionId = undefined;
      store.dispatch("sections/fetchSectionsByDepartment", newVal);
    }
  }
);
const columns = computed(() => [
  { title: $t("employeeFullName") || "Tên nhân viên", dataIndex: "fullName", key: "fullName", sorter: (a, b) => `${a.first_name || ""} ${a.last_name || ""}`.trim().localeCompare(`${b.first_name || ""} ${b.last_name || ""}`.trim()) },
  { title: $t("username"), dataIndex: "username", key: "username", sorter: (a, b) => a.username.localeCompare(b.username) },
  { title: $t("email"), dataIndex: "email", key: "email", sorter: (a, b) => a.email.localeCompare(b.email) },
  { title: $t("departmentLabel"), dataIndex: "department", key: "department", sorter: (a, b) => (a.department?.name || "").localeCompare(b.department?.name || "") },
  { title: $t("section"), dataIndex: "section", key: "section", sorter: (a, b) => (a.section?.name || "").localeCompare(b.section?.name || "") },
  { title: $t("role"), dataIndex: "role", key: "role", sorter: (a, b) => (a.role || "").localeCompare(b.role || "") },
  { title: $t("actions"), dataIndex: "actions", key: "actions", align: "center" },
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
.filters {
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
}
</style>
