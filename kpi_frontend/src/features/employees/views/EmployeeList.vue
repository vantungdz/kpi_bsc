<template>
  <div class="employee-list" v-if="canViewEmployee">
    <div class="header">
      <h2
        style="
          display: flex;
          align-items: center;
          gap: 8px;
          color: #1a237e;
          font-weight: 700;
        "
      >
        <user-outlined
          style="font-size: 1.5em; color: #1976d2; margin-right: 4px"
        />
        {{ $t("employeeListTitle") }}
      </h2>
      <div style="display: flex; align-items: center; gap: 8px">
        <a-input-search
          v-model:value="searchText"
          :placeholder="$t('searchEmployeePlaceholder')"
          style="width: 220px; margin-right: 8px"
          @search="onSearch"
          allow-clear
        >
          <template #prefix>
            <search-outlined style="color: #1976d2" />
          </template>
        </a-input-search>
        <a-button
          type="primary"
          @click="openAddModal"
          v-if="canCreateEmployee"
          style="display: flex; align-items: center; gap: 4px"
        >
          <user-add-outlined /> {{ $t("addEmployee") }}
        </a-button>
        <a-button
          style="margin-left: 8px; display: flex; align-items: center; gap: 4px"
          @click="openUploadModal"
          v-if="canCreateEmployee"
        >
          <upload-outlined /> {{ $t("uploadEmployeeExcel") }}
        </a-button>
        <a-button
          style="margin-left: 8px; display: flex; align-items: center; gap: 4px"
          @click="exportExcel"
          v-if="canCreateEmployee"
        >
          <file-excel-outlined /> {{ $t("exportExcel") }}
        </a-button>
      </div>
    </div>
    <div class="filters">
      <a-select
        v-model:value="filterRole"
        :placeholder="$t('role')"
        allow-clear
        style="width: 140px; margin-right: 8px"
      >
        <template #suffixIcon>
          <safety-certificate-outlined style="color: #1976d2" />
        </template>
        <a-select-option
          v-for="role in roles"
          :key="role.id"
          :value="role.name"
        >
          {{ $t(role.name) }}
        </a-select-option>
      </a-select>
      <a-select
        v-model:value="filterDepartment"
        :placeholder="$t('departmentLabel')"
        allow-clear
        style="width: 160px; margin-right: 8px"
      >
        <template #suffixIcon>
          <apartment-outlined style="color: #1976d2" />
        </template>
        <a-select-option
          v-for="dept in departmentList"
          :key="dept.id"
          :value="dept.id"
          >{{ dept.name }}</a-select-option
        >
      </a-select>
      <a-select
        v-model:value="filterSection"
        :placeholder="$t('section')"
        allow-clear
        style="width: 160px"
      >
        <template #suffixIcon>
          <cluster-outlined style="color: #1976d2" />
        </template>
        <a-select-option
          v-for="sec in sectionList"
          :key="sec.id"
          :value="sec.id"
          >{{ sec.name }}</a-select-option
        >
      </a-select>
    </div>
    <a-modal
      :open="isUploadModalVisible"
      :title="$t('uploadEmployeeExcel')"
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
        <a-button> <upload-outlined /> {{ $t("selectFile") }} </a-button>
      </a-upload>
    </a-modal>
    <a-modal
      :open="isAddEditModalVisible"
      :title="editEmployee ? $t('editEmployee') : $t('addEmployee')"
      @ok="submitAddEditEmployeeForm"
      @cancel="closeAddEditModal"
      :confirm-loading="savingEmployee"
      destroyOnClose
    >
      <a-form
        ref="addEditEmployeeFormRef"
        :model="employeeForm"
        :rules="{
          username: [{ required: true, message: $t('usernameRequired') }],
          email: [
            { required: true, message: $t('emailRequired') },
            { type: 'email', message: $t('emailInvalid') },
          ],
          first_name: [{ required: true, message: $t('firstNameRequired') }],
          last_name: [{ required: true, message: $t('lastNameRequired') }],
          roles: [{ required: true, message: $t('roleRequired') }],
          password: [
            { required: !editEmployee, message: $t('passwordRequired') },
          ],
        }"
        layout="vertical"
      >
        <a-form-item :label="$t('username')" name="username">
          <a-input
            v-model:value="employeeForm.username"
            :disabled="!!editEmployee"
          />
        </a-form-item>
        <a-form-item :label="$t('email')" name="email">
          <a-input v-model:value="employeeForm.email" />
        </a-form-item>
        <a-form-item :label="$t('firstName')" name="first_name">
          <a-input v-model:value="employeeForm.first_name" />
        </a-form-item>
        <a-form-item :label="$t('lastName')" name="last_name">
          <a-input v-model:value="employeeForm.last_name" />
        </a-form-item>
        <a-form-item :label="$t('role')" name="roles">
          <a-select
            v-model:value="employeeForm.roles"
            mode="multiple"
            allow-clear
          >
            <a-select-option
              v-for="role in roles"
              :key="role.id"
              :value="role.name"
            >
              {{ $t(role.name) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('departmentLabel')" name="departmentId">
          <a-select v-model:value="employeeForm.departmentId" allow-clear>
            <a-select-option
              v-for="dept in departmentList"
              :key="dept.id"
              :value="dept.id"
            >
              {{ dept.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('section')" name="sectionId">
          <a-select v-model:value="employeeForm.sectionId" allow-clear>
            <a-select-option
              v-for="sec in sectionListForForm"
              :key="sec.id"
              :value="Number(sec.id)"
            >
              {{ sec.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item
          v-if="!editEmployee"
          :label="$t('password')"
          name="password"
        >
          <a-input-password v-model:value="employeeForm.password" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-table
      :columns="columns"
      :data-source="filteredEmployees"
      row-key="id"
      :pagination="pagination"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'fullName'">
          {{ record.first_name }} {{ record.last_name }}
        </template>
        <template v-else-if="column.dataIndex === 'department'">
          {{ record.department?.name || $t("noData") }}
        </template>
        <template v-else-if="column.dataIndex === 'section'">
          {{ record.section?.name || $t("noData") }}
        </template>
        <template v-else-if="column.dataIndex === 'role'">
          <span v-if="Array.isArray(record.roles) && record.roles.length">
            <a-tag
              v-for="r in record.roles"
              :key="typeof r === 'string' ? r : r?.name"
              color="blue"
              style="margin-right: 2px"
            >
              {{ $t(typeof r === "string" ? r : r?.name) }}
            </a-tag>
          </span>
          <span v-else style="color: #aaa">{{ $t("noRole") }}</span>
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-space>
            <a-button type="link" size="small" @click="viewDetail(record)">
              <eye-outlined /> {{ $t("viewDetail") }}
            </a-button>
            <a-button
              type="link"
              size="small"
              @click="openEditModal(record)"
              v-if="canEditEmployee"
            >
              <edit-outlined /> {{ $t("edit") }}
            </a-button>
            <a-button
              type="link"
              size="small"
              danger
              @click="confirmDelete(record)"
              v-if="canDeleteEmployee"
            >
              <delete-outlined /> {{ $t("delete") }}
            </a-button>
            <a-button
              type="link"
              size="small"
              @click="openResetPasswordModal(record)"
              v-if="canResetPassword"
            >
              <key-outlined /> {{ $t("resetPassword") }}
            </a-button>
          </a-space>
        </template>
        <template
          v-else-if="
            column.dataIndex && record.hasOwnProperty(column.dataIndex)
          "
        >
          {{ record[column.dataIndex] || $t("noData") }}
        </template>
        <template v-else> {{ $t("noData") }} </template>
      </template>
    </a-table>
    <a-modal
      :open="isDetailModalVisible"
      :title="$t('employeeDetail')"
      @cancel="closeDetailModal"
      width="1000px"
      destroyOnClose
    >
      <a-descriptions v-if="detailEmployee" bordered column="1" size="middle">
        <a-descriptions-item :label="$t('username')">
          <user-outlined style="margin-right: 4px" />{{
            detailEmployee.username
          }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('email')">
          <mail-outlined style="margin-right: 4px" />{{ detailEmployee.email }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('fullName')">
          <idcard-outlined style="margin-right: 4px" />{{
            detailEmployee.first_name
          }}
          {{ detailEmployee.last_name }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('role')">
          <safety-certificate-outlined style="margin-right: 4px" />
          <span
            v-if="
              Array.isArray(detailEmployee?.roles) &&
              detailEmployee.roles.length
            "
          >
            <a-tag
              v-for="r in detailEmployee.roles"
              :key="typeof r === 'string' ? r : r?.name"
              color="blue"
              style="margin-right: 2px"
            >
              {{ $t(typeof r === "string" ? r : r?.name) }}
            </a-tag>
          </span>
          <span v-else style="color: #aaa">{{ $t("noRole") }}</span>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('departmentLabel')">
          <apartment-outlined style="margin-right: 4px" />{{
            detailEmployee.department?.name || $t("noData")
          }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('section')">
          <cluster-outlined style="margin-right: 4px" />{{
            detailEmployee.section?.name || $t("noData")
          }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('createdAt')">
          <calendar-outlined style="margin-right: 4px" />{{
            detailEmployee.created_at
          }}
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
        <p>{{ $t("resetPasswordInstruction") }}</p>
        <a-input-password
          v-model:value="resetPasswordValue"
          :placeholder="$t('enterNewPasswordOrLeaveBlank')"
          allow-clear
        />
      </div>
    </a-modal>
    <a-drawer
      :open="isDetailDrawerVisible"
      :title="null"
      @close="closeDetailDrawer"
      width="480px"
      placement="right"
      destroyOnClose
      class="employee-detail-drawer"
    >
      <div class="drawer-header">
        <a-avatar
          :size="96"
          :src="detailEmployee?.avatarUrl || undefined"
          style="
            margin-bottom: 12px;
            background: #e3e7ef;
            font-size: 2.5rem;
            box-shadow: 0 2px 8px #e3eaf344;
          "
        >
          <template v-if="!detailEmployee?.avatarUrl">
            <user-outlined />
          </template>
        </a-avatar>
        <div class="drawer-title">
          <idcard-outlined
            style="margin-right: 6px; color: #1976d2; font-size: 1.1em"
          />
          {{ detailEmployee?.first_name || "" }}
          {{ detailEmployee?.last_name || "" }}
        </div>
        <div class="drawer-sub">
          <user-outlined style="margin-right: 4px; color: #607d8b" />
          {{ detailEmployee?.username || $t("noData") }}
        </div>
      </div>
      <a-descriptions
        v-if="detailEmployee"
        bordered
        :column="1"
        size="middle"
        :label-style="{
          fontWeight: 'bold',
          minWidth: '120px',
          background: '#f5f8fd',
          color: '#1976d2',
        }"
        :content-style="{ minWidth: '180px', background: '#fff' }"
        class="drawer-desc"
      >
        <a-descriptions-item :label="$t('email')">
          <mail-outlined style="margin-right: 4px; color: #1976d2" />{{
            detailEmployee.email || $t("noData")
          }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('role')">
          <safety-certificate-outlined
            style="margin-right: 4px; color: #1976d2"
          />
          <template
            v-if="
              Array.isArray(detailEmployee?.roles) &&
              detailEmployee.roles.length
            "
          >
            <a-tag
              v-for="role in detailEmployee.roles"
              :key="role.id || role.name || role"
              :color="roleColor()"
              style="margin-right: 4px; margin-bottom: 2px"
            >
              {{ typeof role === "string" ? role : role?.name || $t("noData") }}
            </a-tag>
          </template>
          <span v-else style="color: #aaa">{{ $t("noRole") }}</span>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('departmentLabel')">
          <apartment-outlined style="margin-right: 4px; color: #1976d2" />{{
            detailEmployee.department?.name || $t("noData")
          }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('section')">
          <cluster-outlined style="margin-right: 4px; color: #1976d2" />{{
            detailEmployee.section?.name || $t("noData")
          }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('createdAt')">
          <calendar-outlined style="margin-right: 4px; color: #1976d2" />{{
            formatDate(detailEmployee.created_at)
          }}
        </a-descriptions-item>
      </a-descriptions>
      <div
        v-if="
          detailEmployee &&
          detailEmployee.skills &&
          detailEmployee.skills.length
        "
        class="employee-skill-block"
      >
        <div class="skill-block-title">
          <star-outlined
            style="margin-right: 6px; color: #faad14; font-size: 1.1em"
          />{{ $t("employeeSkill.skills") }}
        </div>
        <div class="skill-list">
          <div
            v-for="skill in detailEmployee.skills"
            :key="skill.skillId"
            class="skill-item"
          >
            <span class="skill-name"
              ><star-outlined style="margin-right: 3px; color: #faad14" />{{
                skill.skillName
              }}</span
            >
            <a-rate
              :value="skill.level"
              :count="5"
              allow-half
              disabled
              style="margin-left: 10px; font-size: 1.1em"
            />
          </div>
        </div>
      </div>
    </a-drawer>
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
import {
  UploadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  UserOutlined,
  MailOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  CalendarOutlined,
  StarOutlined,
  SearchOutlined,
  UserAddOutlined,
  FileExcelOutlined,
} from "@ant-design/icons-vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import dayjs from "dayjs";

const { t: $t } = useI18n();
const store = useStore();
const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);
function hasPermission(action, resource, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action?.trim() === action &&
      p.resource?.trim() === resource &&
      (scope ? p.scope?.trim() === scope : true)
  );
}

const canCreateEmployee = computed(() =>
  hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.EMPLOYEE, "company")
);
const canEditEmployee = computed(() =>
  hasPermission(RBAC_ACTIONS.UPDATE, RBAC_RESOURCES.EMPLOYEE, "company")
);
const canDeleteEmployee = computed(() =>
  hasPermission(RBAC_ACTIONS.DELETE, RBAC_RESOURCES.EMPLOYEE, "company")
);
const canResetPassword = computed(() =>
  hasPermission(RBAC_ACTIONS.UPDATE, RBAC_RESOURCES.EMPLOYEE, "company")
);
const canViewEmployee = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE, "company")
);

const employees = computed(() => store.getters["employees/userList"]);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const sectionList = computed(() => {
  if (filterDepartment.value) {
    return (
      store.getters["sections/sectionsByDepartment"](filterDepartment.value) ||
      []
    );
  }
  return store.getters["sections/sectionList"] || [];
});
const sectionListForForm = computed(() => {
  if (employeeForm.value.departmentId) {
    return (
      store.getters["sections/sectionsByDepartment"](
        employeeForm.value.departmentId
      ) || []
    );
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
const isDetailDrawerVisible = ref(false);
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
  roles: [],
  departmentId: undefined,
  sectionId: undefined,
  password: "",
});

const isEditingEmployee = ref(false);

const roles = computed(() => store.getters["roles/roleList"] || []);
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

  if (filterRole.value) {
    list = list.filter((e) => {
      if (Array.isArray(e.roles)) {
        return e.roles.some(
          (r) => (typeof r === "string" ? r : r?.name) === filterRole.value
        );
      }
      if (e.role) {
        if (typeof e.role === "string") return e.role === filterRole.value;
        if (typeof e.role === "object" && e.role?.name)
          return e.role.name === filterRole.value;
      }
      return false;
    });
  }
  if (filterDepartment.value)
    list = list.filter((e) => e.department?.id === filterDepartment.value);
  if (filterSection.value)
    list = list.filter((e) => e.section?.id === filterSection.value);
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
    notification.error({
      message: $t("noFileSelected"),
      description: $t("selectFile"),
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
    const successCount = response?.successCount || 0;
    const responseErrors = response?.errors || [];
    const notificationMessage =
      response?.message ||
      $t("importResult", { successCount, errorCount: responseErrors.length });
    // Show detailed error modal if there are errors
    if (responseErrors.length > 0) {
      const errorCount = Math.min(3, responseErrors.length);
      const errorDetails = responseErrors
        .slice(0, 3)
        .map((err) => {
          let rowIdentifier = "";
          if (err.rowNumber) rowIdentifier = `Excel Row ${err.rowNumber}`;
          else if (err.rowData) {
            const username = err.rowData["Username"];
            const email = err.rowData["Email"];
            if (username || email)
              rowIdentifier = `Row (Username: ${username || ""}, Email: ${email || ""})`;
            else {
              const firstFewEntries = Object.entries(err.rowData)
                .slice(0, 2)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ");
              rowIdentifier = firstFewEntries
                ? `Row data starting with (${firstFewEntries})`
                : "Problematic row data";
            }
          } else rowIdentifier = "Details for a row unavailable";
          return `• ${rowIdentifier}: ${err.error}`;
        })
        .join("\n");

      const errorMessage = `${$t("importErrorDetailsTitle", { count: errorCount })}\n${errorDetails}`;

      AModal.error({
        title: notificationMessage,
        content: errorMessage,
        width: 600,
        style: { whiteSpace: "pre-line" },
      });
    } else {
      notification.success({
        message: notificationMessage,
        duration: 4.5,
      });
    }
    await store.dispatch("employees/fetchUsers", { force: true });
  } catch (error) {
    notification.error({
      message: $t("uploadFailed"),
      description: error.message || $t("uploadErrorDefault"),
    });
  } finally {
    uploading.value = false;
    isUploadModalVisible.value = false;
    fileList.value = [];
  }
};
const openAddModal = () => {
  editEmployee.value = null;
  Object.assign(employeeForm.value, {
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    roles: [],
    departmentId: undefined,
    sectionId: undefined,
    password: "",
  });
  isAddEditModalVisible.value = true;
};

function getSectionIdFromEmployee(employee) {
  if (employee.sectionId !== undefined && employee.sectionId !== null)
    return Number(employee.sectionId);
  if (
    employee.section &&
    employee.section.id !== undefined &&
    employee.section.id !== null
  )
    return Number(employee.section.id);

  if (
    Array.isArray(employee.sections) &&
    employee.sections.length > 0 &&
    employee.sections[0].id !== undefined
  )
    return Number(employee.sections[0].id);

  if (employee.section_code && sectionListForForm.value) {
    const found = sectionListForForm.value.find(
      (sec) => sec.code === employee.section_code
    );
    if (found) return Number(found.id);
  }
  return undefined;
}

const openEditModal = async (employee) => {
  isEditingEmployee.value = true;
  editEmployee.value = employee;

  employeeForm.value.username = employee.username || "";
  employeeForm.value.email = employee.email || "";
  employeeForm.value.first_name = employee.first_name || "";
  employeeForm.value.last_name = employee.last_name || "";
  employeeForm.value.roles = Array.isArray(employee.roles)
    ? employee.roles.map((r) => (typeof r === "string" ? r : r?.name))
    : employee.role?.name
      ? [employee.role.name]
      : [];
  employeeForm.value.departmentId =
    Number(employee.department?.id) || undefined;
  employeeForm.value.sectionId = getSectionIdFromEmployee(employee);
  employeeForm.value.password = "";

  if (employee.department?.id) {
    const sections = store.getters["sections/sectionsByDepartment"](
      employee.department.id
    );
    if (!sections || !sections.length) {
      await store.dispatch(
        "sections/fetchSectionsByDepartment",
        employee.department.id
      );
    }
  }
  isAddEditModalVisible.value = true;
  isEditingEmployee.value = false;
};

watch(
  () => employeeForm.value.departmentId,
  (newVal) => {
    if (newVal) {
      if (!isEditingEmployee.value) {
        employeeForm.value.sectionId = undefined;
      }
      store.dispatch("sections/fetchSectionsByDepartment", newVal);
    }
  }
);
const closeAddEditModal = () => {
  isAddEditModalVisible.value = false;
  editEmployee.value = null;
};
const addEditEmployeeFormRef = ref();

const submitAddEditEmployeeForm = () => {
  if (!addEditEmployeeFormRef.value) {
    notification.error({
      message: $t("validationError"),
      description: $t("formReferenceMissing"),
    });
    return;
  }

  addEditEmployeeFormRef.value
    .validate()
    .then(() => {
      handleAddEditEmployee();
    })
    .catch(() => {
      notification.error({
        message: $t("validationError"),
        description: $t("pleaseCheckFormFields"),
      });
    });
};
const handleAddEditEmployee = async () => {
  savingEmployee.value = true;
  try {
    const formData = { ...employeeForm.value };
    formData.roles = (formData.roles || [])
      .map((r) => (typeof r === "string" ? r : r?.name))
      .filter(Boolean);

    if (
      formData.departmentId === undefined ||
      formData.departmentId === "" ||
      formData.departmentId === 0
    ) {
      formData.departmentId = null;
    }
    if (
      formData.sectionId === undefined ||
      formData.sectionId === "" ||
      formData.sectionId === 0
    ) {
      formData.sectionId = null;
    }
    if (editEmployee.value) {
      await store.dispatch("employees/updateEmployee", {
        ...formData,
        id: editEmployee.value.id,
      });
      notification.success({ message: $t("updateEmployeeSuccess") });
    } else {
      await store.dispatch("employees/createEmployee", { ...formData });
      notification.success({ message: $t("addEmployeeSuccess") });
    }
    await store.dispatch("employees/fetchUsers", { force: true });
    isAddEditModalVisible.value = false;
  } catch (e) {
    notification.error({
      message: $t("saveEmployeeError"),
      description: e.message || $t("saveEmployeeErrorDefault"),
    });
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
        notification.error({
          message: $t("deleteEmployeeError"),
          description: e.message || $t("deleteEmployeeErrorDefault"),
        });
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
    notification.error({
      message: $t("resetPasswordError"),
      description: e.message || $t("resetPasswordErrorDefault"),
    });
  }
};
const viewDetail = async (employee) => {
  detailEmployee.value = await store.dispatch(
    "employees/fetchUserById",
    employee.id
  );
  isDetailDrawerVisible.value = true;
};
const closeDetailDrawer = () => {
  isDetailDrawerVisible.value = false;
  detailEmployee.value = null;
};
const exportExcel = async () => {
  const data = filteredEmployees.value.map((e) => {
    // Handle multiple roles
    let roleText = "";
    if (Array.isArray(e.roles) && e.roles.length > 0) {
      roleText = e.roles
        .map((r) => $t(typeof r === "string" ? r : r?.name))
        .join(", ");
    } else if (e.role) {
      roleText = $t(typeof e.role === "string" ? e.role : e.role?.name);
    } else {
      roleText = $t("noRole");
    }

    return {
      Username: e.username,
      Email: e.email,
      "First Name": e.first_name,
      "Last Name": e.last_name,
      Role: roleText,
      Department: e.department?.name || "",
      Section: e.section?.name || "",
    };
  });
  if (data.length === 0) {
    notification.info({ message: $t("noDataToExport") });
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Employees", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

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

  worksheet.insertRow(
    2,
    columns.map((col) => col.header)
  );

  worksheet.getRow(2).eachCell((cell) => {
    cell.font = {
      name: "Arial",
      size: 12,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
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

  data.forEach((row) => worksheet.addRow(row));

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 24;
    row.eachCell((cell) => {
      cell.font = cell.font || { name: "Arial", size: 12 };
      cell.alignment = cell.alignment || {
        vertical: "middle",
        horizontal: "left",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFBFBFBF" } },
        left: { style: "thin", color: { argb: "FFBFBFBF" } },
        bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
        right: { style: "thin", color: { argb: "FFBFBFBF" } },
      };
    });

    if (rowNumber === 2)
      row.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
  });

  worksheet.views = [{ state: "frozen", ySplit: 2 }];

  worksheet.autoFilter = {
    from: "A2",
    to: String.fromCharCode(65 + columns.length - 1) + "2",
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
onMounted(async () => {
  await store.dispatch("roles/fetchRoles");
  await store.dispatch("employees/fetchUsers", { force: true });
  await store.dispatch("departments/fetchDepartments");
  await store.dispatch("sections/fetchSections");
});

watch(
  () => filterDepartment.value,
  async (newVal) => {
    if (newVal) {
      await store.dispatch("sections/fetchSectionsByDepartment", newVal);
      filterSection.value = undefined;
    }
  }
);
watch(
  () => employeeForm.value.departmentId,
  (newVal) => {
    if (newVal) {
      if (!isEditingEmployee.value) {
        employeeForm.value.sectionId = undefined;
      }
      store.dispatch("sections/fetchSectionsByDepartment", newVal);
    }
  }
);
const columns = computed(() => [
  {
    title: $t("employeeFullName") || "Tên nhân viên",
    dataIndex: "fullName",
    key: "fullName",
    sorter: (a, b) =>
      `${a.first_name || ""} ${a.last_name || ""}`
        .trim()
        .localeCompare(`${b.first_name || ""} ${b.last_name || ""}`.trim()),
  },
  {
    title: $t("username"),
    dataIndex: "username",
    key: "username",
    sorter: (a, b) => a.username.localeCompare(b.username),
  },
  {
    title: $t("email"),
    dataIndex: "email",
    key: "email",
    sorter: (a, b) => a.email.localeCompare(b.email),
  },
  {
    title: $t("departmentLabel"),
    dataIndex: "department",
    key: "department",
    sorter: (a, b) =>
      (a.department?.name || "").localeCompare(b.department?.name || ""),
  },
  {
    title: $t("section"),
    dataIndex: "section",
    key: "section",
    sorter: (a, b) =>
      (a.section?.name || "").localeCompare(b.section?.name || ""),
  },

  {
    title: $t("role"),
    dataIndex: "role",
    key: "role",
    customRender: ({ record }) => {
      let rolesArr = [];
      if (Array.isArray(record.roles))
        rolesArr = record.roles
          .map((r) => (typeof r === "string" ? r : r?.name))
          .filter(Boolean);
      else if (record.role) {
        if (typeof record.role === "string") rolesArr = [record.role];
        else if (typeof record.role === "object" && record.role?.name)
          rolesArr = [record.role.name];
      }
      return rolesArr.length
        ? rolesArr.map((r) => $t(r)).join(", ")
        : $t("noRole");
    },
  },
  {
    title: $t("actions"),
    dataIndex: "actions",
    key: "actions",
    align: "center",
  },
]);
function formatDate(date) {
  if (!date) return $t("noData");
  return dayjs(date).isValid() ? dayjs(date).format("DD/MM/YYYY HH:mm") : date;
}
function roleColor() {
  return "blue";
}
</script>

<style scoped>
.employee-list {
  padding: 24px 24px 16px 24px;
  background: #fafdff;
  border-radius: 14px;
  box-shadow: 0 2px 16px #e3eaf322;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  border-bottom: 1.5px solid #e3e7ef;
  padding-bottom: 10px;
}
.filters {
  margin-bottom: 16px;
  display: flex;
  gap: 10px;
  background: #f5f8fd;
  border-radius: 8px;
  padding: 10px 14px 6px 14px;
  box-shadow: 0 1px 4px #e3eaf311;
}
.employee-detail-drawer {
  padding: 8px 0 0 0;
}
.drawer-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 18px;
  padding-top: 8px;
  border-bottom: 1.5px solid #e3e7ef;
  padding-bottom: 12px;
  background: #fafdff;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 2px 8px #e3eaf322;
}
.drawer-title {
  font-size: 1.35rem;
  font-weight: 700;
  margin-bottom: 2px;
  color: #1976d2;
  display: flex;
  align-items: center;
}
.drawer-sub {
  font-size: 1rem;
  color: #607d8b;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}
.drawer-desc {
  margin-bottom: 18px;
  margin-top: 8px;
  background: #fafdff;
  border-radius: 10px;
  box-shadow: 0 1px 4px #e3eaf311;
  padding: 10px 0 10px 0;
}
.employee-skill-block {
  margin-top: 18px;
  padding: 14px 12px 10px 12px;
  background: #fafdff;
  border-radius: 10px;
  box-shadow: 0 2px 8px #e3eaf322;
}
.skill-block-title {
  font-size: 1.08rem;
  font-weight: 600;
  color: #1976d2;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}
.skill-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.skill-item {
  display: flex;
  align-items: center;
  font-size: 1rem;
  color: #333;
  padding: 2px 0;
}
.skill-name {
  min-width: 120px;
  font-weight: 500;
  color: #222;
  display: flex;
  align-items: center;
}
</style>
