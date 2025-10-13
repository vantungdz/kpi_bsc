<template>
  <!-- Section Assignment Modals -->
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
          {{ editingUserAssignmentRecord.employee?.first_name }}
          {{ editingUserAssignmentRecord.employee?.last_name }} ({{
            editingUserAssignmentRecord.employee?.username
          }})
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
              @input="(event) => handleNumericInput('targetValue', event)"
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
        {{ userAssignmentToDelete.employee.first_name }}
        {{ userAssignmentToDelete.employee.last_name }}
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
  FormItem as AFormItem,
  Spin as ASpin,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Avatar as AAvatar,
  Table as ATable,
  Input as AInput,
} from "ant-design-vue";
import { notification } from "ant-design-vue";

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
  userAssignmentError: {
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
  contextSectionId: {
    type: Number,
    default: null,
  },
  canAssignEmployees: {
    type: Boolean,
    default: false,
  },
  sectionIdForUserAssignmentsCard: {
    type: Number,
    default: null,
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

const allUserAssignmentsForKpi = computed(
  () => store.getters["kpis/currentKpiUserAssignments"]
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
    label: `${user.first_name || ""} ${user.last_name || ""} (${user.username})`,
    name: `${user.first_name || ""} ${user.last_name || ""}`,
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
      editingUserAssignmentRecord.value.weight
    );
    return [
      {
        userId: user.id,
        name: `${user.first_name || ""} ${user.last_name || ""}`,
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
  const sectionIdForTitle = props.sectionIdForUserAssignmentsCard;

  if (sectionIdForTitle) {
    const sectionInfo = props.allSections.find(
      (s) => s.id == sectionIdForTitle
    );
    const sectionName = sectionInfo?.name || `ID ${sectionIdForTitle}`;
    return $t("assignKpiToUsersInSection", { sectionName });
  }

  if (isEditingUserAssignment.value) {
    return $t("editUserAssignment");
  }
  return $t("assignKpiToUsers");
});

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
  initialWeight = null
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
  const sectionIdToFetch = props.contextSectionId;

  let fetchedUsersList = [];

  if (!isEditingUserAssignment.value) {
    selectedUserIds.value = [];
  }

  assignableUsers.value = [];
  loadingAssignableUsers.value = true;
  userAssignmentSubmitError.value = null;

  try {
    if (sectionIdToFetch) {
      await store.dispatch("employees/fetchUsersBySection", sectionIdToFetch);
      fetchedUsersList =
        store.getters["employees/usersBySection"](sectionIdToFetch);
    } else {
      fetchedUsersList = [];
    }

    if (Array.isArray(fetchedUsersList)) {
      assignableUsers.value = fetchedUsersList;
    } else {
      console.error(
        "fetchAssignableUsersData: Fetched users list is NOT an array.",
        fetchedUsersList
      );
      assignableUsers.value = [];
      userAssignmentSubmitError.value = $t("failedToProcessUserList");
    }
  } catch (err) {
    console.error(
      "fetchAssignableUsersData: Error during dispatch or getter access:",
      err
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
    (key) => delete userAssignmentDetails[key]
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
    (key) => delete userAssignmentDetails[key]
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
      (key) => delete userAssignmentDetails[key]
    );
    userAssignmentSubmitError.value = null;
    assignableUsers.value = [];
  }, 300);
};

const handleSaveUserAssignment = async () => {
  userAssignmentSubmitError.value = null;
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
    userAssignmentSubmitError.value =
      store.getters["kpis/assignmentError"] ||
      err.message ||
      $t("failedToSave");
    notification.error({
      message: $t("saveFailed"),
      description: userAssignmentSubmitError.value,
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
  const userName = `${userAssignmentToDelete.value.employee?.first_name || ""}
    ${userAssignmentToDelete.value.employee?.last_name || ""}`;
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

const handleNumericInput = (field, event) => {
  let value = event.target.value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }

  const [intPart, decPart] = value.split(".");
  const formatted =
    intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (decPart !== undefined ? "." + decPart : "");
  return formatted;
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
  }
);

// Expose methods to parent
defineExpose({
  openAssignUserModal,
  openEditUserModal,
  confirmDeleteUserAssignment,
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
