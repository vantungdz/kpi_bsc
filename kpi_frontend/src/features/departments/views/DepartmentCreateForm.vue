<template>
  <a-card class="department-create-form">
    <LoadingOverlay :visible="loading" />
    <div class="form-header">
      <a-avatar
        class="form-header-icon"
        size="large"
        style="background: linear-gradient(135deg, #1890ff 60%, #e6f7ff 100%)"
      >
        <template #icon>
          <ApartmentOutlined />
        </template>
      </a-avatar>
      <h2 class="form-title">{{ $t("createDepartment") }}</h2>
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
          <a-form-item :label="$t('departmentName')" name="name">
            <a-input
              v-model:value="form.name"
              :placeholder="$t('enterDepartmentName')"
            >
              <template #prefix>
                <ApartmentOutlined />
              </template>
            </a-input>
          </a-form-item>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-form-item :label="$t('manager')" name="managerId">
            <a-select
              v-model:value="form.managerId"
              :placeholder="$t('selectManager')"
              :options="managerOptions"
              :loading="loading"
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
      <h3 class="list-title">{{ $t("departmentList") }}</h3>
      <div v-if="departmentList && departmentList.length" class="departments-table-wrapper">
        <table class="ant-table ant-table-small ant-table-bordered">
          <thead class="ant-table-thead">
            <tr>
              <th style="width: 40px; text-align: center"></th>
              <th>{{ $t("departmentName") }}</th>
              <th>{{ $t("manager") }}</th>
              <th style="width: 85px; text-align: center">{{ $t("order") }}</th>
              <th style="width: 120px; text-align: center">{{ $t("common.actions") }}</th>
            </tr>
          </thead>
          <draggable
            v-model="sortedDepartmentList"
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
                <td>
                  <a-avatar
                    v-if="element.manager"
                    size="small"
                    style="background: #e6f7ff; color: #1890ff; margin-right: 6px"
                  >
                    <template #icon>
                      <UserOutlined />
                    </template>
                  </a-avatar>
                  <span>
                    {{ $getFullName(element.manager) }}
                  </span>
                </td>
                <td style="text-align: center">
                  <span class="order-badge">{{ index + 1 }}</span>
                </td>
                <td style="text-align: center">
                  <a-tooltip :title="t('common.edit')">
                    <a-button size="small" type="text" @click="editDepartment(element)">
                      <template #icon><EditOutlined /></template>
                    </a-button>
                  </a-tooltip>
                  <a-popconfirm
                    :title="$t('confirmDelete', { name: element.name })"
                    :ok-text="t('common.delete')"
                    :cancel-text="t('common.cancel')"
                    @confirm="deleteDepartment(element)"
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
      <a-empty v-else :description="$t('noDepartments')" />
    </div>
  </a-card>

  <a-modal
    v-model:visible="showEditModal"
    :title="$t('editDepartment')"
    :confirm-loading="loading"
    @ok="handleUpdateDepartment"
    @cancel="closeEditModal"
    destroy-on-close
  >
    <a-form
      :model="editForm"
      :rules="rules"
      ref="editFormRef"
      layout="vertical"
      @finish="handleUpdateDepartment"
    >
      <a-form-item :label="$t('departmentName')" name="name">
        <a-input
          v-model:value="editForm.name"
          :placeholder="$t('enterDepartmentName')"
        >
          <template #prefix>
            <ApartmentOutlined />
          </template>
        </a-input>
      </a-form-item>
      <a-form-item :label="$t('manager')" name="managerId">
        <a-select
          v-model:value="editForm.managerId"
          :placeholder="$t('selectManager')"
          :options="managerOptions"
          :loading="loading"
          show-search
          :filter-option="filterManagerOption"
          @focus="handleManagerDropdownFocus"
          allow-clear
        >
          <template #suffixIcon>
            <UserOutlined />
          </template>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>

  <a-modal
    v-model:visible="warningModal"
    :title="$t('common.warning')"
    @ok="handleWarningOk"
    @cancel="handleWarningCancel"
    :ok-text="$t('common.continue')"
    :cancel-text="$t('common.cancel')"
  >
    <div style="color: #d46b08; font-weight: 500">
      {{ warningMessage }}
    </div>
  </a-modal>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import { useStore } from "vuex";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import {
  ApartmentOutlined,
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HolderOutlined,
} from "@ant-design/icons-vue";
import draggable from "vuedraggable";
import { getFullName } from "@/core/utils/format";

const { t } = useI18n();
const store = useStore();
const formRef = ref();
const form = ref({ name: "", managerId: null });
const editFormRef = ref();
const showEditModal = ref(false);
const editForm = ref({ id: null, name: "", managerId: null });
const managerOptions = ref([]);
const warningModal = ref(false);
const warningMessage = ref("");
const warningPayload = ref(null);
const isEditMode = ref(false);

