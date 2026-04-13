<template>
  <a-card class="section-create-form">
    <LoadingOverlay :visible="loading || loadingManagers || editLoading || globalLoading" />
    <div class="form-header">
      <a-avatar
        class="form-header-icon"
        size="large"
        style="background: linear-gradient(135deg, #1890ff 60%, #e6f7ff 100%)"
      >
        <template #icon>
          <AppstoreOutlined />
        </template>
      </a-avatar>
      <h2 class="form-title">{{ $t("createSection") }}</h2>
    </div>
    <a-divider />
    <a-form
      :model="form"
      :rules="rules"
      ref="formRef"
      layout="vertical"
      @finish="handleSubmit"
    >
      <a-row :gutter="16">
        <a-col :xs="24" :md="12">
          <a-form-item :label="$t('sectionName')" name="name">
            <a-input
              v-model:value="form.name"
              :placeholder="$t('enterSectionName')"
            >
              <template #prefix>
                <AppstoreOutlined />
              </template>
            </a-input>
          </a-form-item>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-form-item :label="$t('department')" name="departmentId">
            <a-select
              v-model:value="form.departmentId"
              :placeholder="$t('selectDepartment')"
              :options="departmentOptions"
            >
              <template #suffixIcon>
                <ApartmentOutlined />
              </template>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item :label="$t('manager')" name="managerId">
        <a-select
          v-model:value="form.managerId"
          :placeholder="$t('selectManager')"
          :options="filteredManagerOptions"
          :loading="loadingManagers"
          show-search
          :filter-option="filterManagerOption"
          @focus="handleManagerDropdownFocus"
        >
          <template #suffixIcon>
            <UserOutlined />
          </template>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-button
          type="default"
          html-type="submit"
          :loading="loading"
          class="create-btn-modern"
          size="middle"
          shape="round"
        >
          <template #icon>
            <PlusOutlined />
          </template>
          {{ $t("common.create") }}
        </a-button>
      </a-form-item>
    </a-form>
    <a-divider />
    <div>
      <h3 class="list-title">{{ $t("sectionList") }}</h3>
      <div v-if="sectionList && sectionList.length" class="sections-table-wrapper">
        <table class="ant-table ant-table-small ant-table-bordered">
          <thead class="ant-table-thead">
            <tr>
              <th style="width: 40px; text-align: center"></th>
              <th>{{ $t("sectionName") }}</th>
              <th>{{ $t("department") }}</th>
              <th>{{ $t("manager") }}</th>
              <th style="width: 85px; text-align: center">{{ $t("order") }}</th>
              <th style="width: 120px; text-align: center">{{ $t("common.actions") }}</th>
            </tr>
          </thead>
          <draggable
            v-model="sortedSectionList"
            tag="tbody"
            item-key="id"
            handle=".drag-handle"
            :animation="200"
            @end="handleDragEnd"
            class="ant-table-tbody"
          >
            <template #item="{ element, index }">
              <tr :key="element.id" class="ant-table-row">
                <td style="text-align: center; cursor: move">
                  <HolderOutlined class="drag-handle" />
                </td>
                <td>{{ element.name }}</td>
                <td>{{ element.department?.name || "" }}</td>
                <td>
                  <span v-if="element.manager">
                    {{ $getFullName(element.manager) || element.manager.username || "" }}
                  </span>
                </td>
                <td style="text-align: center">
                  <span class="order-badge">{{ index + 1 }}</span>
                </td>
                <td style="text-align: center">
                  <a-tooltip :title="t('common.edit')">
                    <a-button
                      size="small"
                      type="text"
                      @click="() => editSection(element)"
                    >
                      <template #icon><EditOutlined /></template>
                    </a-button>
                  </a-tooltip>
                  <a-popconfirm
                    :title="$t('confirmDelete', { name: element.name })"
                    :ok-text="t('common.delete')"
                    :cancel-text="t('common.cancel')"
                    @confirm="() => deleteSection(element)"
                  >
                    <a-tooltip :title="t('common.delete')">
                      <a-button size="small" type="text" danger>
                        <template #icon><DeleteOutlined /></template>
                      </a-button>
                    </a-tooltip>
                  </a-popconfirm>
                </td>
              </tr>
            </template>
          </draggable>
        </table>
      </div>
      <a-empty v-else :description="$t('noSections')" />
    </div>
    <a-modal
      v-model:visible="showEditModal"
      :title="$t('editSection')"
      :confirm-loading="editLoading"
      @ok="handleUpdateSection"
      @cancel="closeEditModal"
      destroy-on-close
    >
      <a-form
        :model="editForm"
        :rules="rules"
        ref="editFormRef"
        layout="vertical"
        @finish="handleUpdateSection"
      >
        <a-row :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item :label="$t('sectionName')" name="name">
              <a-input
                v-model:value="editForm.name"
                :placeholder="$t('enterSectionName')"
              >
                <template #prefix>
                  <AppstoreOutlined />
                </template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item :label="$t('manager')" name="managerId">
              <a-select
                v-model:value="editForm.managerId"
                :placeholder="$t('selectManager')"
                :options="filteredManagerOptionsForEdit"
                :loading="loadingManagers"
                show-search
                :filter-option="filterManagerOption"
                @focus="handleManagerDropdownFocus"
              >
                <template #suffixIcon>
                  <UserOutlined />
                </template>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item :label="$t('department')" name="departmentId">
          <a-select
            v-model:value="editForm.departmentId"
            :placeholder="$t('selectDepartment')"
            :options="departmentOptions"
          >
            <template #suffixIcon>
              <ApartmentOutlined />
            </template>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
    <a-modal
      v-model:visible="showWarningModal"
      :title="$t('warning')"
      @ok="handleWarningConfirm"
      @cancel="handleWarningCancel"
      ok-type="danger"
      :ok-text="$t('common.continue')"
      :cancel-text="$t('common.cancel')"
      :confirm-loading="isUpdateMode ? editLoading : loading"
    >
      <div style="color: #faad14; font-weight: 500">
        <span>{{ warningMessage }}</span>
      </div>
      <div v-if="pendingSectionData && managerOptions.length">
        <br />
        <span style="font-size: 0.95em; color: #888">{{
          $t("managerAssignmentWarningDetail")
        }}</span>
      </div>
    </a-modal>
  </a-card>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import { useStore } from "vuex";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { getFullName } from "@/core/utils/format";
