<template>
  <!-- Department Assignment Modals -->
  <LoadingOverlay
    :visible="
      loadingAssignableUsers ||
      submittingUserAssignment ||
      submittingUserDeletion ||
      assigningUsersInSection ||
      submittingDepartmentSectionAssignment ||
      submittingDepartmentSectionDeletion
    "
  />
  <a-modal
    :open="isAssignUserModalVisible"
    @update:open="isAssignUserModalVisible = $event"
    :title="assignUserModalTitle"
    @ok="handleSaveUserAssignment"
    @cancel="closeAssignUserModal"
    :confirm-loading="submittingUserAssignment"
    :width="800"
    :mask-closable="false"
    :keyboard="false"
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
  >
    <a-spin :spinning="loadingAssignableUsers || submittingUserAssignment">
      <a-descriptions
        v-if="isEditingUserAssignment && editingUserAssignmentRecord?.employee"
        :column="1"
        size="small"
        style="margin-bottom: 15px"
      >
        <a-descriptions-item :label="$t('user')">
          <a-avatar
            :src="editingUserAssignmentRecord.employee?.avatar_url"
            size="small"
            style="margin-right: 8px"
          >
            {{ editingUserAssignmentRecord.employee?.first_name?.charAt(0) }}
          </a-avatar>
          {{ $getFullName(editingUserAssignmentRecord.employee, true) }}
        </a-descriptions-item>
      </a-descriptions>
      <a-form-item
        v-if="!isEditingUserAssignment"
        :label="$t('selectUsers')"
        required
      >
        <a-select
          v-model:value="selectedUserIds"
          mode="multiple"
          :placeholder="$t('searchAndSelectUsers')"
          style="width: 100%; margin-bottom: 15px"
          show-search
          allow-clear
          :filter-option="
            (inputValue, option) =>
              option.label.toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
          "
          :options="assignableUserOptions"
          :loading="loadingAssignableUsers"
        />
      </a-form-item>
      <h4 style="margin-bottom: 10px">{{ $t("setTargetAndWeight") }}</h4>
      <a-table
        :columns="modalUserAssignmentInputColumns"
        :data-source="modalUserDataSource"
        row-key="userId"
        size="small"
        bordered
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'user'">
            <a-avatar
              :src="record.avatar_url"
              size="small"
              style="margin-right: 8px"
            >
              {{ record.name?.charAt(0) }}
            </a-avatar>
            {{ record.name }}
          </template>
          <template v-if="column.key === 'target'">
            <a-input
              v-model:value="userAssignmentDetails[record.userId].target"
              :placeholder="$t('target')"
              style="width: 100%"
              type="number"
              min="0"
            />
          </template>
        </template>
      </a-table>
      <div
        v-if="userAssignmentSubmitError"
        style="color: red; margin-top: 10px"
      >
        {{ userAssignmentSubmitError }}
      </div>
    </a-spin>
  </a-modal>

  <a-modal
    :open="isDeleteUserAssignModalVisible"
    @update:open="isDeleteUserAssignModalVisible = $event"
    :title="$t('confirmDeletion')"
    @ok="handleDeleteUserAssignment"
    @cancel="isDeleteUserAssignModalVisible = false"
    :confirm-loading="submittingUserDeletion"
    :ok-text="$t('delete')"
    :cancel-text="$t('cancel')"
    ok-type="danger"
  >
    <p v-if="userAssignmentToDelete?.employee">
      {{ $t("confirmRemoveAssignmentForUser") }}
      <strong>
        {{ $getFullName(userAssignmentToDelete.employee) }}
      </strong>
      ?
    </p>
    <p v-else>{{ $t("confirmDeleteAssignment") }}</p>
  </a-modal>

  <a-modal
    :open="isAssignUsersInDeptSectionsModalVisible"
    @update:open="isAssignUsersInDeptSectionsModalVisible = $event"
    :title="$t('assignUsersInDepartmentSections')"
    @ok="handleAssignUsersInSection"
    @cancel="closeAssignUsersInDeptSectionsModal"
    :confirm-loading="assigningUsersInSection"
    :width="600"
  >
    <a-form layout="vertical">
      <a-form-item :label="$t('selectSection')" required>
        <a-select
          v-model:value="selectedSectionIdForUserAssign"
          :options="sectionsInContextDepartment"
          :placeholder="$t('selectSection')"
          @change="fetchUsersInSection"
        />
      </a-form-item>
      <a-form-item :label="$t('selectUsers')" required>
        <a-select
          v-model:value="selectedUserIdsInSection"
          :options="assignableUsersInSection"
          mode="multiple"
          :placeholder="$t('selectUsers')"
          :disabled="!selectedSectionIdForUserAssign"
          show-search
          allow-clear
          @change="onSelectedUsersInSectionChange"
        />
      </a-form-item>
      <a-table
        v-if="selectedUserIdsInSection.length"
        :columns="assignUsersInSectionColumns"
        :data-source="assignUsersInSectionTableData"
        row-key="userId"
        size="small"
        bordered
        :pagination="false"
        style="margin-bottom: 10px"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'user'">
            <a-avatar
              :src="record.avatar_url"
              size="small"
              style="margin-right: 8px"
            >
              {{ record.name?.charAt(0) }}
            </a-avatar>
            {{ record.name }}
          </template>
          <template v-else-if="column.key === 'target'">
            <a-input
              v-model:value="assignUsersInSectionTargetDetails[record.userId]"
              :placeholder="$t('target')"
              style="width: 100%"
              type="number"
              min="0"
            />
          </template>
        </template>
      </a-table>
      <div
        v-if="userAssignErrorInSection"
        style="color: red; margin-bottom: 10px"
      >
        {{ userAssignErrorInSection }}
      </div>
    </a-form>
  </a-modal>

  <a-modal
    :open="isDepartmentSectionAssignmentModalVisible"
    @update:open="isDepartmentSectionAssignmentModalVisible = $event"
    :title="
      editingDepartmentSectionAssignment
        ? $t('editAssignment')
        : $t('addDepartmentSectionAssignment')
    "
    @ok="handleSaveDepartmentSectionAssignment"
    @cancel="closeManageDepartmentSectionAssignments"
    :confirm-loading="submittingDepartmentSectionAssignment"
    :width="600"
    :mask-closable="false"
    :keyboard="false"
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
  >
    <a-spin :spinning="submittingDepartmentSectionAssignment">
      <a-form
        layout="vertical"
        :model="departmentSectionAssignmentForm"
        ref="departmentSectionAssignmentFormRef"
      >
        <a-form-item :label="$t('assignTo')" name="assignToTarget">
          <a-select
            v-model:value="
              departmentSectionAssignmentForm.assigned_to_department
            "
            :placeholder="$t('selectDepartment')"
            style="width: 100%; margin-bottom: 10px"
            @change="handleDepartmentSelectInModal"
            :disabled="
              !!contextDepartmentId ||
              editingDepartmentSectionAssignment !== null
            "
          >
            <a-select-option
              v-for="dept in allDepartments"
              :key="dept.id"
              :value="dept.id"
            >
              {{ dept.name || `ID: ${dept.id}` }}
            </a-select-option>
          </a-select>

          <a-form-item name="assigned_to_section" no-style>
            <a-select
              v-model:value="
                departmentSectionAssignmentForm.assigned_to_section
              "
              :placeholder="$t('selectSectionOptional')"
              style="width: 100%"
              :disabled="
                !departmentSectionAssignmentForm.assigned_to_department ||
                editingDepartmentSectionAssignment !== null
              "
              allow-clear
            >
              <a-select-option
                v-for="section in assignableSections"
                :key="section.id"
                :value="section.id"
              >
                {{ section.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-form-item>

        <a-form-item :label="$t('target')" required name="targetValue">
          <a-input
            v-model:value="departmentSectionAssignmentForm.targetValue"
            :placeholder="$t('target')"
            style="width: 100%"
            @input="(event) => handleNumericInput('targetValue', event)"
          />
        </a-form-item>

        <div
          v-if="departmentSectionAssignmentError"
          style="color: red; margin-top: 10px"
        >
          {{ departmentSectionAssignmentError }}
        </div>
      </a-form>
    </a-spin>
  </a-modal>

  <a-modal
    :open="isDeleteDepartmentSectionAssignmentModalVisible"
    @update:open="isDeleteDepartmentSectionAssignmentModalVisible = $event"
    :title="$t('confirmDeletion')"
    @ok="handleDeleteDepartmentSectionAssignment"
    @cancel="isDeleteDepartmentSectionAssignmentModalVisible = false"
    :confirm-loading="submittingDepartmentSectionDeletion"
    :ok-text="$t('delete')"
    :cancel-text="$t('cancel')"
    ok-type="danger"
  >
    <p v-if="departmentSectionAssignmentToDelete">
      {{ $t("confirmRemoveAssignmentFor") }}
      <strong>
        <span v-if="departmentSectionAssignmentToDelete.department">
          {{ $t("department") }}:
          {{ departmentSectionAssignmentToDelete.department.name }}
        </span>
        <span v-else-if="departmentSectionAssignmentToDelete.section">
          {{ $t("section") }}:
          {{ departmentSectionAssignmentToDelete.section.name }}
        </span>
        <span v-else-if="departmentSectionAssignmentToDelete.team">
          {{ $t("team") }}:
          {{ departmentSectionAssignmentToDelete.team.name }}
        </span>
        <span v-else> {{ $t("thisUnit") }} </span>
      </strong>
      ?
    </p>
    <p v-else>{{ $t("confirmDeleteAssignment") }}</p>
  </a-modal>
</template>

<script setup>
import { ref, computed, reactive, watch } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import {
  Modal as AModal,
  Select as ASelect,
  Form as AForm,
  FormItem as AFormItem,
  Spin as ASpin,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Avatar as AAvatar,
  Table as ATable,
  Input as AInput,
} from "ant-design-vue";
import { notification } from "ant-design-vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { getFullName } from "@/core/utils/format";

const { t: $t } = useI18n();
const store = useStore();

const props = defineProps({
  kpiId: {
    type: Number,
    required: true,
  },
  kpiDetailData: {
    type: Object,
    required: true,
  },
  loadingKpi: {
    type: Boolean,
    default: false,
  },
  loadingUserAssignments: {
    type: Boolean,
    default: false,
  },
  loadingDepartmentSectionAssignments: {
    type: Boolean,
    default: false,
  },
  userAssignmentError: {
    type: String,
    default: null,
  },
  departmentSectionAssignmentError: {
    type: String,
    default: null,
  },
  allDepartments: {
    type: Array,
    default: () => [],
  },
  allSections: {
    type: Array,
    default: () => [],
  },
  contextDepartmentId: {
    type: Number,
    default: null,
  },
  canAssignSection: {
    type: Boolean,
    default: false,
  },
  canAssignEmployees: {
    type: Boolean,
    default: false,
  },
  departmentHasSections: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["refresh"]);

// Modal states
const isAssignUserModalVisible = ref(false);
const isEditingUserAssignment = ref(false);
const editingUserAssignmentRecord = ref(null);
const assignableUsers = ref([]);
const loadingAssignableUsers = ref(false);
const selectedUserIds = ref([]);
const userAssignmentDetails = reactive({});
const submittingUserAssignment = ref(false);
const userAssignmentSubmitError = ref(null);
const isDeleteUserAssignModalVisible = ref(false);
const userAssignmentToDelete = ref(null);
const submittingUserDeletion = ref(false);

const isAssignUsersInDeptSectionsModalVisible = ref(false);
const selectedSectionIdForUserAssign = ref(null);
const selectedUserIdsInSection = ref([]);
const assigningUsersInSection = ref(false);
const userAssignErrorInSection = ref(null);
const assignUsersInSectionTargetDetails = reactive({});

const isDepartmentSectionAssignmentModalVisible = ref(false);
const editingDepartmentSectionAssignment = ref(null);
const submittingDepartmentSectionAssignment = ref(false);
const isDeleteDepartmentSectionAssignmentModalVisible = ref(false);
const departmentSectionAssignmentToDelete = ref(null);
const submittingDepartmentSectionDeletion = ref(false);
const departmentSectionAssignmentFormRef = ref(null);

const departmentSectionAssignmentForm = reactive({
  assigned_to_department: null,
  assigned_to_section: null,
  targetValue: null,
  assignmentId: null,
});

const assignedUserIdsInSection = computed(() => {
  if (!selectedSectionIdForUserAssign.value) return [];
  return (props.kpiDetailData?.assignments || [])
    .filter(
      (a) =>
        a.assigned_to_employee &&
        a.employee?.sectionId === selectedSectionIdForUserAssign.value,
    )
    .map((a) => a.employee.id);
});

const assignableUsersInSection = computed(() => {
  const users =
    store.getters["employees/usersBySection"](
      selectedSectionIdForUserAssign.value,
    ) || [];
  return users
    .filter((u) => !assignedUserIdsInSection.value.includes(u.id))
    .map((u) => ({
      value: u.id,
      label: getFullName(u, true),
    }));
});

const sectionsInContextDepartment = computed(() => {
  if (!props.contextDepartmentId) return [];
  return props.allSections
    .filter(
      (s) =>
        s.department_id === props.contextDepartmentId ||
        s.department?.id === props.contextDepartmentId,
    )
    .map((s) => ({
      value: s.id,
      label: s.name,
    }));
});

const assignUsersInSectionTableData = computed(() => {
  return selectedUserIdsInSection.value.map((userId) => {
    const user = assignableUsersInSection.value.find((u) => u.value === userId);
    return {
      userId,
      name: user ? user.label : userId,
      target: assignUsersInSectionTargetDetails[userId] || null,
    };
  });
});

const assignableSections = computed(() => {
  const selectedDepartmentIdInModal =
    departmentSectionAssignmentForm.assigned_to_department;

  if (
    selectedDepartmentIdInModal === null ||
    selectedDepartmentIdInModal === undefined ||
    selectedDepartmentIdInModal === ""
  ) {
    return [];
  }

  const sectionsForSelectedDept = store.getters[
    "sections/sectionsByDepartment"
  ](selectedDepartmentIdInModal);

  if (!Array.isArray(sectionsForSelectedDept)) {
    return [];
  }

  if (!editingDepartmentSectionAssignment.value) {
    const allCurrentAssignments = props.kpiDetailData?.assignments || [];

    const assignedSectionIds = new Set();
    allCurrentAssignments.forEach((assign) => {
      if (assign.assigned_to_section) {
        assignedSectionIds.add(Number(assign.assigned_to_section));
      } else if (assign.section && assign.section.id) {
        assignedSectionIds.add(Number(assign.section.id));
      }
    });

    const filteredSections = sectionsForSelectedDept.filter((section) => {
      const sectionId = Number(section?.id);
      return !isNaN(sectionId) && !assignedSectionIds.has(sectionId);
    });
    return filteredSections;
  } else {
    // When editing, we might want to show the currently assigned section so it can be kept selected
    // but typically we don't change the section in edit mode, usually just target.
    // If we do allow changing, we should exclude other assigned sections.
    // For now, consistent with create mode:
    const allCurrentAssignments = props.kpiDetailData?.assignments || [];
    const currentAssignmentId = editingDepartmentSectionAssignment.value?.id;

    const assignedSectionIds = new Set();
    allCurrentAssignments.forEach((assign) => {
      // Exclude the current assignment being edited from the "block list"
      if (assign.id === currentAssignmentId) return;

      if (assign.assigned_to_section) {
        assignedSectionIds.add(Number(assign.assigned_to_section));
      } else if (assign.section && assign.section.id) {
        assignedSectionIds.add(Number(assign.section.id));
      }
    });

    return sectionsForSelectedDept.filter((section) => {
      const sectionId = Number(section?.id);
      return !isNaN(sectionId) && !assignedSectionIds.has(sectionId);
    });
  }
});

const allUserAssignmentsForKpi = computed(
  () => store.getters["kpis/currentKpiUserAssignments"],
);

const assignableUserOptions = computed(() => {
  const allFetchableUsers = assignableUsers.value;

  if (!Array.isArray(allFetchableUsers)) {
    return [];
  }

  const alreadyAssignedUserIds = allUserAssignmentsForKpi.value
    .filter((assign) => assign.assigned_to_employee !== null && assign.employee)
    .map((assign) => assign.employee.id);

  const alreadyAssignedUserIdsSet = new Set(alreadyAssignedUserIds);

  const filteredAssignableUsers = allFetchableUsers.filter((user) => {
    return (
      user &&
      typeof user.id !== "undefined" &&
      !alreadyAssignedUserIdsSet.has(user.id)
    );
  });

  const result = filteredAssignableUsers.map((user) => ({
    value: user.id,
    label: getFullName(user, true),
    name: getFullName(user),
    avatar_url: user?.avatar_url,
  }));

  return result;
});

const modalUserDataSource = computed(() => {
  if (
    isEditingUserAssignment.value &&
    editingUserAssignmentRecord.value?.employee
  ) {
    const user = editingUserAssignmentRecord.value.employee;
    ensureUserAssignmentDetail(
      user.id,
      editingUserAssignmentRecord.value.target,
      editingUserAssignmentRecord.value.weight,
    );
    return [
      {
        userId: user.id,
        name: getFullName(user),
        avatar_url: user.avatar_url,
      },
    ];
  } else if (!isEditingUserAssignment.value) {
    const newlySelectedUserIds = selectedUserIds.value;

    if (newlySelectedUserIds.length === 0) {
      return [];
    }

    const dataSource = assignableUserOptions.value
      .filter((opt) => newlySelectedUserIds.includes(opt.value))
      .map((opt) => {
        ensureUserAssignmentDetail(opt.value, null, null);

        return {
          userId: opt.value,
          name: opt.name,
          avatar_url: opt.avatar_url,
        };
      });

    return dataSource;
  }

  return [];
});

const assignUserModalTitle = computed(() => {
  if (isEditingUserAssignment.value) {
    return $t("editUserAssignment");
  }
  return $t("assignKpiToUsers");
});

const assignUsersInSectionColumns = computed(() => [
  { title: $t("user"), key: "user", dataIndex: "user", width: "60%" },
  { title: $t("target"), key: "target", dataIndex: "target", width: "40%" },
]);

const modalUserAssignmentInputColumns = computed(() => [
  {
    title: $t("employee"),
    key: "user",
    width: "40%",
  },
  {
    title: $t("target"),
    key: "target",
    width: "30%",
  },
]);

// Methods
const ensureUserAssignmentDetail = (
  userId,
  initialTarget = null,
  initialWeight = null,
) => {
  const key = String(userId);
  if (!userAssignmentDetails[key]) {
    userAssignmentDetails[key] = {
      target: initialTarget,
      weight: initialWeight,
    };
  }
};

const fetchAssignableUsersData = async () => {
  const kpi = props.kpiDetailData;

  let fetchedUsersList = [];

  if (!isEditingUserAssignment.value) {
    selectedUserIds.value = [];
  }

  assignableUsers.value = [];
  loadingAssignableUsers.value = true;
  userAssignmentSubmitError.value = null;

  try {
    // Determine which department to fetch users from
    let departmentId = null;

    // If we have contextDepartmentId and that department has no sections, use it
    if (props.contextDepartmentId) {
      const sections = props.allSections.filter(
        (s) =>
          s.department_id === props.contextDepartmentId ||
          (s.department && s.department.id === props.contextDepartmentId),
      );

      // Only fetch users if department has no sections
      if (sections.length === 0) {
        departmentId = props.contextDepartmentId;
      }
    }
    // Fallback to KPI created_by if it's a department and has no sections
    else if (
      kpi?.created_by_type === "department" &&
      kpi.created_by &&
      props.departmentHasSections === false
    ) {
      departmentId = kpi.created_by;
    }

    // Fetch users if we have a department ID
    if (departmentId) {
      await store.dispatch("employees/fetchUsersByDepartment", departmentId);
      fetchedUsersList =
        store.getters["employees/usersByDepartment"](departmentId);
    } else {
      fetchedUsersList = [];
    }

    if (Array.isArray(fetchedUsersList)) {
      assignableUsers.value = fetchedUsersList;
    } else {
      console.error(
        "fetchAssignableUsersData: Fetched users list is NOT an array.",
        fetchedUsersList,
      );
      assignableUsers.value = [];
      userAssignmentSubmitError.value = $t("failedToProcessUserList");
    }
  } catch (err) {
    console.error(
      "fetchAssignableUsersData: Error during dispatch or getter access:",
      err,
    );
    userAssignmentSubmitError.value =
      store.getters["employees/error"] ||
      err.message ||
      $t("failedToLoadAssignableUsers");
    assignableUsers.value = [];
  } finally {
    loadingAssignableUsers.value = false;
  }
};

const openAssignUserModal = () => {
  isEditingUserAssignment.value = false;
  editingUserAssignmentRecord.value = null;
  selectedUserIds.value = [];
  Object.keys(userAssignmentDetails).forEach(
    (key) => delete userAssignmentDetails[key],
  );
  userAssignmentSubmitError.value = null;
  fetchAssignableUsersData();
  isAssignUserModalVisible.value = true;
};

const openEditUserModal = (record) => {
  isEditingUserAssignment.value = true;
  editingUserAssignmentRecord.value = record;
  selectedUserIds.value = [record.employee.id];
  Object.keys(userAssignmentDetails).forEach(
    (key) => delete userAssignmentDetails[key],
  );
  ensureUserAssignmentDetail(record.employee.id, record.target, record.weight);
  userAssignmentSubmitError.value = null;
  isAssignUserModalVisible.value = true;
};

const closeAssignUserModal = () => {
  isAssignUserModalVisible.value = false;
  setTimeout(() => {
    isEditingUserAssignment.value = false;
    editingUserAssignmentRecord.value = null;
    selectedUserIds.value = [];
    Object.keys(userAssignmentDetails).forEach(
      (key) => delete userAssignmentDetails[key],
    );
    userAssignmentSubmitError.value = null;
    assignableUsers.value = [];
  }, 300);
};

const calculateEffectiveTotalAssigned = (excludeAssignmentId = null) => {
  const allAssignments = props.kpiDetailData?.assignments || [];

  // 1. Identify assigned Departments (Roots for Hierarchy)
  const deptAssignments = allAssignments.filter(
    (a) =>
      a.assigned_to_department &&
      !a.assigned_to_section &&
      (!excludeAssignmentId || a.id !== excludeAssignmentId),
  );
  const assignedDeptIds = new Set(
    deptAssignments.map((a) => a.assigned_to_department),
  );

  // 2. Identify assigned Sections (Secondary Roots)
  // Only consider sections that are NOT covered by an assigned Department
  const sectionAssignments = allAssignments.filter(
    (a) =>
      a.assigned_to_section &&
      (!excludeAssignmentId || a.id !== excludeAssignmentId),
  );
  // Track ALL assigned section IDs for User validation
  const allAssignedSectionIds = new Set(
    sectionAssignments.map((a) => a.assigned_to_section),
  );

  // 3. Identify User Assignments
  const userAssignments = allAssignments.filter(
    (a) =>
      a.assigned_to_employee &&
      (!excludeAssignmentId || a.id !== excludeAssignmentId),
  );

  let total = 0;

  // Add Dept Targets (always counts as they are top level)
  deptAssignments.forEach((a) => (total += Number(a.targetValue || 0)));

  // Add Section Targets IF their Department is NOT assigned
  sectionAssignments.forEach((a) => {
    // Get department ID from assignment or from section object
    const sectionDeptId =
      a.assigned_to_department ||
      a.section?.department?.id ||
      a.section?.department_id;

    // Only add section target if its department is NOT assigned
    if (sectionDeptId && !assignedDeptIds.has(sectionDeptId)) {
      total += Number(a.targetValue || 0);
    }
  });

  // Add User Targets IF their Section is NOT assigned AND their Dept is NOT assigned
  userAssignments.forEach((a) => {
    const uSectId = a.employee?.sectionId || a.employee?.section?.id;
    const uDeptId =
      a.employee?.department_id ||
      a.employee?.department?.id ||
      a.employee?.section?.department_id;

    const coveredBySection = uSectId && allAssignedSectionIds.has(uSectId);
    const coveredByDept = uDeptId && assignedDeptIds.has(uDeptId);

    if (!coveredBySection && !coveredByDept) {
      total += Number(a.targetValue || 0);
    }
  });

  return total;
};

// Validation 1: Tổng target assign cho các department trong 1 KPI không được vượt quá target của KPI đó
const validateDepartmentTotalAgainstKpi = (
  excludeAssignmentId = null,
  newDepartmentTarget = 0,
) => {
  const kpiTarget = props.kpiDetailData?.target;
  if (kpiTarget === null || kpiTarget === undefined) return null;

  const allAssignments = props.kpiDetailData?.assignments || [];

  // Tính tổng target của tất cả department assignments (không tính section/user)
  let totalDepartmentTargets = 0;
  allAssignments.forEach((a) => {
    if (
      a.assigned_to_department &&
      !a.assigned_to_section &&
      (!excludeAssignmentId || a.id !== excludeAssignmentId)
    ) {
      totalDepartmentTargets += Number(a.targetValue || 0);
    }
  });

  // Thêm target mới nếu đang assign department
  const newTotal = totalDepartmentTargets + newDepartmentTarget;

  if (newTotal > Number(kpiTarget)) {
    return {
      error: true,
      message: $t("totalAssignedTargetExceedsKpiTarget", {
        totalAssigned: newTotal,
        kpiTarget: kpiTarget,
      }),
    };
  }

  return { error: false };
};

// Validation 2: Tổng target assign cho các section thuộc 1 department không được vượt quá target mà department đó được assign hay target kpi mà department đó tạo
const validateSectionTotalAgainstDepartment = (
  departmentId,
  excludeAssignmentId = null,
  newSectionTarget = 0,
) => {
  const allAssignments = props.kpiDetailData?.assignments || [];
  const kpiData = props.kpiDetailData;

  // Tìm department assignment để lấy target
  const departmentAssignment = allAssignments.find(
    (a) =>
      a.assigned_to_department === departmentId &&
      !a.assigned_to_section &&
      (!excludeAssignmentId || a.id !== excludeAssignmentId),
  );

  let departmentTarget = null;

  if (departmentAssignment && departmentAssignment.targetValue) {
    // Nếu department đã được assign, dùng target đó
    departmentTarget = Number(departmentAssignment.targetValue);
  } else if (
    kpiData?.created_by_type === "department" &&
    Number(kpiData?.created_by) === Number(departmentId)
  ) {
    // Nếu KPI được tạo bởi department này, dùng KPI target
    departmentTarget = Number(kpiData?.target || 0);
  }

  // Nếu không có department target, không cần validate
  if (departmentTarget === null) return { error: false };

  // Tính tổng target của tất cả section assignments thuộc department này
  let totalSectionTargets = 0;
  allAssignments.forEach((a) => {
    if (
      a.assigned_to_section &&
      (!excludeAssignmentId || a.id !== excludeAssignmentId)
    ) {
      // Lấy department ID của section
      const sectionDeptId =
        a.assigned_to_department ||
        a.section?.department?.id ||
        a.section?.department_id;

      if (Number(sectionDeptId) === Number(departmentId)) {
        totalSectionTargets += Number(a.targetValue || 0);
      }
    }
  });

  // Thêm target mới
  const newTotal = totalSectionTargets + newSectionTarget;

  if (newTotal > departmentTarget) {
    const department = props.allDepartments?.find((d) => d.id === departmentId);
    const deptName = department?.name || `Department ${departmentId}`;

    return {
      error: true,
      message: $t("sectionTargetsExceedDepartmentTarget", {
        totalSectionTargets: newTotal,
        departmentTarget: departmentTarget,
        departmentName: deptName,
      }),
    };
  }

  return { error: false };
};

// Validation 3: Tổng target assign cho các employee thuộc 1 section không được vượt quá target mà section đó được assign hay target kpi mà section đó tạo
const validateEmployeeTotalAgainstSection = (
  sectionId,
  excludeAssignmentId = null,
  newEmployeeTargets = 0,
) => {
  const allAssignments = props.kpiDetailData?.assignments || [];
  const kpiData = props.kpiDetailData;

  // Tìm section assignment để lấy target
  const sectionAssignment = allAssignments.find(
    (a) =>
      a.assigned_to_section === sectionId &&
      (!excludeAssignmentId || a.id !== excludeAssignmentId),
  );

  let sectionTarget = null;

  if (sectionAssignment && sectionAssignment.targetValue) {
    // Nếu section đã được assign, dùng target đó
    sectionTarget = Number(sectionAssignment.targetValue);
  } else if (
    kpiData?.created_by_type === "section" &&
    Number(kpiData?.created_by) === Number(sectionId)
  ) {
    // Nếu KPI được tạo bởi section này, dùng KPI target
    sectionTarget = Number(kpiData?.target || 0);
  }

  // Nếu không có section target, không cần validate
  if (sectionTarget === null) return { error: false };

  // Tính tổng target của tất cả employee assignments thuộc section này
  let totalEmployeeTargets = 0;
  allAssignments.forEach((a) => {
    if (
      a.assigned_to_employee &&
      (!excludeAssignmentId || a.id !== excludeAssignmentId)
    ) {
      const employeeSectionId =
        a.employee?.sectionId || a.employee?.section?.id;

      if (Number(employeeSectionId) === Number(sectionId)) {
        totalEmployeeTargets += Number(a.targetValue || 0);
      }
    }
  });

  // Thêm target mới
  const newTotal = totalEmployeeTargets + newEmployeeTargets;

  if (newTotal > sectionTarget) {
    const section = props.allSections?.find((s) => s.id === sectionId);
    const sectName = section?.name || `Section ${sectionId}`;

    return {
      error: true,
      message: $t("userTargetsExceedSectionTarget", {
        totalUserTargets: newTotal,
        sectionTarget: sectionTarget,
        sectionName: sectName,
      }),
    };
  }

  return { error: false };
};

const getErrorDescription = (error) => {
  const rawMsg = error.response?.data?.message || error.message;
  if (typeof rawMsg === "string") {
    const parts = rawMsg.split(":");
    const code = parts[0];

    if (code === "ERR_KPI_TARGET_EXCEEDED") {
      return $t("totalAssignedTargetExceedsKpiTarget", {
        totalAssigned: parts[1],
        kpiTarget: parts[2],
      });
    }
    if (code === "ERR_DEPT_TARGET_EXCEEDED") {
      const dId = Number(parts[1]);
      const deptName =
        props.allDepartments?.find((d) => d.id === dId)?.name || dId;
      return $t("sectionTargetsExceedDepartmentTarget", {
        departmentName: deptName,
        totalSectionTargets: parts[2],
        departmentTarget: parts[3],
      });
    }
    if (code === "ERR_SECTION_TARGET_EXCEEDED") {
      const sId = Number(parts[1]);
      const sectName =
        props.allSections?.find((s) => s.id === sId)?.name || sId;
      return $t("userTargetsExceedSectionTarget", {
        sectionName: sectName,
        totalUserTargets: parts[2],
        sectionTarget: parts[3],
      });
    }
  }
  return rawMsg || $t("unknownError");
};

const handleSaveUserAssignment = async () => {
  userAssignmentSubmitError.value = null;

  // Validation: Check if users are selected
  if (!isEditingUserAssignment.value && selectedUserIds.value.length === 0) {
    userAssignmentSubmitError.value = $t("selectUsers");
    return;
  }
  let invalidDetail = false;
  const usersToValidate = isEditingUserAssignment.value
    ? [editingUserAssignmentRecord.value.employee.id]
    : selectedUserIds.value;
  usersToValidate.forEach((userId) => {
    const details = userAssignmentDetails[String(userId)];
    if (!details || details.target === null || details.target < 0) {
      invalidDetail = true;
    }
  });
  if (invalidDetail) {
    userAssignmentSubmitError.value = $t("invalidTarget");
    return;
  }

  // Validation
  const currentKpiTarget = props.kpiDetailData?.target;
  if (currentKpiTarget !== null && currentKpiTarget !== undefined) {
    const excludeId = isEditingUserAssignment.value
      ? editingUserAssignmentRecord.value.id
      : null;

    const allAssignments = props.kpiDetailData?.assignments || [];
    const usersToProcess = isEditingUserAssignment.value
      ? [editingUserAssignmentRecord.value.employee.id]
      : selectedUserIds.value;
    const allFetchedUsers = assignableUsers.value;

    // Check if we're in a department context without sections (direct user assignments)
    let isDirectDepartmentUserAssignment = false;
    if (props.contextDepartmentId) {
      const sections = props.allSections.filter(
        (s) =>
          s.department_id === props.contextDepartmentId ||
          (s.department && s.department.id === props.contextDepartmentId),
      );
      isDirectDepartmentUserAssignment = sections.length === 0;
    }

    if (isDirectDepartmentUserAssignment) {
      // For departments without sections, validate against department target or KPI target
      const departmentId = props.contextDepartmentId;

      // Check if there's a department assignment for this department
      const departmentAssignment = allAssignments.find(
        (a) =>
          a.assigned_to_department === departmentId &&
          !a.assigned_to_section &&
          (!excludeId || a.id !== excludeId),
      );

      let targetLimit = null;

      if (departmentAssignment && departmentAssignment.targetValue) {
        // If department is assigned, use that target as limit
        targetLimit = Number(departmentAssignment.targetValue);
      } else if (
        props.kpiDetailData?.created_by_type === "department" &&
        Number(props.kpiDetailData?.created_by) === Number(departmentId)
      ) {
        // If KPI is created by this department, use KPI target as limit
        targetLimit = Number(currentKpiTarget);
      }

      if (targetLimit !== null) {
        // Calculate total of existing user assignments for this department (excluding users with sections)
        let existingUserTotal = 0;
        allAssignments.forEach((a) => {
          if (
            a.assigned_to_employee &&
            (!excludeId || a.id !== excludeId)
          ) {
            const empDeptId = a.employee?.departmentId || a.employee?.department_id;
            const empSectionId = a.employee?.sectionId || a.employee?.section?.id;

            // Only count users in this department who don't have sections
            if (Number(empDeptId) === Number(departmentId) && !empSectionId) {
              existingUserTotal += Number(a.targetValue || 0);
            }
          }
        });

        // Calculate incoming total
        let incomingTotal = 0;
        usersToProcess.forEach((userId) => {
          const details = userAssignmentDetails[String(userId)];
          if (details && details.target) {
            incomingTotal += Number(details.target);
          }
        });

        const newTotal = existingUserTotal + incomingTotal;

        if (newTotal > targetLimit) {
          userAssignmentSubmitError.value = $t(
            "totalAssignedTargetExceedsKpiTarget",
            {
              totalAssigned: newTotal,
              kpiTarget: targetLimit,
            },
          );
          return;
        }
      }
    } else {
      // Original validation logic for other cases
      let currentTotalAssigned = calculateEffectiveTotalAssigned(excludeId);

      const assignedDeptIds = new Set(
        allAssignments
          .filter((a) => a.assigned_to_department && !a.assigned_to_section)
          .map((a) => a.assigned_to_department),
      );
      const assignedSectionIds = new Set(
        allAssignments
          .filter((a) => a.assigned_to_section)
          .map((a) => a.assigned_to_section),
      );

      let incomingTargetSum = 0;

      usersToProcess.forEach((userId) => {
        const details = userAssignmentDetails[String(userId)];
        if (details && details.target) {
          let uSectId = null;
          let uDeptId = null;

          if (isEditingUserAssignment.value) {
            uSectId = editingUserAssignmentRecord.value.employee?.sectionId;
            uDeptId = editingUserAssignmentRecord.value.employee?.department_id;
          } else {
            const userObj = allFetchedUsers.find((u) => u.id === userId);
            uSectId = userObj?.sectionId || userObj?.section?.id;
            uDeptId = userObj?.department_id || userObj?.section?.department_id;
          }

          const coveredBySection = uSectId && assignedSectionIds.has(uSectId);
          const coveredByDept = uDeptId && assignedDeptIds.has(uDeptId);

          if (!coveredBySection && !coveredByDept) {
            incomingTargetSum += Number(details.target);
          }
        }
      });

      const newTotal = currentTotalAssigned + incomingTargetSum;

      if (newTotal > Number(currentKpiTarget)) {
        userAssignmentSubmitError.value = $t(
          "totalAssignedTargetExceedsKpiTarget",
          {
            totalAssigned: newTotal,
            kpiTarget: currentKpiTarget,
          },
        );
        return;
      }

      // Validation 3: Kiểm tra tổng employee targets <= section target
      const usersBySection = new Map();

      for (const userId of usersToProcess) {
        let userSectionId = null;

        if (isEditingUserAssignment.value) {
          userSectionId = editingUserAssignmentRecord.value.employee?.sectionId;
        } else {
          const userObj = allFetchedUsers.find((u) => u.id === userId);
          userSectionId = userObj?.sectionId || userObj?.section?.id;
        }

        if (userSectionId) {
          if (!usersBySection.has(userSectionId)) {
            usersBySection.set(userSectionId, {
              incomingTotal: 0,
            });
          }
          const details = userAssignmentDetails[String(userId)];
          if (details && details.target) {
            usersBySection.get(userSectionId).incomingTotal += Number(
              details.target,
            );
          }
        }
      }

      // Validate each section group
      for (const [sectionId, data] of usersBySection.entries()) {
        const validation = validateEmployeeTotalAgainstSection(
          sectionId,
          excludeId,
          data.incomingTotal,
        );

        if (validation?.error) {
          userAssignmentSubmitError.value = validation.message;
          return;
        }
      }
    }
  }

  submittingUserAssignment.value = true;
  const currentKpiId = props.kpiId;
  if (!currentKpiId) {
    userAssignmentSubmitError.value = $t("cannotGetKpiId");
    submittingUserAssignment.value = false;
    return;
  }
  try {
    if (isEditingUserAssignment.value) {
      const userId = editingUserAssignmentRecord.value.employee.id;
      const assignmentData = {
        target: userAssignmentDetails[String(userId)]?.target,
      };

      const weightForUpdate =
        editingUserAssignmentRecord.value?.weight ??
        props.kpiDetailData?.weight;

      const assignmentsPayload = {
        assignments: [
          {
            user_id: userId,
            target: assignmentData.target,
            weight: weightForUpdate,
          },
        ],
        contextDepartmentId: props.contextDepartmentId || null,
      };
      await store.dispatch("kpis/saveUserAssignments", {
        kpiId: currentKpiId,
        assignmentsPayload: assignmentsPayload,
      });
      notification.success({
        message: $t("assignmentUpdated"),
      });
    } else {
      const assignmentsPayload = {
        assignments: selectedUserIds.value.map((userId) => ({
          user_id: userId,
          target: userAssignmentDetails[String(userId)]?.target,
          weight: props.kpiDetailData?.weight,
          status: props.kpiDetailData?.status,
        })),
        contextDepartmentId: props.contextDepartmentId || null,
      };
      await store.dispatch("kpis/saveUserAssignments", {
        kpiId: currentKpiId,
        assignmentsPayload: assignmentsPayload,
      });
      notification.success({
        message: $t("usersAssignedSuccessfully"),
      });
    }
    closeAssignUserModal();
    emit("refresh");
  } catch (err) {
    const errorMsg = getErrorDescription(err);
    userAssignmentSubmitError.value = errorMsg;
    notification.error({
      message: $t("saveFailed"),
      description: errorMsg,
    });
  } finally {
    submittingUserAssignment.value = false;
  }
};

const confirmDeleteUserAssignment = (record) => {
  userAssignmentToDelete.value = record;
  isDeleteUserAssignModalVisible.value = true;
};

const handleDeleteUserAssignment = async () => {
  if (!userAssignmentToDelete.value || !userAssignmentToDelete.value.id) {
    notification.error({
      message: $t("cannotDeleteMissingAssignmentId"),
    });
    return;
  }
  submittingUserDeletion.value = true;
  const assignmentIdToDelete = userAssignmentToDelete.value.id;
  const userName = getFullName(userAssignmentToDelete.value.employee);
  const currentKpiId = props.kpiId;
  try {
    await store.dispatch("kpis/deleteUserAssignment", {
      kpiId: currentKpiId,
      assignmentId: assignmentIdToDelete,
    });
    notification.success({
      message: $t("assignmentRemovedForUser", { userName }),
    });
    isDeleteUserAssignModalVisible.value = false;
    userAssignmentToDelete.value = null;
    emit("refresh");
  } catch (err) {
    notification.error({
      message: $t("deletionFailed"),
      description: store.getters["kpis/assignmentError"] || err.message,
    });
    isDeleteUserAssignModalVisible.value = false;
  } finally {
    submittingUserDeletion.value = false;
  }
};

const onSelectedUsersInSectionChange = (userIds) => {
  Object.keys(assignUsersInSectionTargetDetails).forEach((uid) => {
    if (!userIds.includes(Number(uid)) && !userIds.includes(uid)) {
      delete assignUsersInSectionTargetDetails[uid];
    }
  });

  userIds.forEach((uid) => {
    if (!assignUsersInSectionTargetDetails[uid]) {
      assignUsersInSectionTargetDetails[uid] = null;
    }
  });
};

const handleAssignUsersInSection = async () => {
  userAssignErrorInSection.value = null;
  if (
    !selectedSectionIdForUserAssign.value ||
    !selectedUserIdsInSection.value.length
  ) {
    userAssignErrorInSection.value = $t("selectSectionAndUsersRequired");
    return;
  }

  for (const userId of selectedUserIdsInSection.value) {
    const target = assignUsersInSectionTargetDetails[userId];
    if (
      target === null ||
      target === undefined ||
      target === "" ||
      isNaN(Number(target))
    ) {
      userAssignErrorInSection.value = $t("targetRequiredForEachUser");
      return;
    }
  }

  // Validation 3: Kiểm tra tổng employee targets <= section target (hoặc KPI target nếu KPI được tạo bởi section)
  const sectionId = selectedSectionIdForUserAssign.value;

  // Tính tổng target của các users đang được assign
  let incomingSum = 0;
  selectedUserIdsInSection.value.forEach((userId) => {
    const t = assignUsersInSectionTargetDetails[userId];
    if (t) incomingSum += Number(t);
  });

  const validation = validateEmployeeTotalAgainstSection(
    sectionId,
    null, // excludeAssignmentId - không có assignment nào đang được edit
    incomingSum,
  );

  if (validation?.error) {
    userAssignErrorInSection.value = validation.message;
    return;
  }

  assigningUsersInSection.value = true;
  try {
    await store.dispatch("kpis/saveUserAssignments", {
      kpiId: props.kpiId,
      assignmentsPayload: {
        assignments: selectedUserIdsInSection.value.map((userId) => ({
          user_id: userId,
          section_id: selectedSectionIdForUserAssign.value,
          target: Number(assignUsersInSectionTargetDetails[userId]),
        })),
      },
    });
    notification.success({ message: $t("usersAssignedSuccessfully") });
    closeAssignUsersInDeptSectionsModal();
    emit("refresh");
  } catch (err) {
    userAssignErrorInSection.value =
      err?.message || $t("failedToSaveAssignments");
  } finally {
    assigningUsersInSection.value = false;
  }
};

const fetchUsersInSection = async () => {
  assignableUsersInSection.value = [];
  selectedUserIdsInSection.value = [];
  userAssignErrorInSection.value = null;
  if (!selectedSectionIdForUserAssign.value) return;
  try {
    await store.dispatch(
      "employees/fetchUsersBySection",
      selectedSectionIdForUserAssign.value,
    );
    const users = store.getters["employees/usersBySection"](
      selectedSectionIdForUserAssign.value,
    );
    assignableUsersInSection.value = Array.isArray(users)
      ? users.map((u) => ({
          value: u.id,
          label: getFullName(u, true),
        }))
      : [];
  } catch (err) {
    userAssignErrorInSection.value =
      err?.message || $t("failedToLoadAssignableUsers");
  }
};

const openAssignUsersInDeptSectionsModal = () => {
  isAssignUsersInDeptSectionsModalVisible.value = true;
  selectedSectionIdForUserAssign.value = null;
  assignableUsersInSection.value = [];
  selectedUserIdsInSection.value = [];
  userAssignErrorInSection.value = null;
};

const closeAssignUsersInDeptSectionsModal = () => {
  isAssignUsersInDeptSectionsModalVisible.value = false;
  selectedSectionIdForUserAssign.value = null;
  assignableUsersInSection.value = [];
  selectedUserIdsInSection.value = [];
  userAssignErrorInSection.value = null;
};

const openManageDepartmentSectionAssignments = () => {
  const currentContextDeptId = props.contextDepartmentId;

  editingDepartmentSectionAssignment.value = null;
  departmentSectionAssignmentForm.assignmentId = null;
  departmentSectionAssignmentForm.assigned_to_section = null;
  departmentSectionAssignmentForm.targetValue = null;

  if (currentContextDeptId !== null) {
    departmentSectionAssignmentForm.assigned_to_department =
      currentContextDeptId;
    store.dispatch("sections/fetchSectionsByDepartment", currentContextDeptId);
  } else {
    departmentSectionAssignmentForm.assigned_to_department = null;
  }
  isDepartmentSectionAssignmentModalVisible.value = true;

  // Ensure departments are loaded when modal opens
  if (!props.allDepartments || props.allDepartments.length === 0) {
    store.dispatch("departments/fetchDepartments", { forceRefresh: true });
  }

  departmentSectionAssignmentFormRef.value?.resetFields();
};

const openEditDepartmentSectionAssignment = (assignmentRecord) => {
  // Determine assignment type and set form values accordingly
  // Check for section assignment first, since section assignments also have department ID
  if (assignmentRecord.assigned_to_section !== null) {
    // Section assignment - find department from section
    const section = props.allSections.find(
      (s) => s.id === assignmentRecord.assigned_to_section,
    );
    if (section) {
      const deptId = section.department_id || section.department?.id;
      departmentSectionAssignmentForm.assigned_to_department = deptId;
      departmentSectionAssignmentForm.assigned_to_section =
        assignmentRecord.assigned_to_section;
    }
  } else if (assignmentRecord.assigned_to_department !== null) {
    // Department-only assignment
    departmentSectionAssignmentForm.assigned_to_department =
      assignmentRecord.assigned_to_department;
    departmentSectionAssignmentForm.assigned_to_section = null;
  } else {
    // Employee assignment or other - set defaults
    departmentSectionAssignmentForm.assigned_to_department = null;
    departmentSectionAssignmentForm.assigned_to_section = null;
  }

  editingDepartmentSectionAssignment.value = assignmentRecord;
  departmentSectionAssignmentForm.targetValue = assignmentRecord.targetValue;
  departmentSectionAssignmentForm.assignmentId = assignmentRecord.id;
  isDepartmentSectionAssignmentModalVisible.value = true;

  // Ensure departments are loaded when modal opens
  if (!props.allDepartments || props.allDepartments.length === 0) {
    store.dispatch("departments/fetchDepartments", { forceRefresh: true });
  }
};

const closeManageDepartmentSectionAssignments = () => {
  isDepartmentSectionAssignmentModalVisible.value = false;
  setTimeout(() => {
    editingDepartmentSectionAssignment.value = null;
    departmentSectionAssignmentForm.assigned_to_department = null;
    departmentSectionAssignmentForm.assigned_to_section = null;
    departmentSectionAssignmentForm.targetValue = null;
    departmentSectionAssignmentForm.weight = null;
    departmentSectionAssignmentForm.assignmentId = null;
  }, 300);
};

const confirmDeleteDepartmentSectionAssignment = (assignmentRecord) => {
  departmentSectionAssignmentToDelete.value = assignmentRecord;
  isDeleteDepartmentSectionAssignmentModalVisible.value = true;
};

const handleDeleteDepartmentSectionAssignment = async () => {
  if (
    !departmentSectionAssignmentToDelete.value ||
    !departmentSectionAssignmentToDelete.value.id
  ) {
    notification.error({
      message: $t("error"),
      description: $t("cannotIdentifyAssignmentToDelete"),
    });
    return;
  }

  submittingDepartmentSectionDeletion.value = true;

  const assignmentIdToDelete = departmentSectionAssignmentToDelete.value.id;
  const kpiIdForRefresh = props.kpiId;

  try {
    await store.dispatch("kpis/deleteDepartmentSectionAssignment", {
      assignmentId: assignmentIdToDelete,
      kpiId: kpiIdForRefresh,
    });

    notification.success({ message: $t("assignmentDeletedSuccessfully") });

    isDeleteDepartmentSectionAssignmentModalVisible.value = false;
    departmentSectionAssignmentToDelete.value = null;

    emit("refresh");
  } catch (error) {
    console.error("Failed to delete Department/Section assignment:", error);
    const errorMessage =
      store.getters["kpis/error"] ||
      error.message ||
      $t("failedToDeleteAssignment");
    notification.error({
      message: $t("deletionFailed"),
      description: errorMessage,
    });
  } finally {
    submittingDepartmentSectionDeletion.value = false;
  }
};

const handleSaveDepartmentSectionAssignment = async () => {
  const isEditing = !!editingDepartmentSectionAssignment.value;

  if (
    departmentSectionAssignmentForm.assigned_to_department &&
    !departmentSectionAssignmentForm.assigned_to_section
  ) {
    const assignments = props.kpiDetailData?.assignments || [];
    const deptId = departmentSectionAssignmentForm.assigned_to_department;

    const duplicate = assignments.find(
      (a) =>
        a.assigned_to_department == deptId &&
        (!a.assigned_to_section || a.assigned_to_section === null) &&
        (!isEditing || a.id !== departmentSectionAssignmentForm.assignmentId),
    );
    if (duplicate) {
      notification.error({
        message: $t("error"),
        description: $t("departmentAlreadyAssigned"),
      });
      submittingDepartmentSectionAssignment.value = false;
      return;
    }
  }

  if (!departmentSectionAssignmentForm.assigned_to_department) {
    submittingDepartmentSectionAssignment.value = false;
    return;
  }

  submittingDepartmentSectionAssignment.value = true;

  try {
    // Validate form - if validation fails, it will throw and we just return silently
    // (Ant Design will show validation errors in the form)
    try {
      await departmentSectionAssignmentFormRef.value?.validate();
    } catch (validationError) {
      // Form validation failed - errors are shown in form, just return
      submittingDepartmentSectionAssignment.value = false;
      return;
    }

    if (
      departmentSectionAssignmentForm.targetValue === null ||
      typeof departmentSectionAssignmentForm.targetValue === "undefined"
    ) {
      submittingDepartmentSectionAssignment.value = false;
      return;
    }

    let assignmentPayload = {
      assignmentId: departmentSectionAssignmentForm.assignmentId,
      assigned_to_department: null,
      assigned_to_section: null,
      targetValue: Number(
        departmentSectionAssignmentForm.targetValue
          .toString()
          .replace(/,/g, ""),
      ),
    };

    // Set department and section
    assignmentPayload.assigned_to_department =
      departmentSectionAssignmentForm.assigned_to_department || null;
    assignmentPayload.assigned_to_section =
      departmentSectionAssignmentForm.assigned_to_section || null;

    const excludeId =
      isEditing && departmentSectionAssignmentForm.assignmentId
        ? departmentSectionAssignmentForm.assignmentId
        : null;

    // Validation 1: Nếu assign department, kiểm tra tổng department targets <= KPI target
    if (!assignmentPayload.assigned_to_section) {
      const validation = validateDepartmentTotalAgainstKpi(
        excludeId,
        assignmentPayload.targetValue,
      );
      if (validation?.error) {
        notification.error({
          message: $t("invalidTarget"),
          description: validation.message,
        });
        submittingDepartmentSectionAssignment.value = false;
        return;
      }
    }

    // Validation 2: Nếu assign section, kiểm tra tổng section targets <= department target (hoặc KPI target nếu KPI được tạo bởi department)
    if (assignmentPayload.assigned_to_section) {
      const deptId = assignmentPayload.assigned_to_department;
      const validation = validateSectionTotalAgainstDepartment(
        deptId,
        excludeId,
        assignmentPayload.targetValue,
      );

      if (validation?.error) {
        notification.error({
          message: $t("invalidTarget"),
          description: validation.message,
        });
        submittingDepartmentSectionAssignment.value = false;
        return;
      }
    }

    assignmentPayload.status = props.kpiDetailData?.status;
    if (
      !assignmentPayload.assigned_to_department &&
      !assignmentPayload.assigned_to_section
    ) {
      submittingDepartmentSectionAssignment.value = false;
      return;
    }

    const assignmentsArray = [assignmentPayload];

    await store.dispatch("kpis/saveDepartmentSectionAssignment", {
      kpiId: props.kpiId,
      assignmentsArray: assignmentsArray,
    });

    notification.success({
      message: isEditing
        ? $t("assignmentUpdatedSuccessfully")
        : $t("assignmentAddedSuccessfully"),
    });

    closeManageDepartmentSectionAssignments();
    emit("refresh");
  } catch (error) {
    console.error("Failed to save Department/Section assignment:", error);
    const errorMsg = getErrorDescription(error);
    notification.error({
      message: $t("saveFailed"),
      description: errorMsg,
    });
  } finally {
    submittingDepartmentSectionAssignment.value = false;
  }
};

const handleDepartmentSelectInModal = (departmentId) => {
  departmentSectionAssignmentForm.assigned_to_section = null;

  if (departmentId) {
    store.dispatch("sections/fetchSectionsByDepartment", departmentId);
  }
};

const handleNumericInput = (field, event) => {
  let value = event.target.value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }

  const [intPart, decPart] = value.split(".");
  let formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decPart !== undefined) formatted += "." + decPart;
  departmentSectionAssignmentForm[field] = formatted;
};

watch(
  selectedUserIds,
  (newUserIds, oldUserIds = []) => {
    if (isEditingUserAssignment.value) return;
    const newUserIdsSet = new Set(newUserIds.map(String));
    const oldUserIdsSet = new Set(oldUserIds.map(String));
    newUserIds.forEach((userId) => {
      ensureUserAssignmentDetail(String(userId));
    });
    oldUserIdsSet.forEach((oldUserId) => {
      if (!newUserIdsSet.has(oldUserId)) {
        delete userAssignmentDetails[oldUserId];
      }
    });
  },
  {
    deep: true,
  },
);

// Expose methods to parent
defineExpose({
  openAssignUserModal,
  openEditUserModal,
  confirmDeleteUserAssignment,
  openAssignUsersInDeptSectionsModal,
  openManageDepartmentSectionAssignments,
  openEditDepartmentSectionAssignment,
  confirmDeleteDepartmentSectionAssignment,
});
</script>

<style scoped>
.ant-descriptions-item-label {
  font-weight: bold;
}

p {
  margin-bottom: 0.5em;
}
</style>