const rules = {
  name: [
    { required: true, message: t("departmentNameRequired"), trigger: "blur" },
    { min: 2, max: 100, message: t("departmentNameLength"), trigger: "blur" },
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

const loading = computed(() => store.getters["loading/isLoading"]);

const fetchManagers = async () => {
  await store.dispatch("loading/startLoading");
  try {
    const users = await store.dispatch("employees/fetchUsers", {
      roles: ["manager"],
      force: true,
    });
    managerOptions.value = (users || []).map((u) => ({
      value: u.id,
      label: getFullName(u, true),
    }));
  } catch (e) {
    managerOptions.value = [];
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const sortedDepartmentList = ref([]);
const dragUpdating = ref(false);

// Update sorted list when department list changes
const updateSortedList = () => {
  const departments = departmentList.value || [];
  sortedDepartmentList.value = [...departments].sort((a, b) => {
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
    const updatePayload = sortedDepartmentList.value.map((dept, index) => ({
      id: dept.id,
      sort_order: index + 1,
    }));

    await store.dispatch("departments/updateDepartmentOrder", updatePayload);
    message.success(t("orderUpdatedSuccess") || "Order updated successfully");
  } catch (error) {
    message.error(
      error?.message || t("orderUpdatedError") || "Failed to update order"
    );
    updateSortedList();
  } finally {
    dragUpdating.value = false;
    await store.dispatch("loading/stopLoading");
  }
};

const editDepartment = async (record) => {
  // Fetch latest managers to ensure dropdown has new employees
  await fetchManagers();

  editForm.value = {
    id: record.id,
    name: record.name,
    managerId: record.manager?.id || null,
  };

  warningModal.value = false;
  warningMessage.value = "";
  warningPayload.value = null;
  isEditMode.value = false;
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editForm.value = { id: null, name: "", managerId: null };
  editFormRef.value?.resetFields();

  warningModal.value = false;
  warningMessage.value = "";
  warningPayload.value = null;
  isEditMode.value = false;
};

const handleUpdateDepartment = async () => {
  await store.dispatch("loading/startLoading");
  try {
    const res = await store.dispatch("departments/updateDepartment", {
      id: editForm.value.id,
      data: {
        name: editForm.value.name,
        managerId: editForm.value.managerId,
      },
    });
    if (res && res.warning) {
      warningMessage.value =
        t("warning." + res.warning) || t("warning.default");
      warningPayload.value = {
        id: editForm.value.id,
        data: {
          name: editForm.value.name,
          managerId: editForm.value.managerId,
          forceUpdateManager: true,
        },
      };
      isEditMode.value = true;
      showEditModal.value = false;
      warningModal.value = true;
      return;
    }
    message.success(t("departmentUpdatedSuccess"));
    closeEditModal();
    await store.dispatch("departments/fetchDepartments");
  } catch (e) {
    message.error(e?.message || t("departmentUpdatedError"));
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

const handleSubmit = async () => {
  await store.dispatch("loading/startLoading");
  try {
    const res = await store.dispatch("departments/createDepartment", {
      name: form.value.name,
      managerId: form.value.managerId,
    });
    if (res && res.warning) {
      warningMessage.value =
        t("warning." + res.warning) || t("warning.default");
      warningPayload.value = {
        name: form.value.name,
        managerId: form.value.managerId,
        forceUpdateManager: true,
      };
      isEditMode.value = false;
      warningModal.value = true;
      return;
    }
    message.success(t("departmentCreatedSuccess"));
    form.value = { name: "", managerId: null };
    formRef.value?.resetFields();
    await store.dispatch("departments/fetchDepartments");
  } catch (e) {
    message.error(e?.message || t("departmentCreatedError"));
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

const handleWarningOk = async () => {
  warningModal.value = false;
  await store.dispatch("loading/startLoading");
  try {
    if (isEditMode.value) {
      await store.dispatch(
        "departments/updateDepartment",
        warningPayload.value
      );
      message.success(t("departmentUpdatedSuccess"));
      closeEditModal();
    } else {
      await store.dispatch(
        "departments/createDepartment",
        warningPayload.value
      );
      message.success(t("departmentCreatedSuccess"));
      form.value = { name: "", managerId: null };
      formRef.value?.resetFields();
    }
    await store.dispatch("departments/fetchDepartments");
  } catch (e) {
    message.error(e?.message || t("departmentCreatedError"));
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

const handleWarningCancel = () => {
  warningModal.value = false;
  if (isEditMode.value) {
    showEditModal.value = true;
  }
  isEditMode.value = false;
};

const deleteDepartment = async (record) => {
  await store.dispatch("loading/startLoading");
  try {
    await store.dispatch("departments/deleteDepartment", record.id);
    message.success(t("departmentDeletedSuccess"));
    await store.dispatch("departments/fetchDepartments");
  } catch (e) {
    message.error(e?.message || t("departmentDeletedError"));
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

onMounted(async () => {
  await fetchManagers();
  await store.dispatch("departments/fetchDepartments");
  updateSortedList();
});

// Watch for changes in department list
watch(departmentList, () => {
  updateSortedList();
}, { deep: true });

// Watch for edit modal opening to refresh managers
watch(showEditModal, async (isVisible) => {
  if (isVisible) {
    // Fetch latest managers when modal opens
    await fetchManagers();
  }
});
</script>

<style scoped>
.department-create-form {
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
.ant-form-item {
  margin-bottom: 18px;
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
.departments-table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.departments-table-wrapper table {
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

/* Make rows draggable */
.ant-table-row {
  cursor: move;
  transition: all 0.2s;
}

.ant-table-row:hover {
  background-color: #f5f9ff !important;
}
</style>