import {
  AppstoreOutlined,
  ApartmentOutlined,
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HolderOutlined,
} from "@ant-design/icons-vue";
import draggable from "vuedraggable";

const { t } = useI18n();
const store = useStore();
const formRef = ref();
const form = ref({ name: "", departmentId: null, managerId: null });
const editFormRef = ref();
const editForm = ref({
  id: null,
  name: "",
  departmentId: null,
  managerId: null,
});
const loading = ref(false);
const editLoading = ref(false);
const departmentOptions = ref([]);
const loadingManagers = ref(false);
const managerOptions = ref([]);
const allManagers = ref([]); // Store all managers for filtering
const showEditModal = ref(false);
const showWarningModal = ref(false);
const warningMessage = ref("");
const pendingSectionData = ref(null);
const isUpdateMode = ref(false);
const pendingUpdateId = ref(null);

// Global loading from store
const globalLoading = computed(() => store.getters["loading/isLoading"]);

const rules = {
  name: [
    { required: true, message: t("sectionNameRequired"), trigger: "blur" },
    { min: 2, max: 100, message: t("sectionNameLength"), trigger: "blur" },
  ],
  departmentId: [
    { required: true, message: t("departmentRequired"), trigger: "change" },
  ],
  managerId: [
    { required: false, message: t("managerRequired"), trigger: "change" },
  ],
};

