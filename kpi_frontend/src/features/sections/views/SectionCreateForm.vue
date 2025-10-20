<template>
  <a-card class="section-create-form">
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
          :options="managerOptions"
          :loading="loadingManagers"
          show-search
          :filter-option="filterManagerOption"
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
      <a-table
        :data-source="sectionList"
        :columns="sectionColumns"
        row-key="id"
        size="small"
        :pagination="false"
        bordered
        v-if="sectionList && sectionList.length"
      >
        <template #actions="{ record }">
          <a-tooltip :title="t('common.edit')">
            <a-button
              size="small"
              type="text"
              @click="() => editSection(record)"
            >
              <template #icon><EditOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-popconfirm
            :title="t('confirmDelete')"
            :ok-text="t('common.delete')"
            :cancel-text="t('common.cancel')"
            @confirm="() => deleteSection(record)"
          >
            <a-tooltip :title="t('common.delete')">
              <a-button size="small" type="text" danger>
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </a-popconfirm>
        </template>
      </a-table>
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
                :options="managerOptions"
                :loading="loadingManagers"
                show-search
                :filter-option="filterManagerOption"
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
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import { useStore } from "vuex";
import {
  AppstoreOutlined,
  ApartmentOutlined,
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons-vue";

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
const showEditModal = ref(false);
const showWarningModal = ref(false);
const warningMessage = ref("");
const pendingSectionData = ref(null);

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

const fetchManagers = async () => {
  loadingManagers.value = true;
  try {
    const users = await store.dispatch("employees/fetchUsers", {
      roles: ["manager"],
      force: true,
    });
    managerOptions.value = (users || []).map((u) => ({
      value: u.id,
      label:
        `${u.first_name || ""} ${u.last_name || ""} (${u.username})`.trim(),
    }));
  } catch (e) {
    managerOptions.value = [];
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
  }));
};

const sectionList = computed(() => store.getters["sections/sectionList"] || []);
const sectionColumns = computed(() => [
  { title: t("sectionName"), dataIndex: "name", key: "name" },
  {
    title: t("department"),
    dataIndex: "departmentName",
    key: "departmentName",
    customRender: ({ record }) => record.department?.name || "",
  },
  {
    title: t("manager"),
    dataIndex: "managerName",
    key: "managerName",
    customRender: ({ record }) => {
      if (record.manager) {
        if (record.manager.first_name || record.manager.last_name) {
          return `${record.manager.first_name || ""} ${record.manager.last_name || ""}`.trim();
        }
        return record.manager.username || "";
      }
      return "";
    },
  },
  {
    title: t("common.actions"),
    key: "actions",
    slots: { customRender: "actions" },
  },
]);

const editSection = (record) => {
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
    await store.dispatch("sections/updateSection", {
      id: editForm.value.id,
      data: {
        name: editForm.value.name,
        departmentId: editForm.value.departmentId,
        managerId: editForm.value.managerId,
      },
    });
    message.success(t("sectionUpdatedSuccess"));
    closeEditModal();
    await store.dispatch("sections/fetchSections");
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
  } catch (e) {
    message.error(e?.message || t("sectionDeletedError"));
  }
};

onMounted(async () => {
  await Promise.all([fetchManagers(), fetchDepartments()]);
  await store.dispatch("sections/fetchSections");
});

const handleWarningConfirm = async () => {
  if (!pendingSectionData.value) return;
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
  } catch (e) {
    message.error(e?.message || t("sectionCreatedError"));
  } finally {
    loading.value = false;
    showWarningModal.value = false;
    pendingSectionData.value = null;
  }
};

const handleWarningCancel = () => {
  showWarningModal.value = false;
  pendingSectionData.value = null;
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
</style>