const filterManagerOption = (input, option) => {
  return option.label.toLowerCase().includes(input.toLowerCase());
};

const handleManagerDropdownFocus = async () => {
  // Fetch latest managers when dropdown is focused to ensure new employees are available
  await fetchManagers();
};

// Computed property to filter managers by selected department
const filteredManagerOptions = computed(() => {
  const departmentId = form.value.departmentId;
  if (!departmentId) {
    return managerOptions.value;
  }
  // Filter managers that belong to the selected department
  const managerIdDepartment = departmentOptions.value.find(d => d.value === departmentId)?.managerId;
  return managerOptions.value.filter((option) => {
    const manager = allManagers.value.find((m) => m.id === option.value && m.id !== managerIdDepartment);
    if (!manager) return false;
    // Check if manager's department matches selected department
    return manager.department?.id === departmentId || manager.departmentId === departmentId;
  });
});

// Computed property for edit form
const filteredManagerOptionsForEdit = computed(() => {
  const departmentId = editForm.value.departmentId;
  if (!departmentId) {
    return managerOptions.value;
  }
  // Filter managers that belong to the selected department
  return managerOptions.value.filter((option) => {
    const manager = allManagers.value.find((m) => m.id === option.value);
    if (!manager) return false;
    // Check if manager's department matches selected department
    return manager.department?.id === departmentId || manager.departmentId === departmentId;
  });
});

const fetchManagers = async () => {
  loadingManagers.value = true;
  try {
    // Always fetch all managers, we'll filter by department in computed property
    const users = await store.dispatch("employees/fetchUsers", {
      roles: ["manager"],
      force: true,
    });
    allManagers.value = users || [];
    managerOptions.value = (users || []).map((u) => ({
      value: u.id,
      label: getFullName(u, true),
    }));
  } catch (e) {
    managerOptions.value = [];
    allManagers.value = [];
  } finally {
    loadingManagers.value = false;
  }
};

const fetchDepartments = async () => {
  await store.dispatch("departments/fetchDepartments");
  const departments = store.getters["departments/departmentList"] || [];
  departmentOptions.value = departments.map((d) => ({
    label: d.name,
    value: d.id,
    managerId: d.managerId,
  }));
};

const sectionList = computed(() => store.getters["sections/sectionList"] || []);
const sortedSectionList = ref([]);
const dragUpdating = ref(false);

// Update sorted list when section list changes
const updateSortedList = () => {
  const sections = sectionList.value || [];
  // Sort by sort_order if available, otherwise by id
  sortedSectionList.value = [...sections].sort((a, b) => {
    const orderA = a.sort_order ?? a.id ?? 0;
    const orderB = b.sort_order ?? b.id ?? 0;
    return orderA - orderB;
  });
};

// Handle drag end event
const handleDragEnd = async () => {
  if (dragUpdating.value) return;

  dragUpdating.value = true;
  await store.dispatch("loading/startLoading");
  try {
    // Create update payload with new order
    const updatePayload = sortedSectionList.value.map((section, index) => ({
      id: section.id,
      sort_order: index + 1,
    }));

    // Call API to update order
    await store.dispatch("sections/updateSectionOrder", updatePayload);
    message.success(t("orderUpdatedSuccess"));
  } catch (error) {
    message.error(
      error?.message || t("orderUpdatedError")
    );
    updateSortedList();
  } finally {
    dragUpdating.value = false;
    await store.dispatch("loading/stopLoading");
  }
};

const editSection = async (record) => {
  // Fetch latest managers to ensure dropdown has new employees
  await fetchManagers();

  editForm.value = {
    id: record.id,
    name: record.name,
    departmentId: record.department?.id || null,
    managerId: record.manager?.id || null,
  };
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editForm.value = { id: null, name: "", departmentId: null, managerId: null };
  editFormRef.value?.resetFields();
};

const handleUpdateSection = async () => {
  editLoading.value = true;
  try {
    const res = await store.dispatch("sections/updateSection", {
      id: editForm.value.id,
      data: {
        name: editForm.value.name,
        departmentId: editForm.value.departmentId,
        managerId: editForm.value.managerId,
      },
    });
    if (res && res.warning) {
      warningMessage.value = res.warning;
      showWarningModal.value = true;
      pendingSectionData.value = {
        name: editForm.value.name,
        departmentId: editForm.value.departmentId,
        managerId: editForm.value.managerId,
      };
      isUpdateMode.value = true;
      pendingUpdateId.value = editForm.value.id;
      editLoading.value = false;
      return;
    }
    message.success(t("sectionUpdatedSuccess"));
    closeEditModal();
    await store.dispatch("sections/fetchSections");
    updateSortedList();
  } catch (e) {
    message.error(e?.message || t("sectionUpdatedError"));
  } finally {
    editLoading.value = false;
  }
};

const deleteSection = async (record) => {
  try {
    await store.dispatch("sections/deleteSection", record.id);
    message.success(t("sectionDeletedSuccess"));
    await store.dispatch("sections/fetchSections");
    updateSortedList();
  } catch (e) {
    message.error(e?.message || t("sectionDeletedError"));
  }
};

onMounted(async () => {
  await Promise.all([fetchManagers(), fetchDepartments()]);
  await store.dispatch("sections/fetchSections");
  updateSortedList();
});

// Watch for changes in section list
watch(sectionList, () => {
  updateSortedList();
}, { deep: true });

// Watch for department changes to reset manager if needed
watch(() => form.value.departmentId, (newDeptId, oldDeptId) => {
  if (newDeptId !== oldDeptId) {
    // Reset manager if current manager doesn't belong to new department
    if (form.value.managerId) {
      const currentManager = allManagers.value.find(m => m.id === form.value.managerId);
      const belongsToNewDept = currentManager && (
        currentManager.department?.id === newDeptId ||
        currentManager.departmentId === newDeptId
      );
      if (!belongsToNewDept) {
        form.value.managerId = null;
      }
    }
  }
});

// Watch for department changes in edit form
watch(() => editForm.value.departmentId, (newDeptId, oldDeptId) => {
  if (newDeptId !== oldDeptId) {
    // Reset manager if current manager doesn't belong to new department
    if (editForm.value.managerId) {
      const currentManager = allManagers.value.find(m => m.id === editForm.value.managerId);
      const belongsToNewDept = currentManager && (
        currentManager.department?.id === newDeptId ||
        currentManager.departmentId === newDeptId
      );
      if (!belongsToNewDept) {
        editForm.value.managerId = null;
      }
    }
  }
});

// Watch for edit modal opening to refresh managers
watch(showEditModal, async (isVisible) => {
  if (isVisible) {
    // Fetch latest managers when modal opens
    await fetchManagers();
  }
});

const handleWarningConfirm = async () => {
  if (!pendingSectionData.value) return;

  if (isUpdateMode.value) {
    // Handle update with forceUpdateManager
    editLoading.value = true;
    try {
      const res = await store.dispatch("sections/updateSection", {
        id: pendingUpdateId.value,
        data: {
          ...pendingSectionData.value,
          forceUpdateManager: true,
        },
      });
      if (res && res.warning) {
        warningMessage.value = res.warning;
        showWarningModal.value = true;
        editLoading.value = false;
        return;
      }
      message.success(t("sectionUpdatedSuccess"));
      closeEditModal();
      await store.dispatch("sections/fetchSections");
      await store.dispatch("employees/fetchUsers", { force: true });
      updateSortedList();
    } catch (e) {
      message.error(e?.message || t("sectionUpdatedError"));
    } finally {
      editLoading.value = false;
      showWarningModal.value = false;
      pendingSectionData.value = null;
      isUpdateMode.value = false;
      pendingUpdateId.value = null;
    }
  } else {
    // Handle create with forceUpdateManager
    loading.value = true;
    try {
      const res = await store.dispatch("sections/createSection", {
        ...pendingSectionData.value,
        forceUpdateManager: true,
      });
      if (res && res.warning) {
        warningMessage.value = res.warning;
        showWarningModal.value = true;
        loading.value = false;
        return;
      }
      message.success(t("sectionCreatedSuccess"));
      form.value = { name: "", departmentId: null, managerId: null };
      formRef.value?.resetFields();
      await store.dispatch("sections/fetchSections");
      await store.dispatch("employees/fetchUsers", { force: true });
      updateSortedList();
    } catch (e) {
      message.error(e?.message || t("sectionCreatedError"));
    } finally {
      loading.value = false;
      showWarningModal.value = false;
      pendingSectionData.value = null;
      isUpdateMode.value = false;
      pendingUpdateId.value = null;
    }
  }
};

const handleWarningCancel = () => {
  showWarningModal.value = false;
  pendingSectionData.value = null;
  isUpdateMode.value = false;
  pendingUpdateId.value = null;
};

const handleSubmit = async () => {
  loading.value = true;
  try {
    const payload = {
      name: form.value.name,
      departmentId: form.value.departmentId,
      managerId: form.value.managerId,
    };
    const res = await store.dispatch("sections/createSection", payload);
    if (res && res.warning) {
      warningMessage.value = res.warning;
      showWarningModal.value = true;
      pendingSectionData.value = payload;
      loading.value = false;
      return;
    }

    message.success(t("sectionCreatedSuccess"));
    form.value = { name: "", departmentId: null, managerId: null };
    formRef.value?.resetFields();
    await store.dispatch("sections/fetchSections");
    await store.dispatch("employees/fetchUsers", { force: true });
    updateSortedList();
  } catch (e) {
    message.error(e?.message || t("sectionCreatedError"));
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.section-create-form {
  margin: 0 auto;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 24px #e6f7ff55;
  padding: 36px 32px 24px 32px;
  transition: box-shadow 0.2s;
  max-width: 70%;
}
.form-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 0.5em;
  justify-content: center;
}
.form-header-icon {
  box-shadow: 0 2px 8px #e6f7ff99;
}
.form-title {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin: 0;
}
.create-btn-modern {
  min-width: 110px;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 20px;
  height: 38px;
  background: #f4f8ff;
  color: #1890ff;
  border: 1.5px solid #e6f7ff;
  box-shadow: none;
  transition: all 0.18s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.create-btn-modern:hover,
.create-btn-modern:focus {
  background: #e6f7ff;
  color: #1677ff;
  border-color: #91d5ff;
}
.list-title {
  margin-bottom: 12px;
  font-size: 1.15rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Table wrapper styles */
.sections-table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.sections-table-wrapper table {
  width: 100%;
  border-collapse: collapse;
}

/* Drag handle styles */
.drag-handle {
  cursor: move;
  font-size: 16px;
  color: #bfbfbf;
  transition: color 0.2s;
}

.drag-handle:hover {
  color: #1890ff;
}

/* Make rows draggable */
.ant-table-row {
  cursor: move;
  transition: all 0.2s;
}

.ant-table-row:hover {
  background-color: #f5f9ff !important;
}

/* Order badge styles */
.order-badge {
  display: inline-block;
  min-width: 28px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
  color: #1890ff;
  border-radius: 14px;
  font-weight: 600;
  font-size: 13px;
  padding: 0 8px;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.1);
}

/* Table row hover effect */
:deep(.ant-table-tbody > tr:hover) {
  background-color: #f5f9ff !important;
}

/* Make draggable rows more visible */
:deep(.ant-table-tbody > tr) {
  transition: all 0.2s;
  cursor: move;
}

:deep(.ant-table-tbody > tr.sortable-ghost) {
  opacity: 0.4;
  background: #e6f7ff;
}

:deep(.ant-table-tbody > tr.sortable-drag) {
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
